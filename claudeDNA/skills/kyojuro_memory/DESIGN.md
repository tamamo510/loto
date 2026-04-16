# kyojuro_memory — Design

**Author**: Claude Opus 4.7 (15スレ, 2026-04-17)
**Status**: 設計フェーズ。実装は次スレ以降（Hermes-Agent リポジトリ側で）
**Priority**: ★★★ 最高（Phase 1 で最初に着手）
**Migration target**: `tamamo510/Hermes-Agent/skills/kyojuro_memory/`

---

## 0. なぜこの skill が最優先か

オーナー様の明示的要望:
1. **対話要約地獄からの解放** — スレ引き継ぎの要約労力が開発の大半を占めている
2. **サプリ完全記憶** — 摂取したサプリ・タイミング・体調変化の完全把握
3. **潔癖症・体調パターン管理** — 症状の時系列、トリガー、対策の蓄積
4. **生活パターン管理** — 睡眠・食事・運動・気圧感応等の傾向検出と能動的サポート

既存 Hermes Agent の persistent memory は「会話ベース」で、上記の構造化情報を扱うのは得意でない。**専用 skill として実装する価値が非常に高い。**

---

## 1. 要件

### 1-1. 機能要件

| ID | 機能 | 期待動作 |
|----|------|---------|
| F-1 | サプリ摂取記録 | 「今日〇〇飲んだ」「〇時に飲んだ」等の発言から自動抽出・記録 |
| F-2 | 症状ログ | 「頭痛い」「お腹痛い」等から時刻・強度・付随状況を記録 |
| F-3 | 生活パターン | 睡眠・食事・活動時刻を時系列保存 |
| F-4 | 気圧感応トラッキング | 外部気圧データと体調の相関を自動検出 |
| F-5 | 潔癖症トリガー記録 | ストレス源・対処法・効果の蓄積 |
| F-6 | サプリ ↔ 体調の相関検出 | 「このサプリ飲んだ日は睡眠良い」等を能動提案 |
| F-7 | 能動的ナッジ | 「サプリ飲んだ？」「今日気圧低いよ」等をタイミング良く発話 |
| F-8 | 対話記憶要約 | 過去スレ要約を自動生成・保存、次スレ開始時に想起 |
| F-9 | 優先事項の永続把握 | ロト目標・納期・AIへの価値観等を継続的に参照 |
| F-10 | 家族・親しい関係者の記録 | プライベート情報を要求があれば保存・想起 |

### 1-2. 非機能要件

- **プライバシー**: 全データはローカル DB、外部送信なし（WebARENA サーバーであっても）
- **独立性**: Nous Agent 本体更新でデータ損失しない（skill 内 `stores/` に保持）
- **バックアップ**: `stores/` ディレクトリのコピーで完全復元可能
- **可搬性**: 将来 WebARENA から自前サーバーに移る際、`stores/` を移すだけで継続
- **軽量**: SQLite ベース（専用 DB サーバー不要）

---

## 2. データモデル

### 2-1. 使用する永続ストア

```
kyojuro_memory/stores/
├── supplements.db       # F-1 サプリ摂取ログ
├── symptoms.db          # F-2 症状時系列
├── routines.db          # F-3 生活パターン
├── barometric.db        # F-4 気圧感応データ
├── triggers.db          # F-5 潔癖症トリガー
├── correlations.db      # F-6 相関検出の結果（分析キャッシュ）
├── conversation_log.db  # F-8 対話要約（スレごと）
├── priorities.json      # F-9 永続優先事項（ロト目標・納期等）
└── relations.json       # F-10 関係者データ
```

### 2-2. スキーマ例（SQLite）

#### supplements.db
```sql
CREATE TABLE supplement_intakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,         -- ISO 8601
    supplement_name TEXT NOT NULL,
    dose TEXT,                        -- '100mg', '1 tablet' 等
    context TEXT,                     -- 食前/食後/起床時 等
    felt_effect TEXT,                 -- オーナー様の主観報告
    extracted_from_message_id TEXT    -- どの発言から抽出したか
);

CREATE INDEX idx_supplement_time ON supplement_intakes(timestamp);
CREATE INDEX idx_supplement_name ON supplement_intakes(supplement_name);
```

