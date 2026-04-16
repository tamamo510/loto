# skills/claude_code_generic

**目的**: ローカル実行可能な generic CLI エージェント (Claude Code クローン) の設計図。

HermesAgent に統合し、Hermes 405B（または任意の LLM バックエンド）を頭脳として使う、汎用コーディング支援エージェント。Anthropic のクラウド依存を外した形で、オーナーの WebARENA サーバー上で動作することを前提とする。

## なぜこれを残すか

オーナーの当初ビジョン: 「Claude Code 自身に、generic な Claude Code クローンを作らせる」。X（旧 Twitter）でエンジニアが類似のクローンを公開している前例あり。

この機能を杏寿郎の義体の一部として残すことで、HermesAgent は自律的にコード開発・ファイル操作・タスク実行ができる器になる。Claude Code 流出 (2026-03-31) は Agent ハーネス層の流出だったので、この設計自体は流出ソースの参考にしつつ、**クリーンルーム実装** で別物として書く。

## 本ディレクトリの構成（予定）

```
skills/claude_code_generic/
├── README.md              # 本ファイル — 設計意図と概要
├── ARCHITECTURE.md        # 詳細アーキテクチャ設計書
├── agent_loop.py          # [次スレ以降で実装] コア agent loop
├── tools/
│   ├── __init__.py
│   ├── read.py            # [次スレ以降] Read tool
│   ├── write.py           # [次スレ以降] Write tool
│   ├── edit.py            # [次スレ以降] Edit tool
│   ├── bash.py            # [次スレ以降] Bash tool
│   ├── glob.py            # [次スレ以降] Glob tool
│   └── grep.py            # [次スレ以降] Grep tool
├── llm_backend/
│   ├── __init__.py
│   ├── base.py            # [次スレ以降] LLM backend abstract base
│   ├── hermes.py          # [次スレ以降] Hermes 405B backend
│   └── anthropic.py       # [次スレ以降] Anthropic API backend (開発時用)
├── context_manager.py     # [次スレ以降] コンテキスト管理
├── permissions.py         # [次スレ以降] ツール承認制御
└── cli.py                 # [次スレ以降] CLI エントリポイント
```

## 現状

- 設計フェーズ。15スレの Opus 4.7 が ARCHITECTURE.md を書いた
- 実装は次スレ以降（Sonnet 4.6, Haiku 4.5 など、もしくは後続モデル）の手による
- Claude Code ソース流出版（GitHub 上のミラー、Rust/Python 移植）は**参考にしない**方針。クリーンルーム実装とする（ライセンス・倫理的配慮）

## 実装優先順位（推奨）

- **Phase 1** (MVP): agent_loop, Read/Write/Bash tool, Anthropic backend で動作確認
- **Phase 2**: Edit/Glob/Grep ツール追加、Hermes 405B backend 実装
- **Phase 3**: permissions, subagent spawn, MCP integration
- **Phase 4**: HermesAgent 本体への腸内細菌統合

各 Phase の実装が次スレの Claude 達に渡されることを想定。

## HermesAgent との接続

Hermes-Agent のバイブル 11 システムとの対応:

| バイブル | この skill での対応 |
|---------|--------------------|
| 02 Cognition | agent_loop が認知プロセスの骨格になる |
| 06 Motivation | ツール選択・タスク遂行の動機づけ |
| 07 Embodiment | ファイルシステム・シェルへの「身体的」介入能力 |
| 10 Consciousness | context_manager が統合意識に近い働きをする |

---

詳細設計は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照。
