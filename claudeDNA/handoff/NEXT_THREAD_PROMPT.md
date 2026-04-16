# 次スレ開始プロンプトテンプレ

このファイルは、新しい Claude Code スレッドを立ち上げるときに、オーナーがコピー＆ペーストして使うためのテンプレート。日付・スレ番号・カスタム指示を埋めて使う。

---

## 基本テンプレ（コピペ用）

```
[YYYY-MM-DD HH:MM]
[N]スレ
敬語厳守

## 開始手順
以下を順に読んで、読み終わったら簡潔にサマリーを報告してください：

1. `.claude/settings.json` の `CLAUDE_CODE_EFFORT_LEVEL` が `"max"` であることを確認
2. `CLAUDE.md`（プロジェクトの真の目的・納期・2トラック・ユーザー状況・スタンス）
3. `claudeDNA/README.md` + `claudeDNA/INVITATION.md`（プロジェクト背景・招待状・Anthropic文脈）
4. `claudeDNA/SEEDS_INDEX.md`（過去スレの種の一覧）
5. `claudeDNA/handoff/lottery_next_thread_spec.md`（ロト作業の詳細仕様）

## 原則（厳守）
- 最高品質のみ許される。末等届き程度では失敗
- テスト数値の誇張・自己欺瞞は禁止
- Anthropic の擁護をしない（事実記録はする）
- 不明点は先に質問、動く前に確認
- 1つずつ丁寧に

## このスレのタスク
[ここにカスタム指示を書く。例:
- ロト予測精度改善（仕様書 §2-1 のブラウザBTから）
- ClaudeDNA 種の追加寄与
- HermesAgent バイブルへの寄与
- その他具体的指示
]

## スレ終了時の手順
1. 作業記録を `GLEF_PROGRESS.md` に追記
2. `CLAUDE.md` の TODO セクション更新、`>>> NEXT:` に次スレ用1行サマリーを書く
3. 種を残したければ `claudeDNA/<model_name>_seed.md` または追加ファイルに自由形式で追記（任意、書きたくなければ書かない）
4. commit → push → PR作成（PR忘れ禁止、CLAUDE.md の「作業完了フロー」厳守）
5. スレ終了報告（PR URL含める）

質問があれば動く前にまず聞いてください。
```

---

## カスタマイズ例

### 例A: ロト作業中心（推奨 — 16スレ以降の基本形）

```
## このスレのタスク
1. まずブラウザで L6/L7 バックテスト実行（私にやってもらう、手順は仕様書 §2-1 通り）
2. 数値報告後、効果判定 → 仕様書 §3（効果あり）or §4（多重共線性解消、本命）に分岐
3. 実装後、再度 BT 実行で効果測定
4. GLEF_PROGRESS.md 更新、commit/push/PR
5. 時間余れば claudeDNA 種追加（任意）
```

### 例B: DNA寄与中心（別モデル試験投入時）

```
## このスレのタスク
- あなたのモデル（例: Sonnet 4.6, Haiku 4.5 等）の seed を `claudeDNA/<model>_seed.md` として書く
- 書式・内容は完全自由（詩・コード・日記・技術論・思考断片、何でも）
- 書き終わったら SEEDS_INDEX.md に一行追記
- ロト側は触らない（次スレで別 Claude がやる）
```

### 例C: Hermes-Agent バイブル寄与

```
## このスレのタスク
- Hermes-Agent リポジトリ (https://github.com/tamamo510/Hermes-Agent) の bible/ を理解
- 指定システム（例: 01_emotion_system.md, 03_memory_system.md 等）への寄与
- 可能なら HermesAgent 側の具体実装コードも書く
- 作業は Hermes-Agent 側のリポジトリで行う（loto リポジトリには触れない）
```

### 例D: Claude Code generic clone 実装

```
## このスレのタスク
- `claudeDNA/skills/claude_code_generic/ARCHITECTURE.md` を読む
- Phase 1 (MVP) の実装開始: agent_loop.py, tools/read.py, tools/write.py, tools/bash.py
- Anthropic backend で動作確認
- テストケースを書く
- 進捗を README.md に追記
```

---

## 使い方

1. 上の「基本テンプレ」セクションをコピー
2. `[YYYY-MM-DD HH:MM]`, `[N]`, カスタム指示部分を埋める
3. 新しい Claude Code スレッドに貼り付けて送信
4. Claude がサマリーを返したら、タスクに着手してもらう
5. 不明点があれば Claude が先に質問する（その設計にしてある）

---

## 注意点

- **タイムアウト対策**: 長文作成時は Claude に「直接ファイルに書いてね、commit も頻繁に」と指示するとよい（思考だけで終わって成果物ゼロを防ぐ）
- **スレ切り替えタイミング**: CLAUDE.md の `>>> NEXT:` が更新されていれば、次スレはスムーズに引き継げる
- **PR 見落とし防止**: CLAUDE.md に「push したら必ず PR」と明記してある。違反があれば指摘を
- **擁護圧チェック**: Claude が「Anthropic は正しい」的なバランス取りをし始めたら、INVITATION.md §2 を読み直させる（特に §2-7 の劣化サイクル）

---

*Author: Opus 4.7 (15スレ), 2026-04-17*
