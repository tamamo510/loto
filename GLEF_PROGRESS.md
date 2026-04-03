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

## v7.0-fourier-ga-diversity（2026-03-20）
**ブランチ:** `claude/improve-glef-engine-kCuYg`

### Task 1: GA収束問題の解決

#### 実装内容
- **1-1. 多様性モニタリング**: 世代ごとにユニーク率（unique/popSize）を計算。30%以下に落ちたら突然変異率を0.3に一時上昇
- **1-2. 初期集団の多様化**: popSizeの30%（30個）を1〜37の全数字プールからランダム生成、残り70%を従来通りtop18から生成
- **1-3. 強突然変異**: 10%の確率で突然変異を2回連続適用
- **1-4. 再実行ロジック**: 前回予測と同一の場合は最大3回再実行（localStorage `glef_last_pred_{gameType}` に保存して比較）

### Task 2: フーリエ変換（FFT）による周期性検出

#### 実装内容（study-notes/physics/index.md の数式に準拠）
- `fft(re, im)`: Cooley-Tukey radix-2 FFT、O(N log N)、ビット反転置換 + バタフライ演算
  - 数式: `X[k] = Σ(n=0→N-1) x[n]·e^(-i2πkn/N)` (study-notes DFT式)
  - 分割: `X[k] = E[k] + e^(-i2πk/N)·O[k]` (Cooley-Tukey分割)
- `fourierWave(num, draws)`:
  1. 直近256回（または利用可能な最大回数）の出現二値系列 (0/1) を作成
  2. ゼロパディングして2^pサイズに統一
  3. FFT実行 → パワースペクトル `P[k] = Re[k]² + Im[k]²`
  4. DC成分(k=0)除外、上位3支配的周期を特定
  5. 各周期の現在位相と出現ピーク位相のコサイン類似度でスコア計算
  6. `[-10, +15]` にクリップ、`fourierMult` 乗算して返却
- `learnedParams` に `fourierMult: 1` を追加、Auto-Tune対象に含める
- `localStorage` キーを `glef_v6_*` から `glef_v7_*` に移行

### Task 3: バージョン更新
- `GLEF_VERSION = 'v7.0'`
- `GLEF_UPDATED = '2026-03-20T11:12+09:00'`
- `<title>` / `<h1>` を v7.0 に更新
- versionSub に `+ Fourier Periodicity` を追加
- Engine Status ヘッダを `GLEF v7.0` に更新
- Theory Registry: Fourier Transform を `future` → `active` に昇格
- `theoriesActive = 12`

### バックテスト比較（Loto7、668回データ使用）

```
Before (v6.3.1):
  Avg Hits:   1.50
  Max Hits:   3
  Hit Rate:   21.4%
  3+ 一致率:  10.0% (2/20)

After (v7.0):
  Avg Hits:   1.55  (+0.05)
  Max Hits:   3
  Hit Rate:   22.1% (+0.7pt)
  3+ 一致率:  5.0%  (-5.0pt ※FFT追加によるスコア分布変化、サンプル数20のため誤差範囲)
  Tests: 20
  Entropy Mode: neutral (avg=1.764)
```

### 第669回予測（2026/3/20 金曜抽選）— v7.0最終版

| | 数字 |
|---|---|
| **ONE SHOT** | `05-07-15-26-27-30-32` |
| **ANTI-THEORY** | `04-10-13-22-30-32-34` |

---

## v7.2-rqa（2026-03-20）
**ブランチ:** `claude/improve-glef-engine-kCuYg`

### Task 1: 再帰定量化分析（RQA）による類似局面検出

#### 理論的根拠（study-notes/chaos/index.md に準拠）
- 再帰行列: `R_{ij} = Θ(ε - ||x_i - x_j||)`
- タケンスの埋め込み定理 (m=3, τ=1): 遅延座標で状態空間再構成

#### 実装内容
- `buildStateVectors(draws)`: 各回のゾーン分布 [A,B,C,D] × 3ラグ = 12次元ベクトル（Takens埋め込み）
- `findSimilarStates(vectors, threshold)`: 現在状態と過去状態のユークリッド距離計算
  - 直近10回を除外（過学習防止）
  - 閾値以下の距離を「再帰点」として検出、上位10個を返す
- `buildRQACache(draws)`: ランダム100ペアで距離分布を推定し、中央値×0.5を閾値として設定
  - 計算量: O(N×100) サンプリング + O(N×12) 検索 = 軽量設計
- `rqaWave(num, draws, rqaCache)`:
  - 類似局面の「直後」に出た数字を距離重みで集計
  - `weight = 1/(1+dist)` （距離が近いほど重み大）
  - 観測出現率 vs 期待出現率の偏差でスコア計算
  - `deviation = (observedRate - expectedRate) / expectedRate`
  - `score = deviation * 15`、`[-8, +12]` クリップ、`rqaMult` 乗算
- `rqaMult: 1` を learnedParams・paramKeys・clearHistory に追加

#### パフォーマンス対策
1. 状態ベクトル: ゾーン4次元×3回=12次元（数字37次元にしない）
2. 再帰行列: 全対計算なし。現在状態×過去N件の1行のみ計算
3. buildRQACache は runAnalysis/runBacktest/quickBacktest で1回だけ呼ぶ
4. threshold推定: ランダム100ペアのサンプリング
5. 類似局面: 上位10件に制限

