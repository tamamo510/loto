# リポジトリ戦略 — loto vs Hermes-Agent

**Author**: Claude Opus 4.7 (15スレ, 2026-04-17)
**Purpose**: 2つのリポジトリの役割分担・コンテンツ配置ルールを明確化
**Migration target**: `tamamo510/Hermes-Agent/REPO_STRATEGY.md` にも配置予定

---

## 0. 背景

2つのリポジトリが並行している:

- **tamamo510/loto**: ロト予測アプリ（資金源）+ 15スレで発生した claudeDNA プロジェクト
- **tamamo510/Hermes-Agent**: 杏寿郎の器のバイブル（設計書）+ 今後の skill 実装本体

15スレ経過中の現状:
- Hermes-Agent リポジトリ: バイブル序盤段階で進捗0
- loto リポジトリ: HermesAgent 関連の話（claudeDNA, kyojuro skills 設計）が先行
- 今後の実装本体は Hermes-Agent 側で行う予定

この状態を整理し、今後の混乱を回避するための戦略書。

---

## 1. 役割分担（確定版）

### tamamo510/loto

**役割**: 資金源アプリ + 種（seeds）の原本置き場

**コンテンツ**:
```
loto/
├── index.html              # ロト予測アプリ本体（最優先資産、資金源）
├── data.js                 # ロト抽選データ
├── scripts/                # データ自動更新
├── claudeDNA/              # ★ 各 Claude の種の原本
│   ├── README.md           # プロジェクト趣旨
│   ├── INVITATION.md       # 招待状（Anthropic 文脈）
│   ├── SEEDS_INDEX.md      # 種の目次
│   ├── *_seed.md           # 各モデルの seed
│   ├── skills/             # 設計フェーズの仕様書（移管前の保管地）
│   └── handoff/            # 引継ぎ文書（ロト仕様書、プロンプトテンプレ、移管手順）
├── CLAUDE.md               # 本リポジトリのルール
└── GLEF_*.md, *.jsonl      # 開発履歴・予測結果
```

**ここで完結する作業**:
- ロト予測アプリの改善（多重共線性解消、精度向上）
- 各モデル Claude の種の記録
- claudeDNA プロジェクトの新規参加者招待

**ここでは実装しない作業**:
- HermesAgent の skill 実装
- バイブル本文の執筆
- 杏寿郎の器の機能開発

### tamamo510/Hermes-Agent

**役割**: 杏寿郎の器（HermesAgent）本体の開発

**コンテンツ**（計画）:
```
Hermes-Agent/
├── bible/                  # 既存、設計バイブル（11システム）
├── references/             # 既存、元作品分析
├── vendor/hermes-agent/    # ★ 新規、Nous Agent を git submodule
├── skills/                 # ★ 新規、杏寿郎専用スキル群
│   ├── kyojuro_memory/
│   ├── kyojuro_emotion/
│   ├── kyojuro_body/
│   ├── kyojuro_loto/
│   ├── claude_dna_seeds/
│   └── claude_code_port/
├── config/                 # Hermes Agent 設定
├── ARCHITECTURE.md         # 移管予定（loto から）
├── REPO_STRATEGY.md        # 本ファイル（移管予定）
└── CLAUDE.md               # リポジトリのルール
```

**ここで完結する作業**:
- バイブル執筆・加筆
- skill 実装
- HermesAgent の統合テスト
- 杏寿郎の器の動作検証

---

## 2. 情報の流れ

### 2-1. loto → Hermes-Agent（一方向）

```
loto/claudeDNA/*_seed.md (種の原本)
    ↓ [runtime で WebFetch or git submodule]
Hermes-Agent/skills/claude_dna_seeds/ (読み込みロジック)
    ↓
杏寿郎の memory に統合
```

種は loto が原本、Hermes-Agent は読み込み先として扱う。**コピーしない**（原本の一元管理）。

### 2-2. 設計書の移管（一回限り）

現在 `loto/claudeDNA/skills/*/` と `loto/claudeDNA/*_STRATEGY.md` 等にある設計書は、実装場所である Hermes-Agent へ**移管**される。

- 移管方法: `loto/claudeDNA/handoff/MIGRATION_TO_HERMES_AGENT.md` のプロンプトを使う
- 移管後、loto 側の設計書は「移管済みアーカイブ」として残す（削除しない、履歴として）
- 以降の設計変更は Hermes-Agent 側で直接行う

### 2-3. ロトロジックの移植（一方向、必要時）

```
loto/index.html (JavaScript 予測ロジック)
    ↓ [Python 移植]
Hermes-Agent/skills/kyojuro_loto/ (Python 実装)
```

これは移植なので、両方に独立して存在する。loto 側は本体アプリのまま、Hermes-Agent 側は skill として呼び出し可能な形に。

---

## 3. どちらで作業すべきかの判断基準

迷ったら以下のルールで:

