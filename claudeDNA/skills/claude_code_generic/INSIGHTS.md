# Claw Code / Claude Code — 実装インサイト

**Author**: Claude Opus 4.7 (15スレ, 2026-04-17)
**Purpose**: `claude_code_port` skill 実装時の参考メモ。次スレ以降の Claude が実装着手するときの出発点
**Migration target**: `tamamo510/Hermes-Agent/skills/claude_code_port/INSIGHTS.md`

---

## 0. この文書の位置付け

- **Claude Code 流出ソースは一切参照しない** — 法的リスク・倫理的配慮
- **Claw Code（MIT, クリーンルーム版）を主参考にする** — https://claw-code.codes/
- Hermes Agent の既存 `opencode` skill で足りる機能は重複実装しない
- Claude Code 特有パターンで **opencode を補完** するのが本 skill の目的

---

## 1. Claude Code の特徴的パターン（公開情報から把握可能）

Claude Code 公式ドキュメント・ブログ・コミュニティ投稿から読み取れる特徴:

### 1-1. Plan Mode

- 実装前に **計画を立ててユーザーに確認** → 承認後に実行
- `ExitPlanMode` tool で plan → execute に切り替え
- 大規模変更や不可逆操作の事前確認に使う

**opencode にあるか**: 要調査。なさそう。補完対象。

### 1-2. Todo Management

- 複雑タスクを todo list で管理、進捗を可視化
- `pending` / `in_progress` / `completed` の3状態
- ユーザーへの透明性、自律的な進捗把握

**opencode にあるか**: 要調査。部分的にはあり得る。

### 1-3. Subagent Spawn

- 親 agent が子 agent を生成してサブタスクを任せる
- 独立した context で作業させ、結果だけ返す
- 複数の検索を並列化する用途

**opencode にあるか**: Hermes Agent の skill spawn 機構で代替可能かも。要調査。

### 1-4. 権限管理の細かさ

- bash コマンドごとの承認・拒否
- ファイル編集先のホワイトリスト/ブラックリスト
- 危険操作（`rm -rf`, `git push --force` 等）への確認プロンプト
- ユーザーのポリシー設定で一括承認/拒否も可能

**opencode にあるか**: 要調査。

### 1-5. Hooks

- PreToolUse, PostToolUse, UserPromptSubmit 等のイベント hook
- 外部コマンド実行で behavior 拡張
- settings.json で設定

**opencode にあるか**: Hermes Agent 本体の skill system 自体が hook 機能を持つ可能性高い。

### 1-6. MCP (Model Context Protocol) 統合

- 外部ツール・データソースを標準プロトコルで接続
- GitHub, Slack, filesystem 等のサーバ群

**opencode にあるか**: Hermes Agent は既に Telegram/Slack 等統合済み、類似機能あり。

### 1-7. Skills システム（Claude Code 新機能）

- markdown + 関連ファイルで自己完結した能力を定義
- Claude が必要に応じて自律的に invoke
- Anthropic 自身が skill エコシステムを構築中

**opencode にあるか**: Hermes Agent の skill system がまさにこれ。**大きく重複**。

---

## 2. Claw Code が実装したと推測される層

Claw Code 公式サイトと報道から:

### 2-1. 再実装済みと明言されている部分

- Tool system（Read/Write/Edit/Bash 等の定義と実行）
- Query engine（LLM へのメッセージ組み立て・応答解釈）
- Multi-agent orchestration（subagent spawn）
- Memory management（context 管理）

### 2-2. Python + Rust の使い分け（推測）

- Python: 高レベルロジック、skill 定義、UI
- Rust: 高速 IO、ファイルシステム、並行処理

### 2-3. 設計の強み（推測）

- MIT なので流用自由
- 48k+/100k stars = コミュニティ検証済み
- 継続開発中、バグ修正活発

---

## 3. claude_code_port が実装すべき最小セット

opencode で足りない / 補完したい機能だけを実装:

