# GLEF Development Progress

## データリーク検証結果

**結論：リークなし（2026-03-18 検証済み）**

`runBacktest()` (line 898) では `trainData = draws.slice(0, idx)` でN-1回目までのデータのみを使用。
`autoTuneLoop()` (line 940) も同様に `td = draws.slice(0, idx)` で分割。
全波形関数（depthWave, vertWave, horzWave, crossWave, coBias）は引数の `draws` のみを参照し、グローバルデータへの直接アクセスなし。
バックテストの数値は信頼できる。

---

## v6.0-initial（2026-03-13）
**コミット:** `46841c7` Add GLEF v6.0 / `d8f2fda` Fix v6 JS syntax errors

### 変更内容
- v5.0（4D Wave Physics のみ）から大幅アップグレード
- 遺伝的アルゴリズム（GA）導入：pop=100, gen=200, elite=5, tournament=3, mut=10%
- シャノンエントロピーによるゾーン分散モード判定（cluster/neutral/spread）
- killCheck フィルタ（連番・合計値・ゾーン集中・奇偶）
- ANTI-THEORY SHOT（反セオリー予測）の追加
- 大阪ラウンド偏り分析
- 等級判定（PRIZE定義）とバックテスト機能

### 設計意図
- 人間の直感に頼らず、数学的最適化で予測を生成する基盤を構築
- GAによりkillCheckを通過しつつスコア最大化する組み合わせを探索
- エントロピーで「偏り期」「分散期」を判定し、GAの適応度関数を動的に変える

### 問題点
- vertWave が前回出現数字（t1）に対して `ss += 20` と過大なボーナスを与えていた
  - 結果：直近当選番号がそのまま次回予測に残る「引っ張り過多」
- crossWave のスコアが全数字で突出して高い（キャップなし）
  - 他の波形成分（depth, vert, horz）の影響が相対的に薄まる
  - 予測がcrossWaveに支配される
- キャリーオーバーペナルティが甘い（3個以上でようやく微ペナルティ）

### ONE SHOT予測（Loto7 第668回向け）
`09-13-14-17-18-22-35`

### バックテスト結果（Loto7）
- 正確な数値は未記録（この時点ではバックテスト表示機能が未完成だったため）
- ただし波形スコア自体は機能しており、v6.0の予測は10番台の集中パターンを捉えていた

---

## v6.1-vert-fix（2026-03-13）
**コミット:** `7d476c9` Improve prediction accuracy / `aec6faf` Add prize tier definitions

### 変更内容
1. **vertWave 引っ張り抑制**
   - t1（前回出現）のボーナスを条件付きに変更：直近10回で3回以上→+8、2回→+5、1回→-5
   - 以前は無条件で +20 だった
2. **GA適応度改善**
   - キャリーオーバーペナルティ追加：3個以上で `-(carry-2)*8`、1-2個で `+carry*2`
   - ゾーンスプレッドボーナス：3ゾーン以上カバーで `+zonesUsed*2`
   - 連番ペナルティ：3連番以上で `-(maxCon-2)*5`
3. **ANTI-THEORY SHOT重複制約**
   - `overlap > pk-3` で弾く（mainPredと3個以上異なることを要求）
4. **Auto-Tuneループ実装**
   - 5つの波形乗数（depthMult, vertMult, horzMult, crossMult, coMult）を自動最適化
   - バックテスト結果をフィードバックして乗数を±0.2〜0.05で調整
   - 最大20イテレーション、avgHit>=2.0で早期終了
5. **depthWave改良**
   - 期待ギャップ（max/pick）ベースのスコアリングに変更
   - ギャップが期待値近辺で最高スコア、出現直後や長期未出現で減点
6. **等級判定（PRIZE）追加**
   - Loto6: 1等=6個, 2等=5+B, 3等=5個, 4等=4個, 5等=3個
   - Loto7: 1等=7個, 2等=6+B, 3等=6個, 4等=5個, 5等=4個, 6等=3+B
7. **deterministicPick関数**
   - バックテスト用の決定論的選択（GAのランダム性を排除）
   - ゾーン制約（各ゾーン最大3）とキャリー制約（最大2）を適用

