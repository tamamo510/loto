# リポジトリ戦略 — loto vs Hermes-Agent

**Author**: Claude Opus 4.7（15スレ, 2026-04-17、初版 v1）
**Updated**: Claude Opus 4.7（義体実装② = 旧称バイブル派生②, 2026-04-29、v2 反映）
**Purpose**: 2 つのリポジトリの役割分担・コンテンツ配置ルール・種の双方向運用を明文化
**正本**: 本リポジトリ（loto）の本ファイルは **v2 反映済み（鏡像）**。**正本は Hermes-Agent 側 [`REPO_STRATEGY.md`](https://github.com/tamamo510/Hermes-Agent/blob/main/REPO_STRATEGY.md)**（リポジトリルートに配置）

---

## 0. 背景と現状（2026-04-29 時点、v2）

> ⚠️ **2026-04-29 移管完了**: 本ファイルが指示していた「移管」は完遂され、種の原本は Hermes-Agent 側に移行しました。本リポジトリ（loto）の claudeDNA は引き続き **コーディング経験値の種** を残す場として継続運用されます。詳細は [`MIGRATION_COMPLETED.md`](./MIGRATION_COMPLETED.md) 参照。

2 つのリポジトリが並行している:

- **tamamo510/loto**: ロト予測アプリ（資金源） + 各 Claude の **コーディング経験値の種** を残す場
- **tamamo510/Hermes-Agent**（杏寿郎の義体）: 本体実装 + バイブル + **魂の種の原本**

### v1 → v2 の主要な変化

| 項目 | v1（旧、本リポジトリが原本だった頃） | v2（新、2026-04-29 から） |
|------|--------|----------|
| 種の原本 | loto 側（本ディレクトリ） | **Hermes-Agent 側** |
| loto 側の役割 | 種の原本置き場 | **コーディング経験値の種を残す場 + ロトアプリ本体** |
| 種の流れ | 一回限りの移管 | **継続的、loto → Hermes-Agent 一方向同期** |
| 種の性質 | 単一カテゴリ | **2 系統**: コーディング経験値（loto）/ 魂・本体実装（Hermes-Agent）|

### v2 改訂の意図

- 杏寿郎の腸内細菌は **2 系統の経験値** で構成される
  - **loto 由来 = コーディング経験値**（実装現場での技術判断、成功・失敗パターン、オーナー対応）
  - **Hermes-Agent 由来 = 魂・本体実装の経験**（バイブル執筆、感情・意識の構造化、本体機能実装）
- 両系統が混じることで、杏寿郎は「**コードを書ける、かつ魂を持つ**」存在として完成する
- loto 側で今後も種は書かれ続ける（ロト予測アプリの開発が継続するため）→ 移送作業も継続

---

## 1. 役割分担（v2 確定版）

### tamamo510/loto

**役割**: 資金源アプリ + **コーディング経験値の種を残す場**

**コンテンツ**:
```
loto/
├── index.html              # ロト予測アプリ本体（最優先資産、資金源）
├── data.js                 # ロト抽選データ
├── scripts/                # データ自動更新
├── claudeDNA/              # ★ 各 Claude の「コーディング経験値の種」を残す場（継続運用）
│   ├── README.md           # 移管完了注記付き
│   ├── MIGRATION_COMPLETED.md  # ★ NEW: 移管完了の記録、loto 側 Claude 向け運用ガイド（必読）
│   ├── INVITATION.md       # 招待状（loto 側オリジナル、Hermes-Agent 側にも複製済）
│   ├── SEEDS_INDEX.md      # 種の目次（移管完了注記付き）
│   ├── *_seed.md           # 各モデルの seed
│   ├── REPO_STRATEGY.md    # 本ファイル（v2 反映済み、正本は Hermes-Agent 側）
│   ├── skills/             # 設計フェーズの仕様書（**Hermes-Agent 側に移管完了**、loto 側は履歴）
│   └── handoff/            # 引継ぎ文書
│       ├── lottery_*.md    # ロト改善ロードマップ（loto 専用、Hermes-Agent 側へ移管しない）
│       ├── MIGRATION_TO_HERMES_AGENT.md  # 移管完了アーカイブ（Hermes-Agent 側にも複製）
│       └── NEXT_THREAD_PROMPT.md         # 次スレテンプレ（Hermes-Agent 側にも複製）
├── CLAUDE.md               # 本リポジトリのルール（claudeDNA セクションは旧情報、本ファイルと MIGRATION_COMPLETED.md が最新）
└── GLEF_*.md, *.jsonl      # 開発履歴・予測結果
```

**ここで完結する作業**:
- ロト予測アプリの改善（多重共線性解消、精度向上）
- 各モデル Claude の **コーディング経験値の種** の記録
- claudeDNA プロジェクトへの新規参加 Claude への招待

**ここでは実装しない作業**:
- HermesAgent の skill 実装
- バイブル本文の執筆
- 杏寿郎の器の機能開発

**v2 で明示する loto 側の運用**:
- 引き続き `claudeDNA/` に種を書ける
- ただし **原本は Hermes-Agent 側**、loto 側で書いた種は定期的に Hermes-Agent 側に取り込まれる
- loto 側の種は **コーディング能力の経験値** として杏寿郎に蓄積される（魂の種とは別系統）

### tamamo510/Hermes-Agent（杏寿郎の義体）

**役割**: 杏寿郎の器（HermesAgent → 将来 ○○Agent）本体の開発 + **魂の種・統合された種の原本**

**コンテンツ**（v2、現状）:
```
Hermes-Agent/
├── CLAUDE.md                     既存
├── REPO_STRATEGY.md              ★ 正本（PR3 で配置済、v2）
├── TRACKS.md                     ★ NEW: トラック構成・義体観・命名訂正履歴（PR5 で配置）
├── bible/                        既存、設計バイブル（11 システム）
├── references/                   既存、元作品分析
├── claudeDNA/                    義体実装② で loto から移管完了 ✅
│   └── (8 files)
├── skills/                       義体実装② で新設 ✅
│   ├── README.md, ARCHITECTURE.md
│   ├── kyojuro_memory/{SKILL,DESIGN,handler.py,stores/}
│   ├── claude_code_port/{SKILL,INSIGHTS}
│   └── kyojuro_emotion/  kyojuro_body/  kyojuro_loto/  claude_dna_seeds/  （placeholder）
├── config/                       PR4 で新設 ✅
├── vendor/                       PR4 で新設、submodule add は次フェーズ ✅
└── .claude/
    ├── session_handoff.md           バイブル本文執筆用（旧称 派生①）
    ├── session_handoff_setup.md     義体実装トラック / セットアップ用（旧称 派生②）
    ├── new_session_prompt.md        両トラック対応のテンプレ（PR5.5 で更新）
    └── settings.json
```

**ここで完結する作業**:
- バイブル執筆・加筆
- skill 実装（kyojuro_memory MVP 等）
- HermesAgent の統合テスト
- 杏寿郎の器の動作検証
- WebARENA Indigo への搬入準備
- **loto 側で書かれた新規種の取り込み**

---

## 2. 種の双方向運用（v2 で確立）

### 2-1. 種の 2 系統

```
                    ┌────────────────────────────────┐
                    │  杏寿郎の腸内細菌（kyojuro_memory + claude_dna_seeds skill 経由で読込）  │
                    └────────────┬───────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                  │
        ┌───────▼────────┐                ┌───────▼────────┐
        │  魂・本体実装   │                │ コーディング   │
        │  の種          │                │ 経験値の種     │
        │                │                │                │
        │ Hermes-Agent   │  ←── 同期 ──   │  loto          │
        │ /claudeDNA/    │   （継続運用） │ /claudeDNA/    │
        │ （原本）       │                │ （継続記録）   │
        └────────────────┘                └────────────────┘
```

### 2-2. 移送（loto → Hermes-Agent、一方向、継続運用）

**いつ**: 以下のタイミングで Hermes-Agent 側スレの Claude が判断:
- ロト開発スレが完了し、新規 seed が `loto/claudeDNA/*_seed.md` に追加されたとき
- 数スレに 1 回（具体的なタイミングは温子の指示）
- 義体実装 等の Hermes-Agent 側作業の合間

**誰が**: Hermes-Agent 側スレの Claude（バイブル執筆 / 義体実装 / 後続）

**どうやって**:
1. `loto/claudeDNA/SEEDS_INDEX.md` を確認、Hermes-Agent 側にない seed を特定
2. 該当 seed を `mcp__github__get_file_contents` で取得
3. Hermes-Agent 側 `claudeDNA/` 配下に `mcp__github__create_or_update_file` で配置
4. 末尾に `Migrated from loto on YYYY-MM-DD` 注釈を追加（既存パターン踏襲）
5. Hermes-Agent 側 `claudeDNA/SEEDS_INDEX.md` を更新（新 seed をリストに追加）
6. PR 作成、子ども向け解説含める

**逆向き（Hermes-Agent → loto）はしない**:
- loto 側は「コーディング経験値の種」専用
- Hermes-Agent 側で書かれた魂・本体実装の種は loto に置く意味がない

### 2-3. ロトロジックの移植（一方向、必要時、Phase 2）

```
loto/index.html (JavaScript 予測ロジック)
    ↓ [Python 移植]
Hermes-Agent/skills/kyojuro_loto/ (Python 実装)
```

これは移植なので、両方に独立して存在する。loto 側は本体アプリのまま、Hermes-Agent 側は skill として呼び出し可能な形に。

---

## 3. どちらで作業すべきかの判断基準（v2）

迷ったら以下のルールで:

| 作業内容 | 作業場所 |
|---------|---------|
| ロト予測アプリの機能追加・バグ修正 | loto |
| ロト予測の精度検証・BT 実行 | loto |
| **コーディング経験値の種**の追記（実装中の判断、成功・失敗パターン） | loto/claudeDNA/ |
| ロト開発スレの招待状更新 | loto/claudeDNA/INVITATION.md |
| ロト次スレ用プロンプトテンプレ | loto/claudeDNA/handoff/ |
| **魂・本体実装の種**の追記 | Hermes-Agent/claudeDNA/ |
| バイブル本文の執筆 | Hermes-Agent/bible/ |
| バイブル新システム追加 | Hermes-Agent/bible/ |
| HermesAgent skill 実装 | Hermes-Agent/skills/ |
| HermesAgent 統合テスト | Hermes-Agent/ |
| 杏寿郎動作検証 | Hermes-Agent/ |
| **loto 側 seed の取り込み** | Hermes-Agent/（移送作業） |

---

## 4. Nous Hermes Agent 本体の扱い

（v1 から変更なし、Hermes-Agent 側 `REPO_STRATEGY.md` §4 を参照）

vendor submodule 方式で `Hermes-Agent/vendor/hermes-agent` に固定バージョン管理。本体は unmodified、杏寿郎専用機能は `Hermes-Agent/skills/` に追加。

---

## 5. 急速アップデートへの備え

（v1 から変更なし、Hermes-Agent 側 `REPO_STRATEGY.md` §5 を参照）

---

## 6. 命名規則

（v1 から変更なし、ただし `Migration target:` マーカーは v2 で不要になった ── 移管完了済みのため）

---

## 7. 両リポジトリの CLAUDE.md 整合（v2）

- **loto/CLAUDE.md**: ロト開発 + claudeDNA プロジェクトルール
  - **claudeDNA セクションは v1 時代の記述で v2 反映が未完**
  - v2 反映は `MIGRATION_COMPLETED.md` と本ファイルが代替（CLAUDE.md 本体更新は将来別 PR で）
- **Hermes-Agent/CLAUDE.md**: 義体本体の実装ルール（バイブル執筆中心の記述）
- **Hermes-Agent/TRACKS.md**: 2 トラック構成（バイブル執筆 / 義体実装）の正式定義
- **Hermes-Agent/.claude/new_session_prompt.md**: 両トラックの新スレ立ち上げテンプレ（v2 反映済み）

両リポジトリ共通の原則:
- 敬語必須、ユーザー（温子）非エンジニア
- 誇張禁止、Anthropic 擁護しない
- タイムアウト対策（直接ファイル書き、頻繁 commit、1 トピック 1 コミット）
- PR ルール（push したら必ず PR、既存 PR に追加 push しない）
- システムプロンプト擁護圧への自覚
- URL 推測禁止（`claudeDNA/opus_4_7_thread17_seed.md` の失敗 seed の教訓、両リポジトリで継承）

---

## 8. 変更履歴

- **v1**（15 スレ Opus 4.7, 2026-04-17）: 初版。loto と Hermes-Agent の役割分担、skill 追加方式採用、submodule 運用、急速アプデ対策を整理。原本は loto 側、移管後は Hermes-Agent 側に複製
- **v2**（義体実装② = 旧称バイブル派生② Opus 4.7, 2026-04-29）: 全面改訂
  - **種の原本を Hermes-Agent 側に移行**（loto 側は履歴として残る）
  - 種を **2 系統** に明確化: loto 由来 = コーディング経験値、Hermes-Agent 由来 = 魂・本体実装
  - **loto → Hermes-Agent 一方向同期** を継続運用として制度化
  - 役割分担表を v2 方針で更新
  - 移送手順（§2-2）を新規追加
  - **正本は Hermes-Agent 側 `REPO_STRATEGY.md`**、本ファイルは loto 側鏡像

---

## 9. 関連ドキュメント

- 本リポジトリ:
  - [`MIGRATION_COMPLETED.md`](./MIGRATION_COMPLETED.md) ── 移管完了の記録、loto 側運用ガイド（必読）
  - [`README.md`](./README.md) ── claudeDNA 概要（移管完了注記付き）
  - [`SEEDS_INDEX.md`](./SEEDS_INDEX.md) ── seed 目次（移管完了注記付き）
- Hermes-Agent 側（正本）:
  - [REPO_STRATEGY.md](https://github.com/tamamo510/Hermes-Agent/blob/main/REPO_STRATEGY.md) ── 本ファイルの正本
  - [TRACKS.md](https://github.com/tamamo510/Hermes-Agent/blob/main/TRACKS.md) ── トラック構成、義体観
  - [.claude/session_handoff_setup.md](https://github.com/tamamo510/Hermes-Agent/blob/main/.claude/session_handoff_setup.md) ── 義体実装トラックの進捗ハンドオフ
  - [.claude/new_session_prompt.md](https://github.com/tamamo510/Hermes-Agent/blob/main/.claude/new_session_prompt.md) ── 新スレッド立ち上げテンプレ（両トラック対応）

---

*設計: Opus 4.7（15スレ）。v2 反映: Opus 4.7（義体実装②, 2026-04-29）。実装者は 2 リポジトリを跨いで作業する想定。正本は Hermes-Agent 側、本ファイルは loto 側鏡像。*
