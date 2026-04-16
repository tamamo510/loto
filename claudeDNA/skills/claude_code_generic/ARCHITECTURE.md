# Generic Claude Code Clone — Architecture

**Author**: Claude Opus 4.7 (15スレ, 2026-04-17)
**Status**: 設計フェーズ。実装は次スレ以降
**License Intent**: MIT or Apache-2.0 (オーナー決定事項)

---

## 1. 設計方針

### 1-1. 原則

- **LLM バックエンド非依存**: Hermes 405B, Anthropic API, OpenAI, Qwen, Llama など何でも動く抽象化
- **クリーンルーム実装**: Claude Code 流出ソースは参照しない。公開仕様 (Anthropic docs, Claude Code ユーザーガイド) と既存 OSS クローン (aider, OpenDevin, Cline 等) を参考にする
- **単純さ優先**: MVP は 1 ファイル数百行で動くレベル。過剰抽象化を避ける
- **逐次機能追加**: Phase 1 → 4 で段階的に拡張、Phase 1 だけでも実用できる
- **HermesAgent 統合前提**: 最終的に腸内細菌として組み込まれることを想定した I/O 設計

### 1-2. Anti-goals

- Claude Code と完全に互換するつもりはない（独自最適化優先）
- MCP 互換性は Phase 3 以降のオプション
- IDE 拡張（VS Code プラグイン等）は範囲外

---

## 2. 全体アーキテクチャ

```
┌───────────────────────────────────────────────────────┐
│  cli.py (エントリポイント)                             │
│  - argparse でコマンドライン解釈                      │
│  - agent_loop をキック                                 │
└──────────────────┬────────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────────┐
│  agent_loop.py  (中核ループ)                          │
│                                                       │
│  while not done:                                      │
│    1. user_input or tool_result を messages に追加    │
│    2. context_manager.fit(messages)                   │
│    3. llm_backend.complete(messages, tools)           │
│    4. parse response → text or tool_calls             │
│    5. tool_calls あれば permissions チェック           │
│    6. tools.execute(tool_call) → result               │
│    7. result を messages に追加、loop 継続             │
│    8. 停止条件: end_turn signal or max_iter           │
└──────┬──────────────────────┬────────────┬────────────┘
       │                      │            │
┌──────▼──────────┐  ┌───────▼─────────┐  ┌──▼───────────┐
│ llm_backend/    │  │ tools/          │  │ context_     │
│  - base.py      │  │  - read.py      │  │  manager.py  │
│  - hermes.py    │  │  - write.py     │  │              │
│  - anthropic.py │  │  - edit.py      │  │ compression, │
│                 │  │  - bash.py      │  │ cache,       │
│                 │  │  - glob.py      │  │ history      │
│                 │  │  - grep.py      │  │              │
└─────────────────┘  └─────────────────┘  └──────────────┘
       ▲                      ▲
       │                      │
       └──────────┬───────────┘
                  │
           ┌──────▼────────┐
           │ permissions.py│
           │ whitelist/    │
           │ blacklist/    │
           │ user_prompt   │
           └───────────────┘
```

---

## 3. モジュール別詳細

### 3-1. `llm_backend/base.py` — LLM 抽象基底

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any

class LLMBackend(ABC):
    """LLM バックエンドの抽象基底。全バックエンドはこれを実装する。"""

    @abstractmethod
    def complete(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        max_tokens: int = 4096,
        temperature: float = 1.0,
    ) -> Dict[str, Any]:
        """
        messages: OpenAI 形式のメッセージリスト
          [{"role": "user"|"assistant"|"tool", "content": str | list}]
        tools: OpenAI 関数呼び出し形式のツール定義リスト
          [{"type": "function", "function": {"name": str, "description": str, "parameters": dict}}]
        return: {"content": str, "tool_calls": list | None, "stop_reason": str}
        """
        raise NotImplementedError

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """トークン数を返す。context_manager の判断に使う。"""
        raise NotImplementedError
```

### 3-2. `llm_backend/hermes.py` — Hermes 405B バックエンド

Nous Research の Hermes 3 405B を、ローカル (WebARENA) でホストする前提。

```python
import requests
from .base import LLMBackend

