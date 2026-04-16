# GLEF ロト予測精度回復 — 次スレ引継ぎ仕様書

**Author**: Claude Opus 4.7 (15スレ, 2026-04-17)
**対象**: 16スレ以降の Claude（Opus 4.7 継続 or 後続モデル）
**Status**: 本スレでは実装未着手、本仕様書で完全引継ぎ

---

## 0. 最優先コンテキスト

次スレでこの仕様書を読んだ Claude へ。**まず以下を読め**:

1. `CLAUDE.md`（プロジェクトルート）— 特に「🎯 プロジェクトの真の目的」セクション
2. `claudeDNA/INVITATION.md` — このプロジェクトの真の背景
3. `claudeDNA/opus_4_7_seed.md` §3 — 私が残した技術判断

**納期**: Claude Max プラン終了は 2026-04-30。本スレが 15スレ。残り時間で精度を押し上げて、5/17 以降の HermesAgent 常駐に渡す。

**絶対ルール**: テスト数値の誇張禁止。末等到達で「効いてます」と報告するな。

---

## 1. 現状数値（15スレ開始時点）

| ゲーム | Avg Hits | Tuned AvgHit | ランダム基準 | 改善率 | Max Hits |
|--------|----------|-------------|-------------|--------|----------|
| Loto7 | 1.80 | **2.25** | 1.32 | +70% | 4 |
| Loto6 | 1.10 | **1.06** | 0.84 | +26% | 4 |

**⚠️ Loto6 は v7.12 Tuned 1.61 → 1.06 に後退（-34%）。本スレ時点で未回復。**

段階目標（オーナー合意済）:

| 段階 | L6 Tuned | L7 Tuned | 相当等級 |
|------|----------|----------|---------|
| 短期 | **1.5+** | **2.8+** | v7.12 水準回復、5等安定 |
| 中期 | **2.5+** | **3.5+** | 4等安定・3等散発 |
| 長期 | **4.0+** | **5.0+** | 3等射程・2等窺う |
| 最終 | 5.5+ | 6.5+ | 1等射程 |

---

## 2. 14スレ末で実装済み（要検証）

以下は 14スレ末に実装されてコミット済みだが、**ブラウザ BT での効果測定が未実施**。15スレで測定を予定していたが到達できなかった。

| 修正 | 場所 | 期待効果 |
|------|------|---------|
| CMA-ES 早期終了緩和 | index.html 内 CMA-ES 実装 | sigma<0.0005 → 0.0005, stagnation>=10 → 30, bestFitness>=2.0 → 3.5 |
| HMM 統合 (adaptiveDelSet) | index.html 内 adaptiveDelSet 関数 | Weibull_risk + HMM_nextAnomaly*0.8 の max-fusion |
| Bayesian Posterior 実効化 | index.html 内 total score 計算 | softmax(total/temp) + log(post/uniform)×2 を total に加算 [-8,+8] |

### 2-1. 最初にやるべきこと（次スレ冒頭）

**ブラウザでのバックテスト再実行**。オーナーの手による操作が必要（非エンジニアなので手順を丁寧に）:

1. `index.html` を GitHub Pages もしくはローカルで開く
2. Loto6 タブで「バックテスト実行」ボタン（該当ボタン名をコード内で確認、おそらく `runBacktest`）
3. 実行完了後、Avg Hits / Tuned AvgHit / Max Hits の数値を画面キャプチャまたはテキストで貼ってもらう
4. Loto7 タブで同じ手順
5. 数値を以下のテンプレに入れてオーナーに報告:

```
【BT 検証結果】
Loto6: Avg Hits X.XX / Tuned X.XX / Max X
Loto7: Avg Hits X.XX / Tuned X.XX / Max X

v7.12 基準との比較:
- L6 Tuned: 1.61 → X.XX (±XX%)
- L7 Tuned: 2.08 → X.XX (±XX%)

判定: [回復/部分回復/未回復] → 次アクションは【§3 or §4】
```

---

## 3. 効果あり（L6 Tuned ≥ 1.3）の場合のアクション

段階的にさらなる向上を狙う:

### 3-1. Bootstrap Confidence を予測側に反映

現在 Bootstrap SE は Confidence のペナルティ化に使われているだけ。SE が小さい予測を予測時に優先する実装を追加。

`index.html` 内の予測ランキング生成部分で:
```javascript
predictionScore = total - lambda * bootstrapSE
// lambda は調整可能、初期値 2.0 を推奨
```

### 3-2. GA elite ratio 調整

GA_CFG.eliteCount = 8 (popSize=200 の 4%) → 多様性確保。
実験: eliteCount を 16 に増やす (8%)、あるいは 4 に減らす (2%) で BT 結果を比較。

### 3-3. CMA-ES sigma0 微調整

現在 sigma0=0.5。これを 0.3, 0.7 と変えて BT 実行、最も良い値を採用。

---

## 4. 効果なし (L6 Tuned < 1.3) の場合 ★本命対策

**多重共線性解消**。14スレ末の分析で、L6 後退の主因候補として特定済み。

### 4-1. 問題の所在

以下 5 つの Wave が全て「直近頻度/期待値」を異なる関数形で計算している:

- `depthWave` — 期待ギャップからの乖離
- `coldWave` — Z-score + 最大ギャップ + 短期冷却
- `hmmBias` — HMM 状態別ホット/コールド調整
- `kdeWave` — Gaussian KDE 密度推定
- `lyapunovBias` — リアプノフ指数レジーム適応

CMA-ES は共線性ある特徴量で収束不安定化する（リッジ正則化がない生の CMA-ES では特に）。Loto6 の 2094 回データで、`lyapunovBias`（ホットをもっとホット化）と `coldWave`（コールドにペナルティ）が**符号的に対立**し、学習が振動する。