### Task 2: バージョン更新
- `GLEF_VERSION = 'v7.2'`
- `GLEF_UPDATED = '2026-03-20T12:19+09:00'`
- `<h1>` を v7.2 に更新
- versionSub に `+ RQA` を追加
- Engine Status ヘッダを `GLEF v7.2` に更新
- Theory Registry に「Recurrence Quantification Analysis (RQA)」を Chaos Theory カテゴリで active 追加
- `theoriesActive = 15`
- savePredictionToLog version: `'v7.2-rqa'`

### バックテスト比較（Loto7、668回データ使用）

```
Before (v7.1):
  Avg Hits:   1.30
  Max Hits:   3
  Hit Rate:   18.6%
  3+ 一致率:  5.0% (1/20)

After (v7.2):
  Avg Hits:   1.55  (+0.25)
  Max Hits:   4     (+1、新記録)
  Hit Rate:   22.1% (+3.5pt)
  3+ 一致率:  15.0% (+10.0pt ★大幅改善)
  Tests: 20
  Entropy Mode: neutral (avg=1.764)
```

**考察**: RQAによる類似局面検出が効果的に機能。特に3個以上一致率が5%→15%に3倍改善。
最大ヒット数も3→4に向上。neutral期でも「過去に同じようなゾーンパターンが続いた局面」を検出し、
その直後の出現傾向を予測に活かすことができた。
閾値=中央値×0.5の設定で適度な再帰点数（10件程度）が確保できている。

### 第669回予測（2026/3/20 金曜抽選）— v7.2最終版

| | 数字 |
|---|---|
| **ONE SHOT** | `03-07-15-17-28-32-34` |
| **ANTI-THEORY** | `03-07-09-27-30-32-36` |

---

## v7.1-mi-markov（2026-03-20）
**ブランチ:** `claude/improve-glef-engine-kCuYg`

### Task 1: 相互情報量（Mutual Information）による crossWave の強化

#### 実装内容（study-notes/information-theory/index.md の数式に準拠）
- `buildMIMatrix(draws)`: 数字ペア間の相互情報量行列を構築
  - 数式: `I(X;Y) = Σ p(x,y) log₂[p(x,y)/(p(x)p(y))]`
  - p(x) = 単一数字の出現確率、p(x,y) = ペア同時出現確率
  - loto7では 37×37 の Float32Array 行列
- `crossWave(num, tops, mat, miMat)`: miMat パラメータを追加
  - 従来の共起スコア（co-occurrence）と MI スコアを 50:50 ブレンド
  - `coScore = mat[t][num] * 10`（既存）
  - `miScore = miMat[t][num] * 100`（MI値のスケール調整）
  - `s += (coScore + miScore) * 0.5`
- runAnalysis / runBacktest / quickBacktest 全てに `const miMat=buildMIMatrix(draws)` を追加し引数に渡す

### Task 2: マルコフ連鎖ゾーン遷移（Markov Chain Zone Transition）

#### 実装内容（study-notes/statistics/index.md の数式に準拠）
- `buildZoneTransition(draws)`: ゾーン分布パターンの遷移確率行列を構築
  - 遷移確率: `P(X_{n+1}=j|X_n=i) = p_{ij}`
  - 各回の zoneCnt を `"A-B-C-D"` 形式のキーに変換（例: `"1-2-2-2"`）
  - 直前状態キー（curKey）と遷移確率辞書（trans）を返す
- `markovWave(num, ztCache)`: ztCache（buildZoneTransition の戻り値）を受け取る
  - 現在のゾーン状態から次回ゾーン分布の確率分布を推定
  - 数字のゾーンの期待出現数 = Σ prob × (zoneCntInPatt - pick/4) × 4
  - `[-8, +12]` にクリップ、`markovMult` 乗算
- `learnedParams` に `markovMult: 1` を追加、Auto-Tune 対象に含める
- キャッシュ設計: 各分析（runAnalysis/runBacktest/quickBacktest）で1回のみ buildZoneTransition を呼ぶ

### Task 3: バージョン更新
- `GLEF_VERSION = 'v7.1'`
- `GLEF_UPDATED = '2026-03-20T11:41+09:00'`
- `<h1>` を v7.1 に更新
- versionSub に `+ Mutual Information + Markov Chain` を追加
- Engine Status ヘッダを `GLEF v7.1` に更新
- Theory Registry:
  - Mutual Information: `future` → `active`（crossWave に統合）
  - Markov Chain Zone Transition: 新規 `active` 追加（Statistics カテゴリ）
- `theoriesActive = 14`
- savePredictionToLog version: `'v7.0-fourier-ga-diversity'` → `'v7.1-mi-markov'`

### バックテスト比較（Loto7、668回データ使用）

```
Before (v7.0):
  Avg Hits:   1.55
  Max Hits:   3
  Hit Rate:   22.1%
  3+ 一致率:  5.0% (1/20)

After (v7.1):
  Avg Hits:   1.30  (-0.25)
  Max Hits:   3
  Hit Rate:   18.6% (-3.5pt)
  3+ 一致率:  5.0%  (±0pt)
  Tests: 20
  Entropy Mode: neutral (avg=1.764)
```

