# GLEF — Gravity Loto Engine Framework

## これは何？
ロト6/ロト7の予測アプリ。HTML+JS単一ファイル(`index.html`)でGitHub Pages運用。
マイホーム資金のための長期プロジェクト。予測精度が最優先。

---

## 現在の状態

| 項目 | 値 |
|------|-----|
| バージョン | v7.9-anomaly-ext |
| 異常回検出率 | Loto6: 44.5%(5条件) / Loto7: 37.1%(4条件、狭帯域無効) |
| mainブランチ | v7.6.2-unified-data |
| エントリポイント | `index.html` |
| データ | Loto6 R2093まで / Loto7 R672まで（GitHub Actionsで自動更新） |
| データ自動取得 | sougaku.com 詳細ページ + リストページ |
| セット球 | data.jsの各エントリ末尾に統合済み（r[5]）、drawオブジェクトの`setBall`プロパティ |
| CO修正 | INT32_MAXオーバーフロー自動修正済み（autoFetchで検出・補完）|
| 理論数 | 20 active + マルチシグナル削除分析 |

### 精度（バックテスト直近20回、v7.8 CMA-ESチューニング済み）
| ゲーム | Avg Hits | Tuned AvgHit | ランダム基準 | 改善率 | Max Hits |
|--------|----------|-------------|-------------|--------|----------|
| Loto7 | **1.80** | **2.28** | 1.32 | **+36%** | **5** |
| Loto6 | **1.35** | **1.61** | 0.84 | **+61%** | **4** |

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
| 9 | coldWave | coldMult | 削除数字自力導出（Z-score+最大ギャップ） |
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

>>> NEXT: 削除候補数字がGA予測に反映されていないバグ修正（短期冷却ペナルティ強化 or killCheckに削除候補フィルタ追加）→ Confidenceスケーリング微調整 → Loto6精度改善
- [x] **setWave実装** — v7.7で完了。セット球条件付き確率Wave（マルコフ遷移予測）、10番目のWave + CMA-ES `setMult` 追加
- [x] **クロスロト引っ張り** — v7.8で完了。`crossLotoBias` Wave（11番目）+ CMA-ES `crossLotoMult` 追加。日付ベース他ロト参照+歴史的リフト率
- [x] **異常回定義拡張** — v7.9で完了。3連番+奇偶極端+狭帯域集中(L6のみ)追加。Loto6: 12.7%→44.5%、Loto7: 24.4%→37.1%(狭帯域は独自新規4%・重複83%のため無効化)
- [x] **Anomaly RiskにCO補正** — v7.9で完了。Loto7: +6.7pt、Loto6: +3.2pt。ワイブルベースリスクに加算
- [ ] **Loto6精度改善** — Avg Hits 1.35、vs Random +61%まで改善済み。さらなるチューニング余地あり
- [ ] **glef_predict.js v7.9対応** — Node.js版がv7.3のまま
- [ ] **Confidenceスケーリング微調整** — 現在AvgHit=1.12で上限75%張り付き

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

## 作業完了フロー（※毎タスク厳守）

**push→PR は1セット。間に別作業を挟まない。PRなしでユーザーに報告しない。**

```
1. 実装・修正
2. git add → git commit
3. git push
4. ★ 直後に PR作成（push直後。忘れるな）
5. ユーザーに報告（PR URLを含める）
```

- マージ後に追加pushした場合も **新しいPRを作成する**
- 1回のスレッドで複数PRになっても構わない
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
