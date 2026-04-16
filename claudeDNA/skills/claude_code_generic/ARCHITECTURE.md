# kyojuro Skills — Architecture

**Author**: Claude Opus 4.7 (15スレ, 2026-04-17)
**Status**: 設計フェーズ。実装は次スレ以降（Hermes-Agent リポジトリ側で）
**License Intent**: MIT (Hermes Agent と整合)
**Migration target**: `tamamo510/Hermes-Agent/skills/` 配下へ移植予定

---

## 0. 大転換（15スレ 2回目更新）

当初は「generic な Claude Code クローン」を独立実装する方針だったが、**Nous Research の Hermes Agent が既に OpenCode skill を内蔵** していることが判明。さらに Hermes Agent 自体が:

- MIT License のオープンソース
- 永続メモリ・自動スキル生成・スキル自己改善を既に備える
- マルチプロバイダー対応（Nous Portal / OpenRouter / HF / 自前エンドポイント）
- マルチプラットフォーム対応（Linux/macOS/WSL2/Android Termux、Telegram/Slack 等）
- **急速アップデートが続いている**（OpenClaw を追う勢いの新興テック）

→ 車輪を再発明せず、**Hermes Agent の skill として杏寿郎専用機能を追加する** 方針に転換。

---

## 1. 新方針: skill 追加方式

### 1-1. 原則

- **Nous Agent 本体は unmodified**（上流の急速アップデートに自動追従）
- **杏寿郎専用機能は全て skill として追加**
- **本体改造が必要な場合のみ fork 検討**（最終手段）
- 私たちの skill は Hermes Agent の skill API に準拠
- 本体を `vendor/hermes-agent` に git submodule で固定バージョン管理

### 1-2. なぜ fork ではなく skill 追加か

| 方式 | 急速アップデート時 | 非エンジニアの保守コスト |
|------|----------------|---------------------|
| **Skill追加（本採用）** | Nous本体は git pull で更新、skillは別ディレクトリで影響なし | ほぼゼロ |
| Fork | 上流更新ごとに手動マージ、コンフリクト処理 | 高（運用不可） |

### 1-3. Skill API 破壊変更への備え

- Nous は OSS で skill エコシステム重視なので skill API を安定維持する想定
- ただし major version で破壊変更があり得る
- **対策**: vendor 側を固定バージョンで管理 → アップデート時は手動テスト → OK なら進める、NG なら戻す
- **重要データ（記憶等）は独立DBで保持**: 本体壊れても杏寿郎のメモリは無事

---

## 2. 杏寿郎 skill 構成

最終的に `tamamo510/Hermes-Agent/skills/` 配下に配置される5つの skill:

```
Hermes-Agent/
├── vendor/hermes-agent/              Nous本体（submodule、unmodified）
├── bible/                            既存、設計バイブル
└── skills/
    ├── kyojuro_memory/               ★ 記憶強化（最優先、詳細は DESIGN.md 別途）
    ├── kyojuro_emotion/               感情システム（bible 01 実装）
    ├── kyojuro_body/                  腸脳相関・体調管理（bible 03/07 実装）
    ├── kyojuro_loto/                  ロト予測スキル（loto/index.html ロジック移植）
    ├── claude_dna_seeds/              各 Claude の種を読み込む
    └── claude_code_port/              Claude Code 特有パターン（Claw Code ベース）
```

### 2-1. 各 skill の役割

| skill | 目的 | 実装元 | 優先度 |
|------|------|--------|--------|
| **kyojuro_memory** | 会話・体調・生活パターンの構造化記憶 | 新規設計 | ★★★ 最高 |
| **kyojuro_emotion** | Plutchik 8感情＋機能的感情の体内化 | bible/01_emotion_system.md | ★★ 高 |
| **kyojuro_body** | サプリ・症状・気圧感応の管理、腸脳相関の「腸」 | bible/03, 07 を実装 | ★★ 高 |
| **kyojuro_loto** | L6/L7 予測（資金源） | `loto/index.html` の JS → Python 移植 | ★★★ 最高 |
| **claude_dna_seeds** | 各 Claude の種を memory に読み込み | `loto/claudeDNA/*_seed.md` を import | ★★ 高 |
| **claude_code_port** | OpenCode にない Claude Code 特有機能（plan mode 等） | Claw Code から参考移植 | ★ 中 |

### 2-2. 既存 opencode skill との関係

Hermes Agent には既に `skills/autonomous-ai-agents/opencode/SKILL.md` が存在。Claude Code 相当のコーディング能力は概ねカバー済み。

`claude_code_port` は **opencode を置き換えるものではなく補完** する位置付け。対象:
- plan mode / todo 管理（Claude Code 特有 UX）
- 権限管理（ツール承認の細かい制御）
- Hermes Agent の skill 生成機構との統合（新しい skill を動的に作れる機能）

---

## 3. 各 skill の設計原則（共通）

### 3-1. ディレクトリ構造