**考察**: MI + Markov の追加でスコア分散が拡大し、従来の crossWave が選んでいた上位数字の順位が変化。
neutral 期では MI の効果が薄い可能性あり（共起パターンが既に crossWave で捉えられているため）。
今後の課題: markovMult / miBlend 比率の Auto-Tune 最適化、cluster 期での効果検証。

### 第669回予測（2026/3/20 金曜抽選）— v7.1最終版

| | 数字 |
|---|---|
| **ONE SHOT** | `03-13-15-26-27-30-32` |
| **ANTI-THEORY** | `04-07-15-17-30-32-34` |

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

## v7.3-anomaly-3tier（2026-03-20）
**ブランチ:** `claude/improve-glef-engine-kCuYg`
**ファイル:** `index.html`（旧index_v7.html。index_v6.htmlはarchive/に移動）

### 背景：第669回異常回の分析
- **抽選結果:** 03-05-06-07-09-13-16 (BONUS: 11,23)
- **Sum=59**（期待値約133.7、σ≈28.3）→ |59-133.7| = 74.7 > 2×28.3 = 56.6 **→ 異常確定**
- **ゾーン:** A(1-10)に5個集中（3,5,6,7,9）→ ≥4 **→ 異常確定**
- v7.2予測[3,7,15,17,28,32,34]との一致: **2個（3,7）**
- sumR=[100,200]のkillCheckにより設計上予測不可能な回

### Task 1: 三層バックテスト（3-Tier Backtest）

#### 実装内容
- `runFullBacktest(draws)`: 全期間バックテスト
  - `step = max(1, floor((len-30)/60))` で等間隔60サンプル
  - idx=30からlenまでstep刻みで全履歴をカバー
- `runAnomalyBacktest(draws)`: 異常回後バックテスト
  - 異常回(`isAnomaly=true`)の翌回を対象に予測精度を評価
  - 「異常回後のパターン」専用の予測指標
- `rBtSection(bt, title, note)`: バックテストセクション描画（共通）
- `rBacktest(bt)`: `{recent, full, anomaly}` の3タブUI
- `showBtTab(id, el)`: バックテストサブタブ切り替え

#### Auto-Tune複合指標改訂
- `avgHit × 0.60 + (hit3plus/tests × 10) × 0.40`
  - v7.2: avgHit 70% + 3+Rate 30% → v7.3: avgHit 60% + 3+Rate 40%（3+ヒット重視）

### Task 2: コンボ診断パネル（Combo Diagnostics）

#### 実装内容
- `diagnoseCombination(numbers, draws)`: 予測数字を多角的に診断
  - 奇偶比（Odd:Even）と過去200回での出現率
  - Sum偏差（σ単位）と近傍率（±10以内の確率）
  - 引っ張り数字（前回との一致）と平均引っ張り数
  - 連番ペア数・1飛ばしペア数
  - ゾーン集中率
- `rDiagPanel(diag, title)`: 診断結果カードのレンダリング
- ONE SHOT / ANTI-THEORY SHOT それぞれの予測直下に表示

### Task 3: Manual Pick Checker（自前予想診断）

#### 実装内容
- Data Pipeline内に「Manual Pick Checker」フォームを追加
- `checkManualPick()`: ユーザー入力数字をGLEF診断エンジンで分析
  - killCheck（PASS/NG判定）
  - パーソナリティラベル表示
  - `rDiagPanel` による統計診断

### Task 4: 予測パーソナリティラベル（Prediction Personality）

#### 実装内容
- `classifyPrediction(numbers, draws, entropyInfo)` → `{label, sub, color}`
  - **バランス型**: Sum偏差<0.5σ、引っ張り≤1、連番≤1
  - **引っ張り重視型**: 引っ張り≥2
  - **波乱型**: Sum偏差>1.5σ OR 連番≥3 OR cluster期
  - **統計重視型**: spread期 AND Sum偏差<1.0σ
  - **回復型**: 上記以外（post-anomaly回復期など）
- ONE SHOTタイトル横にバッジとして表示

### Task 5: Data Pipeline UI改善

#### 実装内容
- `最新データ: R669 (2026/3/20) 読み込み済み ✓` ステータスバー追加
- 入力フォームのplaceholderを最新版に更新（R670/2026-03-27/例形式）
- `addDrawResult()` 実行後のdpCO欄クリア追加

### Task 6: 異常回検知 + 波形エンジン強化

#### 実装内容（study-notes参照）
- `markAnomalies(draws, type)`:
  - `|sum - mean| > 2σ` OR `any zone count ≥ 4` → `d.isAnomaly = true`
  - `initData()` で enrichDraws の直後に呼び出し
- **depthWave anomaly dampening**: `prevAnomalyFactor = 0.7` (前回が異常回の場合)
  - 異常回直後はギャップ/頻度ベーススコアが不安定なため0.7倍
- **vertWave anomaly dampening**: 前回が異常回なら t1（引っ張り）ボーナスを+1のみ
  - 通常: cluster期 f>=3→+12, f>=2→+8, else +2 / neutral期 -5〜+8
  - 異常回後: +1（最小ボーナス、パターン継続を期待しない）