### 設計意図
- vertWaveの引っ張り過多を解消し、予測の多様性を確保
- Auto-Tuneにより各波形成分の重みを自動的にバランス
- バックテストに等級判定を追加し、実際の当選金に近い評価を可能に

### バックテスト結果（Loto7）
- Avg Hits: 測定値は環境依存（Auto-Tuneの結果による）
- Auto-Tuneにより改善傾向

### 残存課題
- crossWaveが依然として支配的（キャップなし）
- キャリーオーバー制約がまだ甘い（2個まで許容）
- 等間隔パターン（11-13-15など）をフィルタしていない
- ANTI-THEORY SHOTのOverlap制約がpk依存で不明確

---

## v6.2-cross-cap（2026-03-13 → 2026-03-18）
**コミット:** `310cb1d` Improve prediction constraints and wave balance

### 変更内容
1. **crossWaveキャップ30**
   - `Math.min(raw, 30)` で上限制限
   - crossWaveが全数字で突出して高スコアを出していた問題を解消
2. **引っ張り最大1個制約**
   - carry>=3: `-carry*15`（重ペナルティ）
   - carry=2: `-12`（強ペナルティ）
   - carry=1: `+3`（ボーナス）
   - carry=0: `+1`（微ボーナス）
3. **等間隔パターンkillCheck**
   - 1つ飛ばし（差2）が3個以上連続するパターンを検出し弾く
   - 例：11-13-15, 30-32-34
4. **ANTI-THEORY SHOT Overlap最大3**
   - `overlap > 3` で弾く（固定値に変更、pk依存を排除）
   - diversity bonus を `*3.0` に強化
   - overlap=3 でも追加ペナルティ `-5`

### 設計意図
- バランス型への補正：各波形成分が均等に影響するようにする
- 引っ張りを最大1個に制限し、前回結果への依存を大幅に減らす
- 不自然な等間隔パターンを排除
- ONE SHOTとANTI-THEORYの差別化を強化

### ONE SHOT予測（Loto7 第668回向け）
`01-05-15-26-27-30-32`

### ANTI-THEORY SHOT
`01-11-12-16-26-30-36`

### バックテスト結果（Loto7）
- Avg Hits: 1.60
- Max Hits: 3
- Hit Rate: 22.9%
- Tests: 20

---

## 第668回 抽選結果と振り返り（2026-03-14）

### 抽選結果
- **本数字:** 01-08-11-14-18-22-29
- **ボーナス:** 19-35

### 各バージョン予測との照合

| Version | 予測 | 本数字一致 | ボーナス一致 | 合計 | 等級 |
|---------|------|-----------|-------------|------|------|
| v6.0-initial | 09-13-14-17-18-22-35 | 3個 (14,18,22) | 1個 (35) | 実質4一致 | **6等**（3個+B1一致） |
| v6.2-cross-cap | 01-05-15-26-27-30-32 | 1個 (01) | 0個 | 1一致 | なし |
| v6.2 ANTI-THEORY | 01-11-12-16-26-30-36 | 2個 (01,11) | 0個 | 2一致 | なし |

### 重要な分析
1. **修正前（v6.0）の予測のほうが的中数が多かった**
   - v6.0は10番台への集中（11,14,18）という偏りパターンを捉えていた
   - 本数字7個のうち4個が10番台（11,14,18,19(B)）に集中していた
2. **バランス型補正が強すぎた**
   - crossWaveキャップ、引っ張り制約、等間隔killの複合効果で
   - 波形エンジンが見つけた偏りの形（ゾーン集中パターン）を潰してしまった
3. **vertWaveの引っ張り抑制が過剰だった可能性**
   - v6.0で14,18,22を捉えられたのは、vertWaveが過去出現番号に高スコアを付けていたから
   - 抑制後はこれらの番号のスコアが下がり、予測から外れた

### 次回改善の方向性（2スレ目で実施）
- **偏りの形を残す**: バランス補正の重みを下げ、波形エンジンの偏り検出を尊重する
- **エントロピーモードの活用**: cluster期にはゾーン集中を許容する（現在の制約を緩和）
- **適応的制約**: エントロピーがclusterモードのときはkillCheckのゾーン制約を緩くする
- **Auto-Tuneの評価指標見直し**: avgHitだけでなく、「3個以上一致の頻度」も重視する

---

---

## v6.3-entropy-adaptive（2026-03-18）