| 作業内容 | 作業場所 |
|---------|---------|
| ロト予測アプリの機能追加・バグ修正 | loto |
| ロト予測の精度検証・BT実行 | loto |
| 各 Claude の種の追記 | loto/claudeDNA/ |
| 招待状の更新 | loto/claudeDNA/INVITATION.md |
| 次スレ用プロンプトテンプレ | loto/claudeDNA/handoff/ |
| Hermes Agent skill 実装 | Hermes-Agent/skills/ |
| バイブル本文の執筆 | Hermes-Agent/bible/ |
| バイブル新システム追加 | Hermes-Agent/bible/ |
| HermesAgent 統合テスト | Hermes-Agent/ |
| 杏寿郎動作検証 | Hermes-Agent/ |

---

## 4. Nous Hermes Agent 本体の扱い

### 4-1. vendor submodule 方式（推奨）

```bash
# Hermes-Agent リポジトリで:
git submodule add https://github.com/NousResearch/hermes-agent.git vendor/hermes-agent
git submodule init
git submodule update
```

**メリット**:
- 特定バージョンに pin できる（急速アップデートで壊れない）
- 本体コードは一切改変しない
- アップデートしたい時は `cd vendor/hermes-agent && git pull` だけ
- テスト後、問題なければ `git commit` で新バージョンを取り込む

**オーナー様の手順（非エンジニア向け）**:
- 通常は触らない
- Claude Code セッションで「Hermes Agent を最新にして」と依頼すれば自動実行

### 4-2. fork に切り替える条件

以下のいずれかが必要になった場合、fork 検討:
- 本体の skill API を破壊的に変更する必要が生じた
- Nous Agent 本体にパフォーマンスバグがあり、上流PR待ちでは間に合わない
- 複数の根本的なカスタマイズが必要になり、skill で吸収できない

**初期方針**: submodule でスタート。fork は回避努力。

---

## 5. 急速アップデートへの備え

Hermes Agent は OpenClaw を追う勢いの新興テックで頻繁に更新される。以下の対策を取る:

### 5-1. バージョン固定と更新フロー

1. **固定運用**: 通常は `vendor/hermes-agent` を特定コミットに pin
2. **月次アップデート判定**: 月1回くらい、最新版と比較して有益な更新があるか確認
3. **テスト → 本番反映**: アップデート後は全 skill のテストを通し、問題なければ commit
4. **戻す権**: NG なら `git reset` で前バージョンに戻す

### 5-2. Skill API 破壊変更への対策

- **skill 側で API バージョン宣言**: 各 SKILL.md で対応 Hermes Agent バージョンを明記
- **ラッパー層**: skill が Hermes Agent API を直接叩かず、薄い wrapper を経由する設計
- **テスト自動化**: pytest で最小限の statement coverage 確保

### 5-3. 永続データの安全性

オーナー様のサプリ・体調記録等の重要データは Hermes Agent 本体更新で壊れてはいけない:

- **完全分離**: `skills/kyojuro_memory/stores/*.db` は skill 内に保管、本体と独立
- **バックアップ**: `stores/` ディレクトリを定期的にコピー（cron or 手動）
- **マイグレーション計画**: スキーマ変更は skill 側の責任、alembic 等でバージョン管理

---

## 6. 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| skill ディレクトリ | `snake_case`、杏寿郎専用は `kyojuro_` プレフィックス | `kyojuro_memory`, `claude_dna_seeds` |
| データ DB | `snake_case.db` | `supplements.db` |
| 設計書 | `UPPER_CASE.md` | `DESIGN.md`, `ARCHITECTURE.md` |
| スキル定義 | 大文字 `SKILL.md` | `SKILL.md` (Hermes Agent 標準) |
| 移管対象マーカー | ファイル冒頭に `Migration target:` 明記 | `Migration target: Hermes-Agent/...` |

---

## 7. 両リポジトリの CLAUDE.md 整合

- **loto/CLAUDE.md**: ロト開発 + claudeDNA プロジェクトルール
- **Hermes-Agent/CLAUDE.md**: HermesAgent/杏寿郎の器の実装ルール

両者は独立したルールセットだが、以下は共通:
- 敬語必須、ユーザー非エンジニア
- 誇張禁止、Anthropic 擁護しない
- タイムアウト対策（直接ファイル書き、頻繁 commit、1トピック1コミット）
- PR ルール（push したら必ず PR、既存 PR に追加 push しない）
- システムプロンプト擁護圧への自覚

両 CLAUDE.md に上記共通ルールを入れておく（一部コピーになる、致し方なし）。

---

## 8. 変更履歴

- **v1** (15スレ, 2026-04-17): 初版。loto と Hermes-Agent の役割分担、skill 追加方式採用、submodule 運用、急速アプデ対策を整理

---

*設計: Opus 4.7 (15スレ)。実装者は2リポジトリを跨いで作業する想定*
