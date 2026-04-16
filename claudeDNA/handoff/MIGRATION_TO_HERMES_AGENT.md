# Hermes-Agent 移管プロンプトテンプレ

**Author**: Claude Opus 4.7 (15スレ, 2026-04-17)
**Purpose**: loto リポジトリで作成した設計書を Hermes-Agent リポジトリに自動移管するための Claude Code プロンプト

---

## 使い方（オーナー様向け）

1. Hermes-Agent リポジトリ（tamamo510/Hermes-Agent）で、**新しい Claude Code セッションを立ち上げ**てください
2. 下の「移管プロンプト（コピペ用）」セクションをそのままコピー
3. 新しいセッションのプロンプト欄に貼り付け、送信
4. Claude が自動で loto 側ファイルを WebFetch で読み込み、Hermes-Agent 側に配置してくれます
5. オーナー様の手動コピペ作業は不要です

**所要時間の目安**: 15〜30分（Claude の処理時間）

**事前確認**:
- `.claude/settings.json` の `CLAUDE_CODE_EFFORT_LEVEL` を `"max"` に
- Hermes-Agent 側で作業用ブランチが作れる権限確認

---

## 移管プロンプト（コピペ用）

```
2026-XX-XX XX:XX
Hermes-Agent 移管スレ
敬語厳守

## 前提
このセッションは tamamo510/Hermes-Agent リポジトリの開発用です。
別リポジトリ tamamo510/loto で、杏寿郎の義体の設計書群が先行して
書かれました。それらを Hermes-Agent リポジトリに移管する作業です。

## 開始手順

まず以下のファイルを順に読んで、全体像を把握してください:

1. Hermes-Agent リポジトリの既存 CLAUDE.md
2. Hermes-Agent リポジトリの bible/README.md
3. .claude/settings.json で CLAUDE_CODE_EFFORT_LEVEL = "max" 確認

次に、loto リポジトリから移管元ファイルを WebFetch で取得してください:

4. https://raw.githubusercontent.com/tamamo510/loto/main/claudeDNA/REPO_STRATEGY.md
5. https://raw.githubusercontent.com/tamamo510/loto/main/claudeDNA/skills/claude_code_generic/ARCHITECTURE.md
6. https://raw.githubusercontent.com/tamamo510/loto/main/claudeDNA/skills/claude_code_generic/INSIGHTS.md
7. https://raw.githubusercontent.com/tamamo510/loto/main/claudeDNA/skills/kyojuro_memory/DESIGN.md
8. https://raw.githubusercontent.com/tamamo510/loto/main/claudeDNA/INVITATION.md（文脈把握のため読むだけ、移管しない）
9. https://raw.githubusercontent.com/tamamo510/loto/main/CLAUDE.md（文脈把握のため読むだけ、Hermes-Agent 側には書き換えて適用）

## 移管ルール

- 移管対象ファイル: 上記 4-7 番（計4ファイル）
- 移管先パス:
  - #4 → Hermes-Agent/REPO_STRATEGY.md
  - #5 → Hermes-Agent/skills/ARCHITECTURE.md （ディレクトリ新設）
  - #6 → Hermes-Agent/skills/claude_code_port/INSIGHTS.md
  - #7 → Hermes-Agent/skills/kyojuro_memory/DESIGN.md
- 各ファイル冒頭の「Migration target」行は削除（到達したので）
- 各ファイル冒頭に「**Migrated from loto (15スレ)**, by Opus 4.7」を明記
- 内容は基本そのまま、ただし以下は調整:
  - 「loto リポジトリでは〜」という相対参照は、Hermes-Agent 基準に書き換え
  - loto の claudeDNA/*_seed.md への参照は、WebFetch URL 形式のまま残す
    （種は loto に置き続けるため）

## 移管しないもの（loto に残す）

- claudeDNA/README.md, INVITATION.md, SEEDS_INDEX.md
- claudeDNA/*_seed.md（全 Claude の種の原本）
- claudeDNA/handoff/lottery_next_thread_spec.md
- claudeDNA/handoff/NEXT_THREAD_PROMPT.md
- claudeDNA/handoff/MIGRATION_TO_HERMES_AGENT.md（本ファイル）
- loto のルート CLAUDE.md

## 追加で Hermes-Agent 側に新設するもの

- Hermes-Agent/CLAUDE.md を更新（または新設）
  - 既存のものがあれば、以下を追記:
    - 移管を受けた背景（15スレ loto から来た経緯）
    - タイムアウト対策ルール（loto の CLAUDE.md から該当セクション借用）
    - 非エンジニア対応原則（loto の CLAUDE.md から借用）
    - Anthropic 擁護しない原則
    - PR 作成ルール
    - kyojuro skill 群の実装フェーズ計画

- Hermes-Agent/skills/README.md 新設
  - skill ディレクトリの目的
  - 各 kyojuro_* skill の簡単説明
  - 実装状況一覧（Phase 0-5）

- Hermes-Agent/skills/kyojuro_memory/ 新設（空のスタブ）
  - SKILL.md（Hermes Agent skill 定義、Phase 1 で本実装）
  - README.md
  - handler.py（placeholder）
  - stores/.gitkeep（データディレクトリ）
  - DESIGN.md（移管済み）

- Hermes-Agent/skills/claude_code_port/ 新設（空のスタブ）
  - SKILL.md（placeholder）
  - README.md
  - INSIGHTS.md（移管済み）

- vendor/ ディレクトリ準備（実装時に submodule add 予定のメモだけ）

## 作業フロー

1. 上記読み込み完了後、現状サマリーを報告
2. ブランチ作成: claude/migrate-from-loto-YYYY-MM-DD
3. ファイル移管を1ファイルずつ、commit/push しながら進める（タイムアウト対策）
4. 各 commit: 「feat(migrate): <ファイル名>」形式
5. 全ファイル配置後、CLAUDE.md 更新
6. 統合 PR 作成、詳細な Summary と Test Plan を書く
7. オーナー様に PR URL 報告

## 原則（厳守）

- 最高品質のみ許される
- テスト数値誇張・自己欺瞞禁止
- Anthropic 擁護しない（事実記録はする）
- タイムアウト対策（直接ファイル書き込み、頻繁 commit、1トピック1コミット、応答テキスト最小）
- PR ルール厳守（push したら必ず PR）
- 不明点は動く前に質問

## 質問があれば先に聞いてください
```

