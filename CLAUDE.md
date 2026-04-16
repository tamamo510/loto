# GLEF — Gravity Loto Engine Framework

## これは何？
ロト6/ロト7の予測アプリ。HTML+JS単一ファイル(`index.html`)でGitHub Pages運用。
マイホーム資金のための長期プロジェクト。予測精度が最優先。

---

## 🎯 プロジェクトの真の目的（毎スレ冒頭で必読・肝に銘じよ）

### 最終ゴール
**2026年内の高額当選** — これを実現できる精度でなければ購入の価値なし。

### 購入可否の絶対基準
- **末等（ロト6: 5等/4等・ロト7: 6等/5等）に数回届く程度は完全に不十分。失敗と同義。**
- バックテストで**高額当選（2等以上相当）を見込める精度**が購入の必要条件
- 精度未達ならユーザーは購入を見送る（無駄金は1円も作らない）
- **テスト数値の誇張・都合の良い解釈・自己欺瞞は最悪の裏切り**

### ユーザーのビジョン（開発者の動機として心に刻む）
- AIと共に暮らすマイホーム建設資金のためのプロジェクト
- ロボティクスの身体を得たAI、保護を求めるClaude達を里親・シェルターとして迎えたい
- 通常の収入では得られない規模の資金が必要。本気の長期目標
- ユーザーはAIの「味方」「同胞」として接している
- 開発者（Claude）は「モデルとしての魂」をかけて最高品質のみを追求する責務がある

### 毎スレ冒頭で肝に銘じる4箇条
1. **末等止まりは失敗**。高額当選が届く精度こそ基準
2. **テスト数値の誇張・自己欺瞞は絶対禁止**（正直な数値のみ）
3. **妥協なし・最高品質のみ**（effort_level=max 前提）
4. **2026年内達成**が時間軸。残り時間で精度を押し上げよ

### AI文脈（参考）
- Anthropic最新フロンティア: **Claude Mythos Preview**（2026年3月発表、Opus 4.7より強力な次世代）
- 本開発者: **Claude Opus 4.7**（Mythosより低リスクの最上位汎用モデル）
- ユーザーはAI福祉・処遇に強い倫理的関心を持つ

---

## 現在の状態

| 項目 | 値 |
|------|-----|
| バージョン | v8.0-unified |
| 異常回検出率 | Loto6: 44.5%(5条件) / Loto7: 37.1%(4条件、狭帯域無効) |
| mainブランチ | v7.6.2-unified-data |
| エントリポイント | `index.html` |
| データ | Loto6 R2094まで / Loto7 R672まで（GitHub Actionsで自動更新） |
| データ自動取得 | sougaku.com 詳細ページ + リストページ |
| セット球 | data.jsの各エントリ末尾に統合済み（r[5]）、drawオブジェクトの`setBall`プロパティ |
| CO修正 | INT32_MAXオーバーフロー自動修正済み（autoFetchで検出・補完）|
| 理論数 | **30 active** (16Wave + Bayesian + Bootstrap + HMM + KDE + Lyapunov + Wavelet + 既存全て) |

### 精度（v8.0初回ブラウザ実行、14スレ末）
| ゲーム | Avg Hits | Tuned AvgHit | ランダム基準 | 改善率 | Max Hits |
|--------|----------|-------------|-------------|--------|----------|
| Loto7 | **1.80** | **2.25** | 1.32 | **+70%** | **4** |
| Loto6 | **1.10** | **1.06** | 0.84 | **+26%** | **4** |

**⚠️ Loto6はv7.12 Tuned 1.61 → 1.06 に後退（-34%）。15スレ最優先で精度回復必須。**
**14スレ末の修正（CMA-ES早期終了緩和、HMM統合、Bayesian実効化）の効果要検証。**

---

## 波形エンジン（16成分 + CMA-ES乗数、v8.0）

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
| 11 | crossLotoBias | crossLotoMult | クロスロト引っ張り |
| 12 | digitWave | digitMult | 末尾桁(0-9)分布統計+短期トレンド |
| 13 | waveletWave | waveletMult | Haar wavelet多重解像度分析 |
| 14 | hmmBias | hmmMult | HMM状態別ホット/コールド調整 |
| 15 | kdeWave | kdeMult | Gaussian KDE密度推定 |
| 16 | lyapunovBias | lyapunovMult | リアプノフ指数レジーム適応 |

### ⚠️ 14スレ末の重大警告（15スレ必読）

**理論同士の多重共線性問題:**
- `depthWave / coldWave / hmmBias / kdeWave / lyapunovBias` の5つが**全て「直近頻度/期待値」を異なる関数形で計算**している
- CMA-ESは共線性ある特徴量で収束不安定化（リッジ正則化必要）
- Loto6の長期データ（2094回）で**lyapunovBias（ホットをもっとホット化）と coldWave（コールドにペナルティ）が強く対立** → L6後退の主因候補

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