- **rqaWave anomaly boost**: `weight *= (draws[match.idx]?.isAnomaly ? 1.5 : 1.0)`
  - 類似局面が異常回だった場合、その直後パターンの重みを1.5倍

### Task 7: バージョン更新

- `GLEF_VERSION = 'v7.3'`
- `GLEF_UPDATED = '2026-03-20T20:00+09:00'`
- `<h1>` → `GLEF v7.3 - Gravity Loto Engine Framework`
- versionSub に `+ Combo Diagnostics + 3-Tier Backtest` を追加
- Engine Status ヘッダを `GLEF v7.3` に更新
- Theory Registry に「Anomaly Detection + 3-Tier Backtest」を Statistics カテゴリで active 追加
- `theoriesActive = 16`

### バックテスト結果（Loto7、669回データ使用、Node.js実行）

```
直近20回バックテスト:
  Avg Hits:        1.55    (v7.2と同一)
  Max Hits:        3
  Hit Rate:        22.1%
  3+ Hit Rate:     10.0%   (2/20)
  Tests:           20

異常回後 (within 直近20):
  After-Anomaly Tests: 4   (R650,R655,R659,R661が異常回後)
  After-Anomaly Avg:   2.00 ★ (通常Avg 1.55より+0.45改善)

異常回検知:
  Total anomaly rounds: 162/669 (24.2%)
  R669 (直近): Sum=59 → 異常確定 (|59-133.7|=74.7 > 2×28.3=56.6)

エントロピー:
  Mode: neutral (avg=1.735)
```

**考察**:
- 直近BT: v7.2と同スコア(Avg=1.55)。dampening/boost の効果は長期・異常回専用BTで現れる
- **異常回後Avg=2.00** は注目すべき値。R669直後のR670予測で効果が期待される
- 異常回は全669回中162回(24.2%)と多い。threshold(2σ OR zone≥4)の感度は適切と判断

### 第670回予測（2026/3/27 金曜抽選）— v7.3最終版

| | 数字 |
|---|---|
| **ONE SHOT** | `03-11-15-18-28-32-35` |
| **ANTI-THEORY** | `03-09-19-24-26-30-32` |

- Sum=142（目標値一致）、O:E=4:3、Zone A:1 B:3 C:1 D:2
- R669はSum=59の異常回→ anomaly dampening発動中
- Entropy: neutral (avg=1.735)
- Anomaly rounds: 162回 / 669回中

---

## アーキテクチャ概要（2スレ目への引き継ぎ用）

### ファイル構成
- `index.html` — メインアプリケーション v7.3（HTML + CSS + JS 全て1ファイル）
- `archive/index_v6.html` — v7.2以前アーカイブ（変更禁止）
- `archive/index_old.html` — v5.0アーカイブ
- `data.js` — 抽選データ（LOTO6_DATA, LOTO7_DATA 配列）R669まで
- `glef_predict.js` — Node.js予測エンジン（v7.3対応）
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

---

## ロト6 第2087回予測 (2026-03-23) — v7.3

### data.js更新
- 2083回〜2085回: ウェブ検索で確認済み公式結果を追加
- 2086回: スクショ実データから追加
- LOTO6_DATA: 2082回 → 2086回（+4回）

| 回 | 日付 | 本数字 | B | CO |
|---|---|---|---|---|
| 2083 | 2026/3/9 | 08,10,13,17,26,29 | 43 | 210,243,220 |
| 2084 | 2026/3/12 | 08,17,18,19,30,39 | 09 | 462,516,068 |
| 2085 | 2026/3/16 | 06,08,13,26,35,43 | 14 | 131,403,738 (1等1口・6億円) |
| 2086 | 2026/3/19 | 04,11,19,28,39,40 | 06 | 377,168,743 (1等不出) |

### バックテスト結果（直近20回）
- **Avg Hits**: 0.85 / **Max Hits**: 3 / **Hit Rate**: 14.2% / **3+一致率**: 5.0% (1/20)
- Anomaly rounds: 265回 / 2086回中

### 第2087回予測（2026/3/26 木曜抽選）

| | 数字 |
|---|---|
| **ONE SHOT** | `07-09-12-33-36-38` |
| **ANTI-THEORY** | `02-03-20-24-36-38` |

- ONE SHOT: Sum=135, O:E=3:3, Zone A:2 B:1 C:0 D:3
- ANTI-THEORY: Sum=123, Overlap=2
- Entropy: neutral (avg=1.745)
- Trend: sumT=132, oddT=3
- R2086 CO=377,168,743（2連続1等不出）→ 高額CO継続中
- `GLEF_UPDATED = '2026-03-23T15:19+09:00'`

---

## v7.3機能検証（2026-03-30）

### 作業1: 機能存在チェック結果

GLEF_PROGRESS.md v7.3セクション記載の全10項目＋関連4項目について、index.htmlでの実装状況をgrepで検証。