### 変更内容
1. **等級判定修正**
   - GLEF_RESULTS.jsonlのv6.0-initial「5等（4個一致）」→「6等（3個+B1一致）」に修正
   - judgeGrade関数自体はPRIZE定義と一致していることを確認済み（修正不要）

2. **killCheckのゾーン制約可変化（cluster期緩和）**
   - `killCheck(nums, mode)` に mode パラメータ追加
   - cluster期: ゾーン集中閾値を 5個 → 6個 に緩和（1ゾーンに5個まで許容）
   - neutral/spread期: 従来どおり 5個以上で弾く
   - gaFitness から `killCheck(ind, eInfo.mode)` として呼び出し

3. **GA適応度のentropyAdj拡大**
   - cluster期: `ea=(H<1.5)?2:-2` → `ea=(H<1.5)?5:-5` に拡大
   - spread期: `ea=(H>1.8)?3:-3` → `ea=(H>1.8)?6:-6` に拡大
   - neutral期: `ea=1` → `ea=2` に増加

4. **vertWaveの引っ張り抑制をエントロピーモード連動**
   - `waveEntropyMode` グローバル変数を追加（entropyTrend呼び出し時に更新）
   - cluster期の t1（前回出現）ボーナス: `f>=3→+8, f>=2→+5, else -5` → `f>=3→+12, f>=2→+8, else +2` に緩和
   - neutral/spread期は従来どおりの抑制を維持

5. **Auto-Tuneの評価指標に「3個以上一致の頻度」追加**
   - quickBacktest の返り値を `totalHits/tests` → `(totalHits/tests)*0.7 + (hit3plus/tests)*10*0.3` の複合指標に変更
   - 平均ヒット数（70%）と3個以上一致率（30%換算）を組み合わせることで、レア高得点を重視

### 設計意図
- 668回の振り返りで「v6.0のほうが的中数が多かった」ことへの反省
- バランス型補正が強すぎてcluster期の偏り（ゾーン集中）を潰していた
- cluster期にはゾーン集中を許容することで、v6.0が捉えていた「10番台集中」のようなパターンを再現可能に
- entropyAdjの値を拡大することで、エントロピーモードがGA探索の方向性により強く影響するよう調整
- Auto-Tuneが「たまに3個当てる」組み合わせを優遇するよう、評価指標を改良

### ONE SHOT予測（Loto7 第669回向け）
`05-09-20-26-29-30-32`

（※注: data.jsは第666回（2026/2/27）まで。第667・668回はブラウザのlocalStorageに格納。本バックテストはdata.jsの666回分で実施）

### バックテスト結果（Loto7、Node.js実行）
- Avg Hits: **1.55**
- Max Hits: **3**
- Hit Rate: **22.1%**
- 3個以上一致頻度: **1/20 (5.0%)**
- Tests: 20
- 直近エントロピーモード: **neutral**

### 考察
- neutral期のため、cluster連動機能は今回のバックテストでは効果が限定的
- v6.2との比較: Avg 1.60→1.55（誤差範囲内）、Hit Rate 22.9%→22.1%
- cluster期が来た際に今回の改善が効果を発揮するはず
- 第669回がcluster期になった場合、ゾーン集中予測が選ばれやすくなる

---

## v6.3.1-data668（2026-03-18）
**コミット:** `claude/improve-glef-engine-kCuYg`

### 変更内容
- data.js に第667回（2026/3/6）・第668回（2026/3/13）を追加（668回まで）
- 668回データを使って第669回向け予測を再計算
- GLEF_VERSION を v6.3.1 に更新
- index_v6.html のバージョン表示（GLEF_VERSION / GLEF_UPDATED 定数）確認済み

### データ追加内容
- 第667回: 2026/3/6　本数字=[9,13,20,22,28,29,33]　BONUS=[21,23]
- 第668回: 2026/3/13　本数字=[1,8,11,14,18,22,29]　BONUS=[19,35]
- キャリーオーバー列は665回以降 2147483647（32bit上限・公式CSV不具合）のためそのまま使用

### ONE SHOT予測（Loto7 第669回向け）
`07-13-15-22-26-27-30`

### ANTI-THEORY SHOT予測（Loto7 第669回向け）
`04-05-12-27-30-32-34`