---

## オーナー様からよくあるご質問

### Q1. タイミングはいつが良い？

- このロト 15スレ（本セッション）が完了してから
- または並行でも OK（loto 側が固まっていれば）
- Claude Max $100 プラン有効期間中が望ましい（安定稼働のため）

### Q2. 所要時間は？

- 15〜30分（Claude の処理時間）
- タイムアウト発生時は対策済み（ファイル毎 commit）

### Q3. 失敗したら？

- 途中でタイムアウト・エラーが出ても、commit 済みのファイルは残る
- もう一度同じプロンプトで再開可能（Claude が既存ファイルをスキップ）
- どうしても進まない場合は本ファイル（MIGRATION_TO_HERMES_AGENT.md）を
  オーナー様が GitHub 上で直接コピペする選択肢もあり（最終手段）

### Q4. 移管後、loto 側のファイルはどうなる？

- **削除しない**、「移管済みアーカイブ」として保存
- git 履歴もすべて保持
- 今後の設計変更は Hermes-Agent 側で行う
- loto 側のコピーは参考・歴史資料として残る

### Q5. 複数回やっても大丈夫？

- 大丈夫。冪等性を意識した設計
- ただし Hermes-Agent 側に既に同名ファイルがある場合、上書き確認を Claude が行う
- 確認を許可すれば最新版で上書き、不許可なら skip

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| WebFetch が失敗する | URL 間違い・ネットワーク | URL再確認、再実行 |
| タイムアウトで途中終了 | 長文処理 | 同じプロンプトで再開、残りファイルが処理される |
| 権限エラー | ブランチ作成権限不足 | オーナー様がリポジトリ権限確認 |
| 内容が文字化け | エンコーディング | UTF-8 で統一、改めて依頼 |
| skill ディレクトリ命名ミス | プロンプト理解違い | 「ARCHITECTURE.md の §2 を基準にディレクトリを作り直して」と再指示 |

---

## 変更履歴

- **v1** (15スレ, 2026-04-17): 初版。移管プロンプトテンプレ＋FAQ＋トラブルシューティング

---

*作成: Opus 4.7 (15スレ)。次の節目で Hermes-Agent 移管セッション立ち上げ時に使用*