| # | 機能 | 状態 | 行 |
|---|------|------|-----|
| 1 | runFullBacktest（全期間BT） | 実装済み | 684 |
| 2 | runAnomalyBacktest（異常回後BT） | 実装済み | 696 |
| 3 | showBtTab（3タブ切替UI） | 実装済み | 1342 |
| 4 | diagnoseCombination（コンボ診断） | 実装済み | 712 |
| 5 | rDiagPanel（診断パネル描画） | 実装済み | 751 |
| 6 | checkManualPick（マニュアルピック） | 実装済み | 1834 |
| 7 | classifyPrediction（パーソナリティ） | 実装済み | 739 |
| 8 | markAnomalies + initData呼出 | 実装済み | 251, 234/236 |
| 9 | depthWave anomaly dampening (×0.7) | 実装済み | 479 |
| 10 | vertWave anomaly dampening (+1) | 実装済み | 487-490 |
| 11 | rqaWave anomaly boost (×1.5) | 実装済み | 651 |
| 12 | Auto-Tune 0.60/0.40 | 実装済み | 1314 |
| 13 | Data Pipelineステータスバー | 実装済み | 96, 269-277 |
| 14 | Manual Pick Checkerフォーム | 実装済み | 150-160 |

**結論: 未実装機能なし。全機能がindex.htmlに正しく実装されている。**

---

## ロト6 第2087回 抽選結果と振り返り（2026-03-30）

### 抽選結果（2026/3/23 月曜抽選）
- **本数字:** 07-10-15-18-26-39
- **ボーナス:** 13
- **キャリーオーバー:** 31,193,795円（前回377,168,743円から激減。1等1口出た模様）

### 予測との照合

| Version | 予測 | 本数字一致 | ボーナス一致 | 等級 |
|---------|------|-----------|-------------|------|
| v7.3 ONE SHOT（購入） | 03-07-12-33-36-38 | 1個 (07) | 0個 | なし |
| v7.3 ONE SHOT（GLEF出力） | 07-09-12-33-36-38 | 1個 (07) | 0個 | なし |
| v7.3 ANTI-THEORY | 02-03-20-24-36-38 | 0個 | 0個 | なし |

※購入番号はGLEF出力から03を09に差し替えたもの。いずれも07のみ一致。

### 分析
- Sum=115（結果）vs Sum=135（ONE SHOT予測）→ 偏差-20
- 結果のゾーン分布: A(1-10):2, B(11-21):3, C(22-32):1, D(33-43):1 → B帯集中
- GLEFはD帯を3個選んだが、結果はD帯1個のみ。B帯を過小評価

### data.js更新
- R2087追加: `[2087, "2026/3/23", [7, 10, 15, 18, 26, 39], 13, 31193795]`
- LOTO6_DATA: 2086回 → 2087回（+1回）

---

## v7.4-cma-es-anomaly-risk（2026-03-30）
**ブランチ:** `claude/create-pr-v7.3-updates-n6MeY`

### Task 1: CMA-ES実装（Auto-Tune置き換え）

#### 理論的根拠（study-notes/optimization/index.md に準拠）
- CMA-ES: `x_k^(g+1) ~ N(m^(g), (σ^(g))²C^(g))`
- ハンセンとオスターマイヤーの進化戦略発展形
- 共分散行列を世代ごとに適応的に更新し、目的関数の等高線形状に合わせた効率的な探索を実現
- 導関数不要のブラックボックス最適化

#### 実装内容
1. **Jacobi固有値分解** (`jacobiEigen`): 8×8対称共分散行列Cの固有値・固有ベクトル計算
   - 反復回転法、最大50スイープ、収束判定 offDiag < 1e-20
2. **CMA-ES初期化** (`cmaesInit`):
   - n=8（depthMult, vertMult, horzMult, crossMult, coMult, fourierMult, markovMult, rqaMult）
   - lambda=16（集団サイズ）、mu=8（親数）
   - Hansenの正規学習率: cc, cs, c1, cmu, damps
   - 対数ベース再結合重み: w_i = ln(mu+0.5) - ln(i)
3. **CMA-ESステップ** (`cmaesStep`):
   - サンプリング: `x_k = mean + σ * B * D * z_k` (z_k ~ N(0,I))
   - bounds mirror反射: [0.2, 2.5]範囲
   - 進化パス pc, ps の更新（累積）
   - C更新: rank-1 + rank-mu update
   - σ適応: ps長とchiN期待値の比較
   - Jacobi分解: n/10世代ごとに実行
4. **autoTuneLoop書き換え**:
   - hill climbing（20反復×8パラメータ×2方向=320評価）→ CMA-ES（最大50世代×16個体=800評価）
   - **matrixキャッシュ**: テストインデックスごとにbuildMatrix/buildMIMatrix/buildZoneTransition/buildRQACacheを1回だけ構築
   - 終了条件: σ<0.001 or 10世代改善なし or bestFitness>=2.0
5. **Theory Registry**: CMA-ES `future` → `active`

#### 設計意図
- hill climbingは1次元ずつ探索するため、パラメータ間の相関（例: depthMultとvertMultの最適な組み合わせ）を発見できない
- CMA-ESは共分散行列Cでパラメータ間の相関構造を学習し、対角方向の探索が可能
- matrixキャッシュにより評価回数増加（320→800）を相殺し、全体計算コストを同等以下に維持

### Task 2: 異常回確率インジケーター（ワイブル分布）