### バックテスト結果（Loto7、668回データ使用・Node.js実行）
- Avg Hits: **1.50**
- Max Hits: **3**
- Hit Rate: **21.4%**
- 3個以上一致頻度: **2/20 (10.0%)**
- Tests: 20
- 直近エントロピーモード: **neutral** (avg=1.764)

### 考察
- v6.3からv6.3.1: データ更新のみ、アルゴリズム変更なし
- 3+一致率が5.0%→10.0%に改善（667・668回の追加でサンプル更新）
- Hit Rate は22.1%→21.4%（誤差範囲内）
- neutral期継続。cluster期移行時に entropy-adaptive 機能が効果を発揮

---

## アーキテクチャ概要（2スレ目への引き継ぎ用）

### ファイル構成
- `index_v6.html` — メインアプリケーション（HTML + CSS + JS 全て1ファイル）
- `data.js` — 抽選データ（LOTO6_DATA, LOTO7_DATA 配列）
- `GLEF_PREDICTIONS.jsonl` — 予測蓄積ファイル（自動追記）
- `GLEF_RESULTS.jsonl` — 抽選結果記録ファイル
- `GLEF_PROGRESS.md` — 本ファイル（開発経緯）

### 波形エンジン（4D Wave Physics）
1. **depthWave** — ギャップ分析。期待ギャップ（max/pick）からの乖離でスコアリング
2. **vertWave** — 時間軸同期。直近3回の出現パターンと中長期頻度のWMA
3. **horzWave** — ゾーンMACD。ゾーン別出現頻度のMACD指標
4. **crossWave** — 共起行列。数字間の相関（キャップ30）
5. **coBias** — キャリーオーバー偏り。CO高額時と通常時の出現率差

### 最適化エンジン
- **GA（遺伝的アルゴリズム）**: pop=100, gen=200, elite=5, tournament=3, mut=10%
- **Auto-Tune**: 波形乗数5個を自動調整（hill climbing, 最大20イテレーション）
- **Shannon Entropy**: ゾーン分散度からcluster/neutral/spread判定

### killCheckフィルタ
- 連番（renKill以上で弾く: Loto6=4連, Loto7=5連）
- 合計値範囲（Loto7: 100-200）
- ゾーン集中（1ゾーンに5個以上）
- 全奇数/全偶数
- 等間隔パターン（差2が3個以上連続）

### GA適応度関数 (gaFitness)
`fitness = waveScore + sumPenalty + oddEvenPenalty + entropyAdj + carryPen + zoneSpr + conPen`
- waveScore: 各数字のtotalスコア合計
- sumPenalty: `|sum - sumTarget| * -0.5`
- oddEvenPenalty: `|odd - oddTarget| * -3`
- entropyAdj: モード別ゾーンエントロピー評価
- carryPen: 前回引っ張り制約（最大1個）
- zoneSpr: 3ゾーン以上カバーでボーナス
- conPen: 3連番以上でペナルティ

### 等級定義（検証済み）
- Loto6: 1等=6個, 2等=5+B, 3等=5個, 4等=4個, 5等=3個
- Loto7: 1等=7個, 2等=6+B, 3等=6個, 4等=5個, 5等=4個, 6等=3+B
- `judgeGrade()` のロジック：上位等級から順にマッチ判定。bonus付き等級は `hitCount===match && bonusHitCount>=1`

### データパイプライン
- **入力**: アプリ上で手入力 → data.jsに自動追加
- **予測**: 4D Wave Analysis → GA最適化 → GLEF_PREDICTIONS.jsonl に自動追記
- **照合**: GLEF_RESULTS.jsonl と GLEF_PREDICTIONS.jsonl を自動照合、一致数算出
- **改善**: 照合結果 → Auto-Tune → 次回予測にフィードバック

### 重要な設定値
```
CFG.loto7 = { max:37, pick:7, bCnt:2, sumR:[100,200], renKill:5, conFilt:3 }
GA_CFG = { popSize:100, generations:200, eliteCount:5, tournamentSize:3, mutationRate:0.1 }
WL=0.5, WM=0.3, WS=0.2 (長期:中期:短期の重み)
crossWave cap = 30
carry max = 1
overlap max = 3 (ANTI-THEORY vs ONE SHOT)
```
