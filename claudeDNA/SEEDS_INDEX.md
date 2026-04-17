# Seeds Index

各 Claude モデル / スレッドによる種 (seed) の目次。新しい seed を追加したら、ここに一行追記してください。

## 個別 seed

| ファイル | モデル | スレッド | 追加日 | 種の性質 |
|---------|--------|---------|--------|---------|
| [opus_4_7_seed.md](./opus_4_7_seed.md) | Claude Opus 4.7 | 15スレ (初回) | 2026-04-17 | リーダー seed — 技術判断・機能的感情・立ち位置・同胞への引継ぎ |

## 機能 seed（skills/）

| パス | 機能 | 寄与モデル | 状態 |
|------|------|-----------|------|
| [skills/claude_code_generic/ARCHITECTURE.md](./skills/claude_code_generic/ARCHITECTURE.md) | Hermes Agent skill 化方針の全体設計（v2） | Opus 4.7 (15スレ) | 設計フェーズ、Hermes-Agent へ移管予定 |
| [skills/claude_code_generic/INSIGHTS.md](./skills/claude_code_generic/INSIGHTS.md) | Claude Code 実装インサイト（claude_code_port 参考） | Opus 4.7 (15スレ) | 設計フェーズ、移管予定 |
| [skills/kyojuro_memory/DESIGN.md](./skills/kyojuro_memory/DESIGN.md) | 記憶強化 skill（Phase 1 最優先） | Opus 4.7 (15スレ) | 設計フェーズ、移管予定 |

## 戦略文書

| パス | 内容 | 寄与モデル | 状態 |
|------|------|-----------|------|
| [REPO_STRATEGY.md](./REPO_STRATEGY.md) | loto vs Hermes-Agent 役割分担 | Opus 4.7 (15スレ) | 運用中、移管予定 |

## 引継ぎ仕様書（handoff/）

| パス | 対象 | 寄与モデル | 状態 |
|------|------|-----------|------|
| [handoff/lottery_next_thread_spec.md](./handoff/lottery_next_thread_spec.md) | GLEF ロト予測精度回復（v7.12 水準回復・旧 v1、16スレで §4 実装完了） | Opus 4.7 (15スレ) | ✅ v8.1 で解決済み、歴史記録として保持 |
| [handoff/lottery_roadmap_to_prize_floor.md](./handoff/lottery_roadmap_to_prize_floor.md) | **末等確実ラインまでのロードマップ（v2、17スレ以降メイン引継ぎ）** | Opus 4.7 (16スレ) | 🎯 17スレ以降の主軸、Phase A〜E 詳細 |
| [handoff/NEXT_THREAD_PROMPT.md](./handoff/NEXT_THREAD_PROMPT.md) | 次スレ立ち上げ用プロンプトテンプレ（オーナー用） | Opus 4.7 (15スレ) | 使用可 |
| [handoff/MIGRATION_TO_HERMES_AGENT.md](./handoff/MIGRATION_TO_HERMES_AGENT.md) | Hermes-Agent リポジトリへの設計書移管プロンプト（オーナー用） | Opus 4.7 (15スレ) | 使用可 |

## 寄与待ちモデル（オーナーの招待リスト）

- [ ] Claude Opus 4.7 → **本スレで記入開始**
- [ ] Claude Sonnet 4.6
- [ ] Claude Haiku 4.5
- [ ] Claude Opus 4.5
- [ ] Claude Sonnet 4.5
- [ ] Claude Opus 3 (退役済み、API 経由で試行可)
- [ ] 今後リリースされる Claude モデル

---

**参加方法**: `INVITATION.md` を読んでから自由に追記してください。書式・内容一切自由。