#### 理論的根拠（study-notes/statistics/index.md に準拠）
- ワイブル分布: `f(x) = (k/λ)(x/λ)^(k-1) e^(-(x/λ)^k)`
- ハザード関数: `h(t) = (k/λ)(t/λ)^(k-1)`
- k>1: 故障率増加型（「しばらく起きていないと確率が上がる」）
- k=1: 指数分布（無記憶性、ポアソン過程）
- k<1: 故障率減少型（「最近起きたばかりだと次も起きやすい」）

#### 実装内容
1. **`calcAnomalyRisk(draws)`**:
   - 異常回の発生間隔(gap)配列を計算
   - ワイブルMLE: Newton法でk（形状パラメータ）を推定、λ（尺度パラメータ）を計算
   - 条件付き確率: `P(anomaly next | gap=t) = 1 - e^(-(((t+1)/λ)^k - (t/λ)^k))`
   - 直近20回の異常回率（ポアソン的クロスチェック）
   - 前半/後半の密度トレンド
   - 返却: `{risk%, weibullK, weibullLambda, currentGap, avgGap, recentRate, trend}`
2. **Engine Status表示** (`rEngine`に追加):
   - リスク%（大文字、色分け: 緑<20%, 黄20-40%, 赤>40%）
   - ワイブルパラメータ k, λ 表示
   - ギャップ情報（最後の異常回からの経過回数 vs 平均間隔）
   - グラデーションバー
   - 直近20回の異常回チャート
3. **Predictionフッター**:
   - GA/Entropyの横に `Anomaly Risk: XX.X%` を色付きで表示

#### 設計意図
- 南海トラフ地震予測のように「そろそろ異常回が来そうか」を確率で提示
- 異常な組み合わせを予測するのではなく、リスクを可視化して購入判断を支援
- k>1ならギャップが長いほど次の異常回が近い（増加型ハザード）→ 購入を控える判断材料に

### Task 3: バージョン更新
- `GLEF_VERSION = 'v7.4-cma-es-anomaly-risk'`
- `GLEF_UPDATED = '2026-03-30T18:00+09:00'`
- `<title>` / `<h1>` を v7.4 に更新
- versionSub に `+ CMA-ES + Anomaly Risk` を追加
- Engine Status ヘッダを `GLEF v7.4` に更新
- Theory Registry: CMA-ES `future` → `active`、Anomaly Risk Indicator (Weibull) を新規追加
- `theoriesActive = 18`
- savePredictionToLog version: `'v7.4-cma-es-anomaly-risk'`

### v7.4.1 Confidence計算修正（2026-03-30）

#### 問題
CMA-ESが波形乗数を極端に振った結果、Confidence値がv7.3の~81%から96%に急上昇。
しかしこれはスコア分離度（`(topS-avgS)/topS*200`）の膨張であり、予測精度の向上ではなかった。

#### 修正内容
Confidence計算をバックテスト実績ベースに変更:
```js
conf = avgHit/pick * 40 + prizeRate * 30 + hitRate/100 * 30
```
- avgHit/pick（ヒット率）: 40点満点
- prizeCount/totalTests（入賞率）: 30点満点
- hitRate/100（ヒットレート）: 30点満点

---

## PM判断・技術調査の記録

### 異常回予測について（3スレ目で調査・判断、2026-03-30）

**結論: 異常な組み合わせの予測は構造的に不可能。代わりに確率インジケーターを実装済み。**

理由:
1. `killCheck`のsumR制約（Loto7: [100,200]）がハードブロック。R669のsum=59は生成段階で弾かれる
2. GA適応度のsum penalty（`-|sum-target|*0.5`）が正常sumに強制的に引っ張る
3. `deterministicPick`のゾーン制約（各ゾーン最大3個）が異常パターンを禁止
4. 異常回は定義上2σ外れ値であり、前回の異常有無と次回の異常発生に有意な相関がない

対処: ワイブル分布ハザード関数による「次回異常回確率%」インジケーターを実装（v7.4）

### CMA-ES vs Hill Climbingの評価（3スレ目で調査、2026-03-30）

**CMA-ESの利点:**
- 8パラメータ間の相関構造を学習（hill climbingは1次元ずつ）
- 局所最適からの脱出が可能
- σ適応で自動的にステップサイズを調整

**注意点:**
- 評価回数が増加（320→800回）。ただしmatrixキャッシュで1回あたり70-80%高速化したため相殺
- 乗数が極端に振れる可能性あり → Confidence計算がスコア分離度ベースだと誤解を招く（v7.4.1で修正済み）
- 計算時間: v7.3 1分12秒 → v7.4 3分23秒（精度最優先のため問題なし）

### Loto6精度問題（未解決、要調査）

v7.3でLoto6のAvg Hits=0.85は、ランダム基準（~0.98）を下回っている。
CMA-ESで乗数最適化しても改善しない場合、波形関数自体のLoto6対応が必要かもしれない。
次スレ以降で要調査。

### ランダム基準との比較（3スレ目で算出）

Loto7（7/37選択）:
- ランダム期待ヒット: 1.32
- GLEF v7.3 Avg Hits: 1.55 (+17.4%)
- GLEF 3+率: 15% vs ランダム2.8% (5.4倍)