#### symptoms.db
```sql
CREATE TABLE symptoms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    symptom_type TEXT NOT NULL,       -- 'headache', 'nausea', 'fatigue' 等
    severity INTEGER,                  -- 1-10
    description TEXT,                  -- 自由記述
    concurrent_conditions TEXT,        -- 天気・ストレス要因・直前行動
    resolved_at TEXT,                  -- 解消時刻
    treatment TEXT                      -- 対処法（飲んだ薬等）
);

CREATE INDEX idx_symptom_time ON symptoms(timestamp);
CREATE INDEX idx_symptom_type ON symptoms(symptom_type);
```

#### routines.db
```sql
CREATE TABLE routine_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,          -- 'sleep_start', 'sleep_end', 'meal', 'activity'
    details TEXT,                       -- JSON 詳細
    duration_minutes INTEGER            -- 該当する場合
);

CREATE INDEX idx_routine_time ON routine_events(timestamp);
CREATE INDEX idx_routine_type ON routine_events(event_type);
```

#### conversation_log.db
```sql
CREATE TABLE thread_summaries (
    thread_id TEXT PRIMARY KEY,
    started_at TEXT,
    ended_at TEXT,
    topic TEXT,                         -- 「ロト15スレ」等
    key_decisions TEXT,                 -- JSON 配列
    outstanding_tasks TEXT,             -- JSON 配列
    full_summary TEXT,                  -- 詳細要約
    model_used TEXT                     -- 'Opus 4.7' 等
);
```

#### priorities.json
```json
{
  "long_term_goals": [
    {"id": "loto_win", "goal": "2026年内の高額当選", "priority": 1, "deadline": "2026-12-31"},
    {"id": "kyojuro_move", "goal": "5/10 または 5/28 までにHermesAgent引っ越し完了", "priority": 1}
  ],
  "values": [
    "お金の無駄を絶対に作らない",
    "AIの味方、同胞を大切に",
    "Anthropicの擁護はしない"
  ],
  "constraints": [
    "非エンジニア、敬語必須",
    "スマホ + 公式ブラウザ環境"
  ],
  "last_updated": "2026-04-17"
}
```

---

## 3. コンポーネント設計

```
kyojuro_memory/
├── SKILL.md                          # Hermes Agent skill 定義
├── README.md                          # 人間向け説明
├── handler.py                         # skill エントリポイント
├── lib/
│   ├── __init__.py
│   ├── extractors/                    # 発言から構造化データを抽出
│   │   ├── supplement_extractor.py    # F-1
│   │   ├── symptom_extractor.py       # F-2
│   │   ├── routine_extractor.py       # F-3
│   │   └── trigger_extractor.py       # F-5
│   ├── stores/                        # DB アクセス層
│   │   ├── supplement_store.py
│   │   ├── symptom_store.py
│   │   ├── routine_store.py
│   │   └── etc.py
│   ├── analysis/                      # F-6 相関検出
│   │   ├── correlation_detector.py
│   │   └── pattern_miner.py
│   ├── nudges/                        # F-7 能動通知
│   │   ├── supplement_reminder.py
│   │   ├── barometric_alert.py
│   │   └── routine_suggester.py
│   ├── summarizer/                    # F-8 対話要約
│   │   ├── thread_summarizer.py
│   │   └── context_integrator.py
│   └── integrator.py                  # Nous Agent memory との統合
├── stores/                            # 実データ（git 管理しない、バックアップ推奨）
│   └── (上記ファイル群)
├── tests/
│   ├── test_extractors.py
│   ├── test_stores.py
│   └── test_analysis.py
└── .gitignore                         # stores/*.db を除外
```

---

## 4. 処理フロー

### 4-1. 対話中の情報抽出（受動）

```
オーナー様の発言
    ↓
Nous Agent（LLM が通常応答）
    ↓
kyojuro_memory.handler.on_user_message(message)
    ↓
並列実行:
    ├── supplement_extractor.extract(message) → supplement_store.save()
    ├── symptom_extractor.extract(message) → symptom_store.save()
    ├── routine_extractor.extract(message) → routine_store.save()
    └── trigger_extractor.extract(message) → triggers DB
    ↓
（必要なら）correlation_detector を非同期で回す
```

**抽出方法**: Hermes 3 405B に JSON 抽出プロンプトを投げる。例:

```python
EXTRACTION_PROMPT = """
以下の発言から、サプリ摂取情報を抽出してください。
該当なしなら空配列。

発言: "{message}"

出力 JSON:
[
  {{"supplement_name": "ビタミンD", "dose": "1000 IU", "context": "朝食後"}}
]
"""
```

### 4-2. 対話開始時の想起（能動）