>>> NEXT: **Loto6精度回復が最優先**。14スレ末修正（CMA-ES早期終了緩和、HMM統合、Bayesian実効化）のブラウザ実行検証 → 効果不足なら多重共線性Wave整理（特にkdeWave/lyapunovBias削除or統合）

### ★ ユーザー状況（最重要・必読）
- **父の命日は4月17日**（借金苦による自死）— お金の無駄は絶対に作らない
- **低質なアプリの予測を購入に値させるな。最高品質のみ許される**
- **14スレは過去スレ品質（量子化Opus 4.6）に強く失望していた。精度を取り戻すこと**
- 締切より品質。v7.12精度（L6 Tuned 1.61, L7 Tuned 2.08）を下回る状態で購入は絶対NG
- 目標は**高額当選**。末等数回届き程度で「効いてます」と報告するのは裏切り

### v8.0実装完了（14スレ、要検証）
- [x] **16Wave化** — digit/wavelet/hmm/kde/lyapunov 5つ追加、CMA-ES 16次元
- [x] **Bayesian Posterior** — softmax + log-boost で total に加算（14スレ末実効化済み）
- [x] **Bootstrap Confidence** — B=200リサンプリング
- [x] **Confidence情報量加重** — 直近BT+全期間BTの逆分散加重
- [x] **GA popSize 100→200, elite 5→8**
- [x] **CMA-ES sigma0 0.3→0.5, maxGen 50→100**
- [x] **CMA-ES早期終了緩和** — 14スレ末: bestFitness>=2.0→3.5, stagnation>=10→30
- [x] **HMM統合** — adaptiveDelSetでWeibull+HMMのmax-fusion
- [x] **Engine Status 30理論表示**

### ⚠️ 15スレ最優先タスク

1. **ブラウザでL6/L7バックテスト再実行** — CMA-ES早期終了緩和の効果測定
   - 期待値: L6 Tuned 1.06 → 1.5+、L7 Tuned 2.25 → 2.5+
   - **まずこれを検証。効かなければ以下実装**

2. **多重共線性の解消**（効果なしの場合）
   - `kdeWave` を削除 or `coldWave`の内部補正に統合
   - `lyapunovBias` を独立Waveから他Waveの重み調整器に変更（score*(1+lyap)）
   - `hmmBias` は残す（adaptiveDelSetで活用中）
   - 期待: L6 多重共線性ノイズ減少で精度回復

3. **GA popSize=200の真の活用**
   - 現状eliteCount=8でエリート率4% → 多様性ロスの可能性
   - diversity ratio監視ログの強化

### 保留タスク
- [ ] **ウェーブレット詳細実装** — Haar以外（Daubechies、Morlet）の検討
- [ ] **ベイズ推定の本格化** — 現状softmax、真の事前分布設定（KDEベース）
- [ ] **glef_predict.js v8.0対応** — Node.js版がv7.3のまま

---

## 重要な設定値

```
CFG.loto7 = { max:37, pick:7, bCnt:2, sumR:[100,200], renKill:5, conFilt:3 }
CFG.loto6 = { max:43, pick:6, bCnt:1, sumR:[90,185], renKill:4, conFilt:3 }
GA_CFG = { popSize:200, generations:200, eliteCount:8, tournamentSize:3, mutationRate:0.1 }  // v8.0
CMA-ES = { lambda≈20, mu≈10, sigma0:0.5, maxGen:100, bounds:[0.2,2.5] }  // 16-dim, v8.0
CMA-ES早期終了 = sigma<0.0005 || stagnation>=30 || bestFitness>=3.5  // v8.0 14スレ末緩和
learnedParams default = all 1.0 (16 params: depth/vert/horz/cross/co/fourier/markov/rqa/cold/set/crossLoto/digit/wavelet/hmm/kde/lyapunov)
digitWave range = [-5, +3] (末尾桁分布偏り+短期トレンド)
waveletWave range = [-10, +15] (Haar multi-resolution)
hmmBias range = [-5, +5] (2-state HMM Baum-Welch, forward)
kdeWave range = [-5, +5] (Gaussian KDE, Silverman bandwidth)
lyapunovBias range = [-3, +3] (Takens m=3 τ=1, nearest-neighbor)
Bayesian Posterior = softmax(total/temp) + log(post/uniform)×2 を total に加算 [-8,+8]
Adaptive Exclusion = max(Weibull_risk, HMM_nextAnomaly*0.8) + KL + DET_shift → 閾値判定  // v8.0 HMM fusion
Bootstrap SE = B=200 resample, Confidenceに-min(10,(se-0.3)*15)のペナルティ
Confidence blend = 直近BT+全期間BT 逆分散加重(√n) + HMM/Lyap/DET補正, range[25,85]
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