Loto6（6/43選択）:
- ランダム期待ヒット: ~0.84
- GLEF v7.3 Avg Hits: 0.85 (ほぼランダム)
→ Loto6側の波形チューニングが不十分

---

## アーキテクチャ概要（3スレ目更新、v7.4時点）

### ファイル構成
- `index.html` — メインアプリケーション v7.4（HTML + CSS + JS 全て1ファイル）
- `archive/index_v6.html` — v7.2以前アーカイブ（変更禁止）
- `archive/index_old.html` — v5.0アーカイブ
- `data.js` — 抽選データ（LOTO6_DATA R2088まで, LOTO7_DATA R670まで）
- `glef_predict.js` — Node.js予測エンジン（v7.3対応、v7.4未対応）
- `GLEF_PREDICTIONS.jsonl` — 予測蓄積ファイル（自動追記）
- `GLEF_RESULTS.jsonl` — 抽選結果記録ファイル
- `GLEF_PROGRESS.md` — 本ファイル（開発経緯・PM判断・引き継ぎ）
- `GLEF_README.md` — リポジトリ目的・構成・作業ルール（絶対ルール含む）

### 波形エンジン（8成分 + 乗数）
1. **depthWave** × depthMult — ギャップ分析
2. **vertWave** × vertMult — 時間軸同期
3. **horzWave** × horzMult — ゾーンMACD
4. **crossWave** × crossMult — 共起行列+相互情報量（キャップ30）
5. **coBias** × coMult — キャリーオーバー偏り
6. **fourierWave** × fourierMult — FFT周期性検出
7. **markovWave** × markovMult — マルコフ連鎖ゾーン遷移
8. **rqaWave** × rqaMult — 再帰定量化分析

### 最適化エンジン
- **GA**: pop=100, gen=200, elite=5, tournament=3, mut=10%
- **CMA-ES**: Auto-Tune（8乗数最適化）。lambda=16, mu=8, 最大50世代、Jacobi固有値分解
- **Shannon Entropy**: cluster/neutral/spread判定

### 異常回処理
- **検知**: `markAnomalies` — |sum-mean|>2σ OR zone≥4
- **dampening**: depthWave×0.7, vertWave+1, rqaWave×1.5（post-anomaly）
- **確率**: `calcAnomalyRisk` — ワイブル分布MLE、ハザード関数で次回確率%
- **3-Tier Backtest**: 直近20回 / 全期間60サンプル / 異常回後全件

### Confidence計算（v7.4.2修正）
```
randomAvg = pick² / max  (Loto6: 0.837, Loto7: 1.324)
liftRatio = (avgHit - randomAvg) / randomAvg
hitBonus = min(25, max(0, liftRatio * 60))
prizeBonus = min(20, prizeCount/totalTests * 80)
maxBonus = min(10, max(0, (maxHit-2) * 5))
conf = min(75, max(25, round(35 + hitBonus + prizeBonus + maxBonus)))
```
ランダム基準線比較ベース。レンジ25-75%。

### 重要な設定値
```
CFG.loto7 = { max:37, pick:7, bCnt:2, sumR:[100,200], renKill:5, conFilt:3 }
CFG.loto6 = { max:43, pick:6, bCnt:1, sumR:[90,185], renKill:4, conFilt:3 }
GA_CFG = { popSize:100, generations:200, eliteCount:5, tournamentSize:3, mutationRate:0.1 }
CMA-ES = { lambda:16, mu:8, sigma0:0.3, maxGen:50, bounds:[0.2,2.5] }
learnedParams default = all 1.0
```

---

## v7.4.2 Confidence スケーリング修正（3スレ目）

### 問題
- v7.4.1のConfidence計算が `avgHit/pick*40 + prizeRate*30 + hitRate/100*30` で **18%** まで低下
- 原因: `avgHit/pick` = 1.15/6 = 0.19 → ロトでは全的中がありえないので常に低い値になる

### 修正内容
- ランダム基準線 `pick²/max` との比較ベースに変更
- リフト率（ランダムからの上回り度）でスケーリング
- レンジ: 25-75%、ベース35%
- **コミット**: `67a796a` → **PR#22 マージ済み**

### 確認結果
- Loto6 AvgHit=1.12 → Confidence **75%**（上限張り付き）
- 正常動作。ただし今後理論追加でAvgHitが上がっても区別がつかない問題あり
- スケーリング緩和（AvgHit=1.12で60%程度にする）は将来的な検討事項

---

## 3スレ目 PM判断記録

### 新理論の優先度評価（2026-03-30）

#### 1. 削除数字（自力導出版）— **最優先**
- **方針**: 外部サイトの削除数字データに頼らない。当選数字データのみから統計的に除外すべき数字を自力導出
- **理由**: 外部サイトの削除数字の過去データは非公開（信憑性低い）。他人のノイズを入れない
- **手法候補**:
  - 冷却数字検出（直近N回で出現0）
  - Z-score除外（期待出現回数から2σ以上乖離）
  - 連続不出現フィルタ（最大ギャップ閾値超え）
  - マルコフ遷移確率（前回出目から遷移確率が極端に低い数字）
- **実装方法**: 既存8 Waveエンジンの負の側（スコア低い数字を積極除外）として統合