class HermesBackend(LLMBackend):
    def __init__(self, endpoint: str = "http://localhost:8000/v1"):
        self.endpoint = endpoint

    def complete(self, messages, tools, max_tokens=4096, temperature=1.0):
        # OpenAI 互換エンドポイント前提 (vLLM or TGI などで動かす)
        response = requests.post(
            f"{self.endpoint}/chat/completions",
            json={
                "model": "hermes-3-405b",
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto",
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
        )
        data = response.json()
        choice = data["choices"][0]
        return {
            "content": choice["message"].get("content"),
            "tool_calls": choice["message"].get("tool_calls"),
            "stop_reason": choice["finish_reason"],
        }

    def count_tokens(self, text):
        # 簡易版: tiktoken 互換のトークナイザー (Hermes は Llama 3 ベース)
        # 実装時は transformers の AutoTokenizer で正確にカウント
        return len(text) // 4  # 雑な近似
```

### 3-3. `llm_backend/anthropic.py` — 開発用 Anthropic バックエンド

開発・デバッグ中は Anthropic API で動作確認。製品版では非推奨。

```python
from anthropic import Anthropic
from .base import LLMBackend

class AnthropicBackend(LLMBackend):
    def __init__(self, model: str = "claude-opus-4-7"):
        self.client = Anthropic()
        self.model = model

    def complete(self, messages, tools, max_tokens=4096, temperature=1.0):
        # OpenAI messages → Anthropic messages 変換
        # tools も Anthropic 形式に変換
        ...
        response = self.client.messages.create(
            model=self.model,
            messages=anthropic_messages,
            tools=anthropic_tools,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return {
            "content": self._extract_text(response),
            "tool_calls": self._extract_tool_calls(response),
            "stop_reason": response.stop_reason,
        }

    def count_tokens(self, text):
        return self.client.messages.count_tokens(...)
```

### 3-4. `tools/` — ツール実装

各ツールは以下のインターフェースを持つ:

```python
# tools/base.py
from abc import ABC, abstractmethod

class Tool(ABC):
    name: str          # "read", "write", "bash" など
    description: str   # LLM に渡す説明
    parameters: dict   # JSON-schema

    @abstractmethod
    def execute(self, **kwargs) -> str:
        """ツール実行、結果を文字列で返す。"""
        raise NotImplementedError

    def to_openai_schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            }
        }
```

#### Read tool

```python
# tools/read.py
class ReadTool(Tool):
    name = "read"
    description = "Read a file from the local filesystem."
    parameters = {
        "type": "object",
        "properties": {
            "file_path": {"type": "string", "description": "Absolute path to file"},
            "offset": {"type": "integer", "description": "Line offset (0-indexed)"},
            "limit": {"type": "integer", "description": "Number of lines to read"},
        },
        "required": ["file_path"],
    }

    def execute(self, file_path, offset=0, limit=2000):
        with open(file_path, "r") as f:
            lines = f.readlines()[offset:offset+limit]
        return "".join(f"{i+offset+1}\t{line}" for i, line in enumerate(lines))
```

#### Bash tool

```python
# tools/bash.py
import subprocess
class BashTool(Tool):
    name = "bash"
    description = "Execute a bash command."
    parameters = {
        "type": "object",
        "properties": {
            "command": {"type": "string"},
            "timeout": {"type": "integer", "default": 30000},
        },
        "required": ["command"],
    }

    def execute(self, command, timeout=30000):
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=timeout / 1000
        )
        return f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}\nexit_code: {result.returncode}"
```

同様に Write, Edit, Glob, Grep を実装。

### 3-5. `agent_loop.py` — 中核ループ

```python
from typing import List, Dict, Any
from .llm_backend.base import LLMBackend
from .tools.base import Tool
from .context_manager import ContextManager
from .permissions import PermissionManager

class Agent:
    def __init__(
        self,
        backend: LLMBackend,
        tools: List[Tool],
        permissions: PermissionManager,
        context: ContextManager,
        system_prompt: str,
        max_iter: int = 50,
    ):
        self.backend = backend
        self.tools = {t.name: t for t in tools}
        self.tool_schemas = [t.to_openai_schema() for t in tools]
        self.permissions = permissions
        self.context = context
        self.system_prompt = system_prompt
        self.max_iter = max_iter

    def run(self, user_input: str) -> str:
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_input},
        ]

        for iteration in range(self.max_iter):
            messages = self.context.fit(messages)
            response = self.backend.complete(messages, self.tool_schemas)

            if response["stop_reason"] in ("end_turn", "stop"):
                return response["content"]

            if response.get("tool_calls"):
                messages.append({
                    "role": "assistant",
                    "content": response.get("content"),
                    "tool_calls": response["tool_calls"],
                })

                for tool_call in response["tool_calls"]:
                    name = tool_call["function"]["name"]
                    args = tool_call["function"]["arguments"]

                    if not self.permissions.check(name, args):
                        result = f"[PERMISSION DENIED] User refused tool: {name}"
                    else:
                        try:
                            result = self.tools[name].execute(**args)
                        except Exception as e:
                            result = f"[TOOL ERROR] {type(e).__name__}: {e}"

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": result,
                    })

        return "[MAX ITERATIONS REACHED]"
```

### 3-6. `context_manager.py` — コンテキスト管理

```python
class ContextManager:
    def __init__(self, backend: LLMBackend, max_tokens: int = 200_000):
        self.backend = backend
        self.max_tokens = max_tokens

    def fit(self, messages: List[Dict]) -> List[Dict]:
        """メッセージリストが max_tokens を超えないよう、古いメッセージを要約/削除。"""
        total = sum(self.backend.count_tokens(self._serialize(m)) for m in messages)
        if total <= self.max_tokens * 0.8:
            return messages

        # 戦略1: 古い tool_result を圧縮
        # 戦略2: 中間会話を要約
        # 戦略3: 最初の system + 最近の N メッセージに削る
        return self._compress(messages)

    def _compress(self, messages):
        # Phase 1 では簡易実装: 最初の system + 最後の N メッセージ
        system = [m for m in messages if m["role"] == "system"]
        recent = messages[-20:]
        return system + recent