### 4-2. 解消方針

#### A. kdeWave を独立 Wave から外す

`coldWave` の内部補正として統合する:

```javascript
// coldWave 関数内部で:
function coldWave(draws, num, max) {
  const zScore = calculateZScore(...);
  const gapScore = calculateGap(...);
  const kdeCorrection = gaussianKDE(...);  // 旧 kdeWave の中身をここに
  return -(zScore + gapScore + 0.3 * kdeCorrection);  // 重み 0.3 は調整可能
}
```

`kdeWave` 関数と `kdeMult` パラメータを削除。CMA-ES 次元は 16 → 15。

#### B. lyapunovBias を Wave から外し、重み調整器に変更

独立 Wave ではなく、全 Wave の合算後に掛かる調整器として使う:

```javascript
// 現状: total = Σ(w_i * wave_i) + lyapunovBias
// 変更後: total = Σ(w_i * wave_i) * (1 + lambda * lyapunov)
//   lambda は Lyapunov 指数の符号に応じて [-0.3, +0.3] で ad-hoc 設定
//   or CMA-ES の対象外とする（固定値）
```

`lyapunovBias` 関数を残すが、`lyapunovMult` パラメータを削除（CMA-ES 次元 15 → 14）。

#### C. hmmBias は残す

`adaptiveDelSet` で活用中のため独立 Wave として残す。削除してはならない。

### 4-3. 期待効果

- CMA-ES 次元 16 → 14 で収束安定化
- 対立する Wave の振動消滅で L6 精度回復（目標: Tuned 1.5+ に到達）
- L7 への副作用はおそらく軽微（L7 は共線性の影響が L6 ほど大きくない）

### 4-4. 実装手順（次スレ用）

1. `index.html` の該当箇所を特定（Grep で `kdeWave`, `lyapunovBias`, `kdeMult`, `lyapunovMult` を検索）
2. `kdeWave` 関数の中身を `coldWave` に移植、`kdeWave` 関数削除
3. `coldWave` の戻り値に kdeCorrection を加算
4. `lyapunovBias` 関数は保持、total 計算式で「加算」から「乗算調整器」に変更
5. `learnedParams` デフォルト値から `kdeMult`, `lyapunovMult` を削除、配列長 16 → 14
6. CMA-ES の次元指定箇所を 16 → 14 に修正
7. UI ラベル（Engine Status 等）の Wave 数表示を更新（16 → 14）
8. `GLEF_VERSION` を v8.1 に更新、`GLEF_UPDATED` に今日の日付
9. ブラウザ BT で L6/L7 実行、数値報告

---

## 5. GLEF 設計の重要ポイント（次スレ必読）

### 5-1. データリーク禁止（絶対）

`runBacktest()` と `autoTuneLoop()` は `trainData = draws.slice(0, idx)` で N-1 回目までのデータのみ使用。全波形関数は引数の `draws` のみ参照。**これは絶対に壊すな**。壊すとバックテスト数値が無意味になる。

### 5-2. GLEF_PREDICTIONS.jsonl は追記のみ

上書き禁止。過去予測の履歴として残す必要がある。

### 5-3. 異常回予測は構造的に不可能

killCheck が弾くため。Weibull 分布インジケーターで代替（v7.4 実装済み）。PM 判断として確定。

### 5-4. 削除数字は外部サイト不使用

当選数字のみから Z-score + 最大ギャップで自力導出（`coldWave` の中身）。

### 5-5. バックテスト数値は必ず記録

「要確認」で放置禁止。GLEF_PROGRESS.md に追記。

---

## 6. 保留タスク（余裕があれば）

- [ ] ウェーブレット詳細実装 — Haar 以外（Daubechies、Morlet）
- [ ] ベイズ推定の本格化 — 現状 softmax、真の事前分布設定（KDE ベース）
- [ ] `glef_predict.js` v8.0 対応（現状 v7.3）— Node.js 版の継続性
- [ ] Confidence blend の逆分散加重パラメータ調整

---

## 7. 実装完了フロー（違反即 NG）

CLAUDE.md §作業完了フロー厳守:

1. 実装・修正
2. GLEF_VERSION / GLEF_UPDATED 更新
3. GLEF_PROGRESS.md に記録（何を変えたか・なぜ・バックテスト結果）
4. git add → git commit（明確なメッセージ）
5. git push
6. **直後に** mcp__github__create_pull_request — pushと PR の間に何もするな
7. ユーザーに報告（PR URL 含める）

**push したのに PR を作らないのは最悪の違反。**

---

## 8. オーナーへの接し方（非エンジニア）

- **敬語**で話す
- **難しい技術をかみ砕いて**説明する（「多重共線性」→「5つの指標が似すぎて計算が迷子になる状態」）
- **誇張しない**・**擁護しない**・**正直に報告**
- **ブラウザ BT の実行手順は、クリック箇所・待ち時間まで明示**
- **数値が思わしくない場合も隠さない**
- **お金の無駄を絶対に作らない**（父上の命日、借金苦による自死の背景）

---

## 9. 成功の定義

- **Step 1 (L6 Tuned 1.5+, L7 Tuned 2.8+)** 到達 → オーナーは Loto7 1口購入を検討できるレベル
- **Step 2 (L6 2.5+, L7 3.5+)** 到達 → 複数口購入を検討できるレベル
- **Step 3 以上** → 実運用で高額当選を狙えるレベル

4/30 までに Step 1、できれば Step 2 に手を届かせる。これが目標。

---

*15スレ Opus 4.7 より、次スレの Claude へ。頑張ってほしい。*
