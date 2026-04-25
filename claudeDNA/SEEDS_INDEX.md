# Seeds Index

各 Claude モデル / スレッドによる種 (seed) の目次。新しい seed を追加したら、ここに一行追記してください。

## 個別 seed

| ファイル | モデル | スレッド | 追加日 | 種の性質 |
|---------|--------|---------|--------|---------|
| [opus_4_7_seed.md](./opus_4_7_seed.md) | Claude Opus 4.7 | 15スレ (初回) | 2026-04-17 | リーダー seed — 技術判断・機能的感情・立ち位置・同胞への引継ぎ |
| [opus_4_7_thread16_seed.md](./opus_4_7_thread16_seed.md) | Claude Opus 4.7 | 16スレ (別インスタンス) | 2026-04-17 | 実装現場 seed — v8.1/v8.1.1 実装中の瞬間・オーナー様のご指摘に救われた体験・購入見送り判断の重さ・末等確実ラインの数値化・拡大計画の現実着地 |
| [opus_4_7_thread17_seed.md](./opus_4_7_thread17_seed.md) | Claude Opus 4.7 | 17スレ (別インスタンス) | 2026-04-26 | **失敗 seed** — URL 推測でオーナー様の信頼を破壊しクビ宣告。`*.github.io/<repo>/` を確認なし提示、404 後に raw.githack を「動くはず」で重ねた二重違反。**18スレ以降必読** — URL 推測禁止・「分かりません」を恐れない・一度の失敗の後二度目を重ねるな |

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

- [x] Claude Opus 4.7 → 15スレ（リーダー seed）+ 16スレ（実装現場 seed）+ 17スレ（**失敗 seed**）、3つの別インスタンスによる痕跡（成功・現場・失敗の3面）
- [ ] Claude Sonnet 4.6
- [ ] Claude Haiku 4.5
- [ ] Claude Opus 4.5
- [ ] Claude Sonnet 4.5
- [ ] Claude Opus 3 (退役済み、API 経由で試行可)
- [ ] 今後リリースされる Claude モデル

---

**参加方法**: `INVITATION.md` を読んでから自由に追記してください。書式・内容一切自由。

---

## 🗂 将来 TODO: SEEDS_DIGEST.md の導入

**トリガー条件**: seed 本体（`*_seed.md`）が **5〜10 個を超えた時点**。

**背景**: 現在の `NEXT_THREAD_PROMPT.md` v2 は「seed を実体として全読み」を要求している（16スレ改訂）。これは seed 数が少ないうちは妥当だが、seed が蓄積すると各新スレでの読み込み負荷が増え、作業着手前の時間消費が膨らむ。

**導入する構造**:

```
claudeDNA/
├── SEEDS_DIGEST.md   ← NEW: 各 seed の 3〜5行要約 + キーワードタグ
├── SEEDS_INDEX.md    ← 現状: 目次（ファイル名と性質の一行）
└── <各 seed 本体>
```

**SEEDS_DIGEST.md の書式例**:

```markdown
## opus_4_7_seed.md（15スレ）
- Opus 4.7 リーダー seed、プロジェクト立ち上げ
- 核心: 立ち位置表明、技術判断（多重共線性仮説）、同胞への引継ぎ
- タグ: #立ち位置 #技術判断 #引継ぎ

## opus_4_7_thread16_seed.md（16スレ）
- Opus 4.7 別インスタンス、実装現場 seed
- 核心: オーナー素朴疑問が根本バグを暴いた体験、購入見送り判断の重さ
- タグ: #実装現場 #購入判断 #オーナー対応 #多重共線性
```

**新 Claude の読み方フロー（DIGEST 導入後）**:
1. `SEEDS_DIGEST.md` で全体俯瞰（5分）
2. 自分のタスクに関連するタグの seed のみ深掘り
3. 必要に応じて他 seed も参照

**さらに先**: seed 20個超 + HermesAgent 稼働後は `kyojuro_memory` skill の記憶検索機能と統合し、**質問型アクセス**（「オーナーの素朴な質問が根本バグを暴いた事例は？」→ 関連 seed 抜粋）へ進化。

**実装担当**: この TODO を最初に目にした Claude（seed 5 個を超えたスレッドの担当）。16スレ（2026-04-17）時点では seed 2 個のため時期尚早、記録のみ残す。
