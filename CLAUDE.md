# GLEF — Gravity Loto Engine Framework

## これは何？
ロト6/ロト7の予測アプリ。HTML+JS単一ファイル(`index.html`)でGitHub Pages運用。
マイホーム資金のための長期プロジェクト。予測精度が最優先。

---

## 現在の状態

| 項目 | 値 |
|------|-----|
| バージョン | v7.11-stable |
| 異常回検出率 | Loto6: 44.5%(5条件) / Loto7: 37.1%(4条件、狭帯域無効) |
| mainブランチ | v7.6.2-unified-data |
| エントリポイント | `index.html` |
| データ | Loto6 R2093まで / Loto7 R672まで（GitHub Actionsで自動更新） |
| データ自動取得 | sougaku.com 詳細ページ + リストページ |
| セット球 | data.jsの各エントリ末尾に統合済み（r[5]）、drawオブジェクトの`setBall`プロパティ |
| CO修正 | INT32_MAXオーバーフロー自動修正済み（autoFetchで検出・補完）|
| 理論数 | 20 active + マルチシグナル削除分析 + Cold Pool排除 + Seeded PRNG |

### 精度（バックテスト直近20回、v7.11 CMA-ESチューニング済み ※Node.js検証値、ブラウザ確認後更新）
| ゲーム | Avg Hits | Tuned AvgHit | ランダム基準 | 改善率 | Max Hits |
|--------|----------|-------------|-------------|--------|----------|
| Loto7 | **1.50** | **2.19** | 1.32 | **+13%** | **3** |
| Loto6 | **0.90** | **1.14** | 0.84 | **+7%** | **3** |

---

## 波形エンジン（11成分 + CMA-ES乗数）

| # | Wave | 乗数 | 概要 |
|---|------|------|------|
| 1 | depthWave | depthMult | ギャップ分析（期待ギャップからの乖離） |
| 2 | vertWave | vertMult | 時間軸同期（直近3回+WMA） |
| 3 | horzWave | horzMult | ゾーンMACD |
| 4 | crossWave | crossMult | 共起行列+相互情報量（キャップ30） |
| 5 | coBias | coMult | キャリーオーバー偏り |
| 6 | fourierWave | fourierMult | FFT周期性検出 |
| 7 | markovWave | markovMult | マルコフ連鎖ゾーン遷移 |
| 8 | rqaWave | rqaMult | 再帰定量化分析(RQA) |
| 9 | coldWave | coldMult | 削除数字自力導出（Z-score+最大ギャップ+短期冷却） |
| 10 | setWave | setMult | セット球条件付き確率（マルコフ遷移予測） |
| 11 | crossLotoBias | crossLotoMult | クロスロト引っ張り（Loto6↔Loto7間条件付き確率） |

---

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `index.html` | アプリ本体（HTML+CSS+JS全て1ファイル） |
| `data.js` | 抽選データ + セット球データ（GitHub Actionsで自動更新） |
| `scripts/update_data.py` | sougaku.comからデータ自動取得スクリプト |
| `.github/workflows/update-data.yml` | data.js自動更新ワークフロー（Loto6月木/Loto7金） |
| `CLAUDE.md` | **本ファイル。スレッド開始時に必ず読む** |
| `GLEF_PROGRESS.md` | 開発履歴（全バージョンの変更・バックテスト記録） |
| `GLEF_README.md` | プロジェクト理念・等級定義・作業ルール |
| `GLEF_PREDICTIONS.jsonl` | 予測蓄積（追記のみ、上書き禁止） |
| `GLEF_RESULTS.jsonl` | 抽選結果と照合データ |
| `glef_predict.js` | Node.js予測エンジン（v7.3対応、v7.5未対応） |
| `archive/` | 過去バージョン |

---

## TODO（優先順）

>>> NEXT: ブラウザでバックテスト確認（v7.11でConfidence安定化が効いているか）→ 精度改善の次手検討
- [x] **setWave実装** — v7.7で完了。セット球条件付き確率Wave（マルコフ遷移予測）、10番目のWave + CMA-ES `setMult` 追加
- [x] **クロスロト引っ張り** — v7.8で完了。`crossLotoBias` Wave（11番目）+ CMA-ES `crossLotoMult` 追加。日付ベース他ロト参照+歴史的リフト率
- [x] **異常回定義拡張** — v7.9で完了。3連番+奇偶極端+狭帯域集中(L6のみ)追加。Loto6: 12.7%→44.5%、Loto7: 24.4%→37.1%(狭帯域は独自新規4%・重複83%のため無効化)
- [x] **Anomaly RiskにCO補正** — v7.9で完了。Loto7: +6.7pt、Loto6: +3.2pt。ワイブルベースリスクに加算
- [x] **削除候補GA反映バグ修正** — v7.10で完了。coldWaveに短期冷却ペナルティ追加（直近30回窓、0回:-8/1回:-5/2回:-2）。Loto6で8/43数字に新ペナルティ
- [x] **Confidenceスケーリング微調整** — v7.10で完了。感度緩和(×60→×40)+上限引き上げ(75→85%)。AvgHit=1.12で62%に適正化
- [x] **digitPen差し戻し** — 11スレで削除。L6後退(1.35→1.30)の原因。gaFitnessのdigitPen・deterministicPickの末尾集中制限・Confidenceブレンドを除去（末尾ペアナッジはfitness比較ガード付きで残存）
- [x] **削除候補のONE SHOT排除** — v7.11で完了。buildDeletionAnalysisの全4カテゴリ(coldStrong/recentCold/multiCold/bottomScore)をdelSetとしてpool/GA/ANTI-THEORYから完全除外。全5パス適用
- [x] **Confidence安定化** — v7.11で完了。seeded PRNG(mulberry32)によりCMA-ES・backtest・deterministicPickが完全決定的。同データ→同結果保証
- [ ] **glef_predict.js v7.11対応** — Node.js版がv7.3のまま