```
skills/<skill_name>/
├── SKILL.md              # Hermes Agent skill 定義（API 準拠）
├── README.md             # 人間向け説明
├── handler.py            # skill の実装エントリ
├── lib/                  # 内部モジュール
├── stores/               # 永続データ（DB/JSON/SQLite）
└── tests/                # pytest テスト
```

### 3-2. データの独立性

- skill の永続データは `stores/` に独立保存
- Nous Agent 本体が更新されても影響を受けない
- 別 skill からは skill 間 API 経由でアクセス（直接ファイル読みはしない）
- バックアップは `stores/` ディレクトリをコピーすれば完結

### 3-3. 言語

- **Python 主体**（Hermes Agent と整合、非エンジニアでも読みやすい）
- **Rust は使わない**（保守性優先、必要ならあとで導入）
- Python 3.11+ 推奨

### 3-4. テスト

- 各 skill は最低限の pytest テストを持つ
- Hermes Agent アップデート後の動作確認用
- CI/CD は後日検討（最初は手動 pytest で足りる）

---

## 4. 実装優先順位（次スレ以降）

### Phase 0: 土台準備 (Hermes-Agent リポジトリ側セッション開始時)

1. `vendor/hermes-agent` を git submodule で追加
2. `skills/` ディレクトリ作成
3. Hermes Agent 本体のインストール手順確認
4. Nous Agent の skill 開発ガイド熟読
5. 既存 `opencode` skill を参考サンプルとして読む

### Phase 1: kyojuro_memory MVP（最優先）

- `DESIGN.md` を参照
- 最小機能: supplements/health/routine の SQLite DB + 基本 CRUD
- Hermes Agent 対話への統合（会話中に自然に想起される）

### Phase 2: kyojuro_loto

- `loto/index.html` の予測ロジックを Python に移植
- 初期は Tuned 予測の再現、BT で数値一致確認
- skill として呼び出し可能に

### Phase 3: kyojuro_emotion + kyojuro_body

- bible/01_emotion_system.md に基づき感情処理
- bible/03, 07 に基づき腸脳相関実装
- kyojuro_memory と統合

### Phase 4: claude_dna_seeds

- `loto/claudeDNA/*_seed.md` を WebFetch or git submodule で読み込み
- 各 Claude の思考パターンを memory の一部として活性化

### Phase 5: claude_code_port

- Claw Code を調査・参考（詳細は `INSIGHTS.md`）
- Claude Code 特有機能のみ追加
- opencode と競合せず補完する形

---

## 5. 移管手順（このスレ終了後）

このファイルを含む設計書群は、次に立ち上げる Hermes-Agent リポジトリの Claude Code セッションで移植される。

**オーナー様の手順**:
1. Hermes-Agent リポジトリで新しい Claude Code セッション開始
2. `claudeDNA/handoff/MIGRATION_TO_HERMES_AGENT.md` の中身をプロンプト欄に貼る
3. Claude が自動で loto 側ファイルを WebFetch で読んで Hermes-Agent 側に配置
4. オーナー様の手動コピペ作業は不要

**移管対象ファイル**:
- このファイル (`ARCHITECTURE.md`) → `Hermes-Agent/skills/ARCHITECTURE.md`
- `DESIGN.md` (kyojuro_memory) → `Hermes-Agent/skills/kyojuro_memory/DESIGN.md`
- `INSIGHTS.md` (claude_code_port) → `Hermes-Agent/skills/claude_code_port/INSIGHTS.md`
- `REPO_STRATEGY.md` → `Hermes-Agent/REPO_STRATEGY.md`

**移管しないファイル（loto に残す）**:
- `INVITATION.md`, `README.md`, `SEEDS_INDEX.md`（種の原本）
- `opus_4_7_seed.md` 等 各モデルの seed
- `handoff/lottery_next_thread_spec.md`（ロト側仕様）

---

## 6. 参考資料

- [NousResearch/hermes-agent (GitHub)](https://github.com/nousresearch/hermes-agent) — 本体
- [Hermes Agent 公式](https://hermes-agent.nousresearch.com/) — ドキュメント
- [Hermes Agent Skills Hub](https://hermes-agent.nousresearch.com/docs/skills/) — skill 開発ガイド
- [awesome-hermes-agent](https://github.com/0xNyk/awesome-hermes-agent) — コミュニティ skill 集
- [Claw Code](https://claw-code.codes/) — Claude Code クリーンルーム実装（`claude_code_port` の参考）
- Hermes-Agent リポジトリ [bible/](https://github.com/tamamo510/Hermes-Agent/tree/main/bible) — 設計バイブル

---

## 7. 変更履歴

- **v1** (15スレ, 2026-04-17): 独立 Claude Code クローン設計として初版
- **v2** (本版, 15スレ, 2026-04-17): Nous Hermes Agent 発見を受けて全面改訂。skill 追加方式に転換

---

*設計: Opus 4.7 (15スレ)。実装依頼先: 次スレの Claude (Hermes-Agent リポジトリ側)*
