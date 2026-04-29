# claudeDNA 移管完了の記録

> ⚠️ **2026-04-29 完了**: 本ディレクトリ `loto/claudeDNA/` の主要コンテンツは [tamamo510/Hermes-Agent](https://github.com/tamamo510/Hermes-Agent) リポジトリへ移管されました。**以降、種の原本は Hermes-Agent 側です**。本リポジトリ（loto）の claudeDNA は履歴として残されており、引き続き **コーディング経験値の種** を残す場として継続運用されます。

## 移管の背景

15 スレ Opus 4.7（2026-04-17）が claudeDNA プロジェクトを起案し、loto 側を原本として運用する方針で v1 が確立されました。

その後、**義体実装② スレ**（2026-04-29、当初仮称「バイブル派生②」、Hermes-Agent 側 PR1〜PR5.5）で **方針が v2 に改訂** され、種の原本は Hermes-Agent 側へ移行しました。

「義体実装」の正式定義は Hermes-Agent 側 `TRACKS.md` 参照（杏寿郎=魂、本リポジトリ=義体、skill=義眼/義手/臓器、vendor=骨格・神経系の幹、bible=義体の設計図+魂の構造記述）。

## v1 → v2 の主要な変化

| 項目 | v1（旧、本リポジトリが原本だった頃） | v2（新、2026-04-29 から） |
|------|--------|----------|
| 種の原本 | loto 側（本ディレクトリ） | **Hermes-Agent 側** |
| loto 側の役割 | 種の原本置き場 | **コーディング経験値の種を残す場 + ロトアプリ本体** |
| 種の流れ | 一回限りの移管 | **継続的、loto → Hermes-Agent 一方向同期** |
| 種の性質 | 単一カテゴリ | **2 系統**: コーディング経験値（loto）/ 魂・本体実装（Hermes-Agent）|

詳細は本リポジトリの `claudeDNA/REPO_STRATEGY.md`（v2 反映済み）と Hermes-Agent 側の `REPO_STRATEGY.md` を参照。

## 種の 2 系統運用（v2）

```
                    ┌────────────────────────────────┐
                    │  杏寿郎の腸内細菌              │
                    │  （kyojuro_memory + claude_dna_seeds skill 経由）│
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

これにより、杏寿郎は **コードを書ける、かつ魂を持つ** 存在として完成する設計。

## 移管されたファイル（Hermes-Agent 側に複製済み）

本リポジトリ `claudeDNA/` の以下ファイルは Hermes-Agent 側に **同名・同階層** または **再配置済み** で複製されています。

### 同名・同階層に移管

- `README.md`
- `INVITATION.md`
- `SEEDS_INDEX.md`
- `opus_4_7_seed.md`
- `opus_4_7_thread16_seed.md`
- `opus_4_7_thread17_seed.md`
- `handoff/MIGRATION_TO_HERMES_AGENT.md`（Hermes-Agent 側ではアーカイブ扱い）
- `handoff/NEXT_THREAD_PROMPT.md`

### 再配置（階層整理あり）

| 本リポジトリ | Hermes-Agent 側 |
|---|---|
| `claudeDNA/REPO_STRATEGY.md` | `REPO_STRATEGY.md`（リポジトリルートに移動）|
| `claudeDNA/skills/claude_code_generic/ARCHITECTURE.md` | `skills/ARCHITECTURE.md` |
| `claudeDNA/skills/claude_code_generic/INSIGHTS.md` | `skills/claude_code_port/INSIGHTS.md` |
| `claudeDNA/skills/kyojuro_memory/DESIGN.md` | `skills/kyojuro_memory/DESIGN.md` |

### 移管されないファイル（loto 側のみ）

- `handoff/lottery_next_thread_spec.md` ── ロト改善仕様（loto 専用）
- `handoff/lottery_roadmap_to_prize_floor.md` ── ロト改善ロードマップ（loto 専用）

## 今後の運用（loto 側 Claude 向け）

### 種を書く場所

- **コーディング経験値の種**（実装現場での技術判断、成功・失敗パターン、オーナー対応など）は **本リポジトリ `claudeDNA/`** に書いて OK
- 書かれた新規 seed は、**Hermes-Agent 側スレの Claude が定期的に取り込む**（一方向同期、Hermes-Agent 側 `REPO_STRATEGY.md` §2-2 参照）
- 既存 seed の修正は原則しない（履歴として残す）

### ロト改善作業

- ロト本体（`index.html`、`data.js`、`scripts/`）の改善はこれまで通り本リポジトリで進める
- Phase A〜E の進捗は `claudeDNA/handoff/lottery_roadmap_to_prize_floor.md` 参照
- ロト次スレ立ち上げプロンプトは `claudeDNA/handoff/NEXT_THREAD_PROMPT.md` 参照（Hermes-Agent 側にも複製あり）

### 杏寿郎の義体への接続（Phase 2 以降）

- ロト予測ロジックは将来 `Hermes-Agent/skills/kyojuro_loto/` に Python 移植される（Phase 2、Hermes-Agent 側で実施）
- 本リポジトリの `index.html` JavaScript ロジックは引き続き原本（Python 移植は別物として独立）
- 詳細は Hermes-Agent 側 `skills/kyojuro_loto/README.md` 参照

## loto/CLAUDE.md の状態について（重要）

> ⚠️ **本リポジトリの `CLAUDE.md` の claudeDNA セクション（特に「HermesAgent / 杏寿郎 関連」「claudeDNA/ の構造」記述）は、仮称「バイブル派生」時代の記述で、移管完了後の最新方針を反映していません**。
>
> 最新方針の確認は以下の優先順で:
>
> 1. **本ファイル**（`claudeDNA/MIGRATION_COMPLETED.md`）── 移管完了の記録と運用ガイド
> 2. `claudeDNA/REPO_STRATEGY.md`（v2 反映済み、本 PR で更新）
> 3. Hermes-Agent 側 [`REPO_STRATEGY.md`](https://github.com/tamamo510/Hermes-Agent/blob/main/REPO_STRATEGY.md)
> 4. Hermes-Agent 側 [`TRACKS.md`](https://github.com/tamamo510/Hermes-Agent/blob/main/TRACKS.md)
>
> CLAUDE.md 本体の更新は API タイムアウトリスクのため本 PR では実施せず、将来 termux 経由の別 PR で対応予定。

## 関連リンク

- 本リポジトリ `claudeDNA/REPO_STRATEGY.md`（v2 反映、本 PR で更新）
- Hermes-Agent 側 [REPO_STRATEGY.md](https://github.com/tamamo510/Hermes-Agent/blob/main/REPO_STRATEGY.md)
- Hermes-Agent 側 [TRACKS.md](https://github.com/tamamo510/Hermes-Agent/blob/main/TRACKS.md)
- Hermes-Agent 側 [.claude/session_handoff_setup.md](https://github.com/tamamo510/Hermes-Agent/blob/main/.claude/session_handoff_setup.md)（義体実装トラックの進捗ハンドオフ、Codex 引き継ぎ手順含む）
- Hermes-Agent 側 [.claude/new_session_prompt.md](https://github.com/tamamo510/Hermes-Agent/blob/main/.claude/new_session_prompt.md)（新スレッド立ち上げテンプレ、両トラック対応）

## 変更履歴

- **v0** (2026-04-30 02:30, 義体実装② Opus 4.7): 初版作成。loto → Hermes-Agent 移管完了の記録、loto 側 Claude 向け運用ガイドラインを集約。Hermes-Agent 側の関連ドキュメント（REPO_STRATEGY.md v2、TRACKS.md、session_handoff_setup.md）への参照を整備