---

## 重要な設定値

```
CFG.loto7 = { max:37, pick:7, bCnt:2, sumR:[100,200], renKill:5, conFilt:3 }
CFG.loto6 = { max:43, pick:6, bCnt:1, sumR:[90,185], renKill:4, conFilt:3 }
GA_CFG = { popSize:100, generations:200, eliteCount:5, tournamentSize:3, mutationRate:0.1 }
CMA-ES = { lambda:16, mu:8, sigma0:0.3, maxGen:50, bounds:[0.2,2.5] }
learnedParams default = all 1.0 (11 params: depth/vert/horz/cross/co/fourier/markov/rqa/cold/set/crossLotoMult)
crossWave cap = 30, carry max = 1, overlap max = 3
crossLotoBias range = [-5, +8], otherLoto date-filtered
coldWave range = [-25, +5] (Z-score + maxGap + recentPen30)
Confidence = base35, hitBonus(liftRatio×40, cap25), prizeBonus(cap20), maxBonus(cap10), range [25,85], 直近20回のみ（ブレンドなし）
Cold exclusion = buildDeletionAnalysis全4カテゴリ(coldStrong/recentCold/multiCold/bottomScore)→ pool/GA/ANTI-THEORY全除外（safety: pool<pick*2で無効）
Seeded PRNG = mulberry32(_drawSeed), CMA-ES/backtest/deterministicPick全対象
```

---

## 絶対ルール

1. **作業前にこのファイルを読む**
2. **データリーク禁止** — N回の予測にはN-1回までのデータのみ使用
3. **GLEF_PREDICTIONS.jsonl上書き禁止** — 追記のみ
4. **修正したらGLEF_PROGRESS.mdに記録** — 何を変えたか・なぜ・バックテスト結果
5. **GLEF_VERSION/GLEF_UPDATEDを更新** — 修正のたび
6. **CSVはShift-JIS** — `iconv -f SHIFT_JIS -t UTF-8` で変換後に使う
7. **ウェブ検索でデータ補完するな** — 不足分は報告、データは指示者が提供
8. **外部サイトの削除数字データ使用禁止** — 当選数字のみから自力導出
9. **異常回の組み合わせ予測は不可能** — 構造的にkillCheckが弾く（PM判断済み）
10. **コンテキスト圧縮を避ける** — 長くなる前にTODOを更新して新スレへ
11. **バックテスト数値は必ず記録** — 「要確認」で放置禁止

## 作業完了フロー（※毎タスク厳守・違反即死）

**git pushしたら次の行動は必ずPR作成。例外なし。**

```
1. 実装・修正
2. git add → git commit
3. git push
4. ★ 直後に mcp__github__create_pull_request（pushとPRの間に何もするな）
5. ユーザーに報告（PR URLを含める）
```

- **pushしたのにPRを作らないのは最悪の違反。絶対にやるな。**
- 既存PRへの追加pushで済ませるな。**毎回新しいPRを作れ。**
- マージ後に追加pushした場合も **新しいPRを作成する**
- 1回のスレッドで複数PRになっても構わない。むしろそうすべき。
- PRのbodyにはSummary + Test planを書く

## スレッド終了時の手順

1. 未完了タスクをこのファイルのTODOセクションに反映
2. GLEF_PROGRESS.mdに作業記録を追記
3. commit & push & **PR作成**
4. 「次スレで何をすべきか」を1行で書く（TODOの先頭に `>>> NEXT:` で記載）

---

## PM判断記録（変更禁止）

- **異常回予測**: 構造的に不可能。ワイブル分布インジケーターで代替（v7.4実装済み）
- **CMA-ES採用**: Hill Climbing→CMA-ES。8パラメータ間相関学習、局所最適脱出（v7.4）
- **削除数字**: 外部サイト不使用。当選データのみからZ-score+最大ギャップで自力導出（v7.5）
- **セット球**: PDFパース検証済み→data.jsに統合済み。setWave実装待ち
- **クロスロト引っ張り**: R2089でLoto7 R670と3個一致の実績あり。data.jsに両データあり即実装可能