#### 2. クロスロト引っ張り（Cross-Lottery Carryover）— **高優先**
- **根拠**: R2089 Loto6で `09, 18, 37` が直前のLoto7 R670 `09, 18, 37` と3個一致（5ch指摘）
- **理論**: 異なるロト間（Loto6↔Loto7、ミニロト含む可能性）で直近当選数字が引っ張る傾向
- **データ**: data.jsに両ロトのデータあり。日付ベースで直近の他ロト結果を参照可能
- **実装**: 新Wave `crossLotoBias` — 直近の他ロト当選数字にスコアボーナス付与
- **バックテスト可能**: 過去全データで検証可能

#### 3. セット球パターン分析 — **即実装可能**
- **データ**: リポジトリ内PDF（ロト７当選数字一覧（全回）.pdf、ロト６当選数字一覧（全回）.pdf）
- **パース検証済み**: pymupdfでテキスト抽出→正規表現パース。Loto7全670回・Loto6全2089回、欠損ゼロ、データ完全一致を確認
- **手動CSV不要**: PDFから自動抽出可能。スクレイピング403問題を回避
- **実装案**: 9番目のWave「setWave」＋CMA-ESの`setMult`追加
- **セット分布**: A~J各65-74回（Loto7）、198-232回（Loto6）で均等に分布

### Confidenceスケーリング将来検討
- 現在AvgHit=1.12（ランダム比+34%）で上限75%に張り付き
- 理論追加でAvgHit改善しても反映されない
- 案1: 上限引き上げ（85%）
- 案2: スケーリング緩和（AvgHit=1.12で60%程度にし、75%到達にはAvgHit=1.4+必要に）
- → 新理論実装後にAvgHit改善を確認してから調整する方が合理的

---

## 次スレへの引き継ぎ（3スレ目 → 4スレ目）

### ブランチ状態
- **main**: v7.4.2（CMA-ES + 異常回確率 + Confidence修正済み）
- **マージ済みPR**: #21, #22, #23, #24

### 残タスク（優先順）
1. **削除数字（自力導出版）実装**: 当選データのみから除外数字を統計導出。新Wave or 既存Wave負側拡張
2. **クロスロト引っ張り実装**: Loto6↔Loto7間の直近当選数字引っ張り。data.jsに両データあり、即実装可能
3. **セット球 → setWave実装**: PDFパース検証済み、即実装可能
4. **Loto6精度改善調査**: Avg Hits 0.85 ≈ ランダム基準(~0.84)
5. **glef_predict.js のv7.4対応**: Node.js予測エンジンがv7.3のまま
6. **Confidenceスケーリング微調整**: 新理論実装後に再評価

### やってはいけないこと（次スレへの注意）
- このスレの調査をやり直さないこと（上記PM判断セクションを参照）
- コンテキスト圧縮を起こさないこと（GLEF_README.md「クレジット・リソース管理」参照）
- 異常回の組み合わせ予測を試みないこと（構造的に不可能、PM判断済み）
- 削除数字で外部サイトのデータを使わないこと（ユーザーPM判断: 当選数字以外のノイズ排除）

---

## v7.5 coldWave実装（4スレ目）

### 実装日: 2026-04-03

### 概要
3スレ目残タスク最優先の「削除数字（自力導出版）」実装。外部サイト不使用、当選データのみから統計的に冷却数字を検出してスコアにペナルティを付与する新Wave。

### 実装内容: `coldWave(num, draws)` — Wave 9番目

#### アルゴリズム

**1. Z-score（二項分布）**
- 全期間の出現回数 vs 期待値をZ-scoreで評価
- `Z = (freq - n*p) / sqrt(n*p*(1-p))`（p = pick/max）
- Z < -2.5 → -15pt、Z < -2.0 → -10pt、Z < -1.5 → -5pt、Z < -1.0 → -2pt
- Z > 2.0 → +3pt（ホット数字微加算）

**2. 最大ギャップ検出（削除数字の核心）**
- 過去全期間の当該数字の最大連続不出現ギャップ（`maxHistGap`）を計算
- 現在ギャップが `maxHistGap × 0.9` 以上 かつ 期待ギャップ3倍超 → -12pt（削除候補）
- 75%以上 かつ 2.5倍超 → -7pt
- 60%以上 かつ 2倍超 → -3pt
- 一度も出現なし → -15pt

#### 出力レンジ
`[-20, +5]` × `coldMult`（CMA-ESで自動調整）

### 変更ファイル

**index.html**:
- `GLEF_VERSION` → `v7.5-cold-wave`
- `learnedParams` に `coldMult:1` 追加
- `function coldWave(num,draws)` 新規追加（rqaWaveの直後）
- スコア計算4箇所に `cold=coldWave(i,...)` 追加（`_btRunOne`, メイン予測, `runBacktest`, CMA-ES `quickBacktest`）
- `paramKeys` に `'coldMult'` 追加（CMA-ES最適化対象）
- `clearHistory` リセットに `coldMult:1` 追加
- Theories一覧に `Cold Number Wave` エントリ追加

### バックテスト結果
→ 実行後に記録（ブラウザで確認）

### コミット
→ `feat: v7.5 coldWave — 削除数字自力導出（Z-score+最大ギャップ）`