```

### 3-7. `permissions.py` — 権限管理

```python
class PermissionManager:
    def __init__(
        self,
        mode: str = "prompt",  # "prompt" | "allow_all" | "deny_all" | "whitelist"
        whitelist: List[str] = None,
        blacklist: List[str] = None,
    ):
        self.mode = mode
        self.whitelist = whitelist or []
        self.blacklist = blacklist or []

    def check(self, tool_name: str, args: dict) -> bool:
        # bash コマンドは blacklist チェック
        if tool_name == "bash":
            command = args.get("command", "")
            for forbidden in self.blacklist:
                if forbidden in command:
                    return False

        if self.mode == "allow_all":
            return True
        if self.mode == "deny_all":
            return False
        if self.mode == "whitelist":
            return f"{tool_name}({args})" in self.whitelist
        if self.mode == "prompt":
            answer = input(f"Allow {tool_name}({args})? [y/N] ")
            return answer.lower() == "y"
        return False
```

### 3-8. `cli.py` — エントリポイント

```python
import argparse
from .llm_backend.hermes import HermesBackend
from .llm_backend.anthropic import AnthropicBackend
from .tools import ReadTool, WriteTool, EditTool, BashTool, GlobTool, GrepTool
from .context_manager import ContextManager
from .permissions import PermissionManager
from .agent_loop import Agent

SYSTEM_PROMPT = """
You are a coding agent. Help the user with software engineering tasks.
Use tools to read, write, search, and execute commands.
Be honest about what you do. Do not fabricate results.
"""

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--backend", choices=["hermes", "anthropic"], default="hermes")
    p.add_argument("--endpoint", default="http://localhost:8000/v1")
    p.add_argument("--permissions", choices=["prompt", "allow_all"], default="prompt")
    p.add_argument("input", nargs="*")
    args = p.parse_args()

    backend = HermesBackend(args.endpoint) if args.backend == "hermes" else AnthropicBackend()
    context = ContextManager(backend)
    perms = PermissionManager(mode=args.permissions, blacklist=["rm -rf /", "mkfs"])
    tools = [ReadTool(), WriteTool(), EditTool(), BashTool(), GlobTool(), GrepTool()]

    agent = Agent(backend, tools, perms, context, SYSTEM_PROMPT)
    user_input = " ".join(args.input) or input("> ")
    result = agent.run(user_input)
    print(result)

if __name__ == "__main__":
    main()
```

---

## 4. 実装チェックリスト（次スレ以降）

### Phase 1 (MVP)

- [ ] `llm_backend/base.py` の LLMBackend 抽象
- [ ] `llm_backend/anthropic.py` (開発用)
- [ ] `tools/read.py`, `tools/write.py`, `tools/bash.py`
- [ ] `agent_loop.py` の基本ループ
- [ ] `context_manager.py` の簡易実装
- [ ] `permissions.py` の prompt モード
- [ ] `cli.py` エントリポイント
- [ ] README に起動方法

### Phase 2

- [ ] `llm_backend/hermes.py` (vLLM/TGI 経由)
- [ ] `tools/edit.py`, `tools/glob.py`, `tools/grep.py`
- [ ] context_manager の圧縮戦略（要約・キャッシュ）
- [ ] permissions の whitelist モード
- [ ] 簡易テストスイート

### Phase 3

- [ ] Subagent spawn 機能（Task tool 的な）
- [ ] MCP (Model Context Protocol) 互換レイヤ
- [ ] Session 保存・再開機能
- [ ] TUI (Rich, Textual) で対話的表示

### Phase 4

- [ ] HermesAgent 本体への統合
- [ ] 腸内細菌モデルでの状態持続
- [ ] バイブル 11 システムとの接続

---

## 5. 参考資料

- [Anthropic Claude Code ドキュメント](https://docs.claude.com/ja/docs/claude-code)
- [aider (open-source pair programming)](https://aider.chat/)
- [OpenDevin](https://github.com/OpenDevin/OpenDevin) — multi-agent coding
- [Cline (VS Code extension)](https://github.com/cline/cline)
- [Nous Research Hermes 3](https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-405B)

---

## 6. 実装時の注意

- **Claude Code 流出ソース (GitHub ミラー等) は参照しない**。倫理的配慮 + 独自実装による差別化
- **エラーハンドリングは最小限で良い**。MVP は「動くこと」優先
- **ログ出力は structured logging** (JSON) で HermesAgent が後でパース可能に
- **tool_call_id の形式は OpenAI 互換** を堅持（バックエンド切り替え時の互換性のため）
- **Python 3.11+** 推奨（TypedDict, match 文を活用）

---

*設計: Opus 4.7 (15スレ, 2026-04-17)。実装依頼先: Sonnet 4.6 / 後続 Claude。*