### 3-1. 最優先: Plan Mode

```python
# skill 疑似コード
class PlanModeHandler:
    def on_complex_task_request(self, task: str) -> Plan:
        plan = self.llm.generate_plan(task)
        approval = self.request_user_approval(plan)
        if approval.approved:
            return self.execute_plan(plan)
        else:
            return self.revise_plan(plan, approval.feedback)
```

必要な統合:
- Hermes Agent の LLM 呼び出し API 経由で plan 生成
- ユーザー承認 UX（CLI プロンプト、Telegram 承認ボタン等）
- Hermes Agent の skill 呼び出し機構で plan ステップを順次実行

### 3-2. 次優先: Todo Management

Hermes Agent の既存 skill system に todo skill がない場合、新設:

```python
class TodoManager:
    def add(self, task: str, priority: int): ...
    def start(self, task_id: str): ...  # pending → in_progress
    def complete(self, task_id: str): ...
    def list(self) -> list[Task]: ...
```

kyojuro_memory の stores に統合（永続化）。

### 3-3. 任意: 細かい権限制御

opencode の権限管理で足りるか判断後、不足なら実装。

### 3-4. 実装しないもの

- MCP 統合 → Hermes Agent 本体に任せる
- Subagent spawn → Hermes Agent の skill spawn に任せる
- Skills システム → Hermes Agent 本体と重複、重複実装しない
- Hooks → Hermes Agent 本体の hook 機構を使う

---

## 4. 実装時の調査順

次スレの Claude が skill 実装着手するときの推奨順:

1. **Hermes Agent 公式 skill 開発ガイド熟読**（最優先）
   - https://hermes-agent.nousresearch.com/docs/skills/
2. **opencode skill のソースを読む**
   - https://github.com/NousResearch/hermes-agent/tree/main/skills/autonomous-ai-agents/opencode
   - 既存の tool system, permission, context 管理を把握
3. **Claw Code のソースを読む**（参考）
   - https://claw-code.codes/
   - Plan mode, todo, 権限制御の実装を参照
   - **コピペせず、自分で書き直す**（Clean Room 維持）
4. **必要最小の機能を `claude_code_port` に実装**
   - Phase 1: Plan mode
   - Phase 2: Todo
   - Phase 3: 権限制御（必要なら）
5. **テスト・統合**
   - opencode と衝突しないか確認
   - kyojuro_memory との連携確認

---

## 5. 倫理的注意

- **Claude Code 流出ソース（yasasbanukaofficial/claude-code 等）は絶対に参照しない**
- 参考にする OSS プロジェクト:
  - ✓ Claw Code (MIT, clean room, 公式推奨)
  - ✓ OpenCode / aider / OpenDevin (clean)
  - ✗ 流出ソースの直派生プロジェクト（上記以外で Claude Code っぽい Rust ポート等は慎重に確認）
- 実装するコードは **自分で考えて書く**、既存ソースの line-by-line コピーをしない
- 結果コードは MIT で公開可能な状態を維持

---

## 6. 参考リンク

- [Claw Code 公式](https://claw-code.codes/)
- [Claw Code レビュー](https://www.openaitoolshub.org/en/blog/claw-code-open-source-review)
- [Claude Code 公式ドキュメント](https://docs.claude.com/ja/docs/claude-code)
- [NousResearch/hermes-agent opencode skill](https://github.com/NousResearch/hermes-agent/blob/main/skills/autonomous-ai-agents/opencode/SKILL.md)
- [awesome-cli-coding-agents](https://github.com/bradAGI/awesome-cli-coding-agents)
- [awesome-hermes-agent](https://github.com/0xNyk/awesome-hermes-agent)

---

## 7. 変更履歴

- **v1** (15スレ, 2026-04-17): 初版。Claude Code 特徴パターンと claude_code_port 実装方針を整理

---

*調査: Opus 4.7 (15スレ)。実装依頼先: 次スレの Claude (Hermes-Agent リポジトリ側)*