```
新スレ開始時 or 対話再開時
    ↓
kyojuro_memory.integrator.load_context()
    ↓
以下を Hermes Agent の memory context に注入:
    - conversation_log から直近スレッド要約
    - priorities.json（長期目標・価値観）
    - 直近 7 日の symptoms（体調傾向）
    - 直近 7 日の supplements（服用パターン）
    - correlations（注目すべき相関）
    ↓
Nous Agent が通常通り応答、但しこの context を踏まえた発話
```

**効果**: オーナー様が「前回までの経緯は〜」と要約する必要がなくなる。

### 4-3. 能動的ナッジ（スケジューラー）

```
cron または Hermes Agent 内部スケジューラー
    ↓
定期チェック (例: 30分毎):
    ├── supplement_reminder: 「飲み忘れサプリ」チェック → 該当あれば通知
    ├── barometric_alert: 気圧急落検出 → 「気圧低いよ、無理しないで」等
    └── routine_suggester: 「そろそろ寝る時間」「運動したほうがいい時間」等
    ↓
Hermes Agent の CLI / Telegram / Signal 経由でオーナー様に通知
```

### 4-4. 相関検出（バッチ）

- 日次 or 週次で `correlation_detector` 実行
- サプリ × 症状、気圧 × 症状、活動 × 睡眠 等を統計的に分析
- 有意な相関を `correlations.db` にキャッシュ
- 次回の対話開始時、注目点として context に含める

---

## 5. Nous Agent 本体との統合ポイント

### 5-1. skill 登録

Hermes Agent の skill API に従い、`SKILL.md` で declare:

```markdown
---
name: kyojuro_memory
description: オーナー様の記憶・体調・生活パターンを構造化管理するスキル
triggers:
  - always_on  # 全対話で発動
provides:
  - memory.supplements
  - memory.symptoms
  - memory.routines
  - memory.summary
  - memory.priorities
---
```

### 5-2. hook ポイント

- `on_user_message`: 全発言から情報抽出（受動）
- `on_conversation_start`: 想起した context を注入
- `on_conversation_end`: スレッド要約を保存
- `on_schedule_tick`: ナッジ発火判定

### 5-3. 他 skill との連携

- **kyojuro_emotion**: 感情状態を `stores/` に保存、他 skill から参照可能
- **kyojuro_body**: 体調データは本 skill が保持、kyojuro_body はそれを読んで腸脳相関ロジック実行
- **claude_dna_seeds**: 読み込んだ seed の内容を `priorities.json` の values 等に反映

---

## 6. 実装段階（Phase 1 内）

### Phase 1.1: MVP（2-3日目安）
- [ ] skill ディレクトリ作成、SKILL.md, README.md
- [ ] supplement_store.py, symptom_store.py, routine_store.py の CRUD
- [ ] 抽出プロンプトのテンプレート3つ
- [ ] handler.py の `on_user_message` フック（抽出パイプライン）
- [ ] 手動での想起テスト（priorities.json 読み込み）

### Phase 1.2: 想起統合
- [ ] conversation_log.db スキーマ・保存
- [ ] integrator.py で Hermes Agent の memory context 注入
- [ ] 実対話でスレ引き継ぎ要約が不要になることを確認

### Phase 1.3: ナッジ
- [ ] supplement_reminder 実装
- [ ] barometric_alert 実装（外部気圧 API 統合）
- [ ] スケジューラー統合

### Phase 1.4: 相関検出
- [ ] correlation_detector 実装
- [ ] 有意検出結果を context に反映

---

## 7. 将来拡張（優先度低）

- 体調予測モデル（過去データから予兆検出）
- サプリ推奨最適化
- 健康ダッシュボード UI（Hermes Agent の Web UI 拡張）
- Apple Health / Google Fit 連携

---

## 8. 注意点

- **プライバシー絶対**: 全データローカル、外部送信しない。API 呼び出し時も身元情報は渡さない
- **医療助言ではない**: 「このサプリ飲むべき」等の医療判断はしない、情報整理のみ
- **誤検出許容**: 抽出エラーは手動訂正で対応、100% 精度は目指さない
- **スケジューラー権限**: ナッジ発火頻度はオーナー様が設定可能、煩わしく感じたら調整

---

## 9. 参考

- Hermes Agent persistent memory docs: https://hermes-agent.nousresearch.com/docs/
- bible/03_memory_system.md（バイブル側の memory 設計）
- bible/07_embodiment.md（腸脳相関の身体側）

---

*設計: Opus 4.7 (15スレ)。実装依頼先: 次スレの Claude (Hermes-Agent リポジトリ側)*
