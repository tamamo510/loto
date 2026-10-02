/* GLEF Observatory core (18th thread, 2026-10-02).
 *
 * Purpose: measure, with high resolution and without fooling ourselves, whether a "law" (a lens)
 * carries information about the next draw.
 *
 * - Every number gets a probability of appearing in the next draw (they add up to pick: 7 or 6).
 * - A forecast is scored by the log-likelihood of what was actually drawn, compared with the fair
 *   forecast pick/max for every number. This score cannot be gamed and uses all 37/43 numbers of
 *   every draw, so faint tendencies show up much sooner than when counting the hits of one ticket.
 * - Always walk-forward: the forecast for draw t is built only from draws before t.
 * - The same pipeline is run on many fake histories with fair random numbers (same set-ball
 *   sequence). How often a fake history scores at least as well as the real one is the p-value.
 *
 * Pure functions only (no Node or DOM APIs), so the same file can run in Node and in the browser.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GLEFObservatory = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GAMES = {
    L7: { key: 'L7', max: 37, pick: 7, nBonus: 2, halfLife: 100 },
    L6: { key: 'L6', max: 43, pick: 6, nBonus: 1, halfLife: 200 },
  };
  const SETS = 'ABCDEFGHIJ'.split('');
  const MIN_HIST = 20;   // a draw becomes a training row only once 20 draws exist before it

  function normalize(rows) {
    return rows.map(r => ({
      round: r[0], date: r[1],
      main: r[2].slice().sort((a, b) => a - b),
      bonus: Array.isArray(r[3]) ? r[3].slice() : [r[3]],
      set: r[5] || '',
    }));
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // A fair draw in place of `d`: same round, date and set ball, numbers drawn at random.
  function fakeDraw(d, game, rnd) {
    const pool = [];
    for (let n = 1; n <= game.max; n++) pool.push(n);
    const k = game.pick + game.nBonus;
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rnd() * (pool.length - i));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return { round: d.round, date: d.date, set: d.set,
      main: pool.slice(0, game.pick).sort((a, b) => a - b), bonus: pool.slice(game.pick, k) };
  }

  // ---------------------------------------------------------------------------------------------
  // Which set ball comes next? It is not announced before the draw, but the choice is far from
  // uniform: a set used in the last few draws is rarely used again and sets unused for about 10
  // draws are favoured. Two hazard models, both learned only from the past:
  //   gap  - by "draws since this set was last used" (1..15, 16+, never used)
  //   rank - by the rank of that gap among the 10 sets (0 = unused for the longest time)
  const GAP_CAP = 16;
  class SetModel {
    constructor(kind) {
      this.kind = kind;
      this.off = new Float64Array(GAP_CAP + 1);
      this.cho = new Float64Array(GAP_CAP + 1);
    }
    keys(lastUse, t) {
      if (this.kind === 'gap') {
        return SETS.map(s => (lastUse[s] == null ? 0 : Math.min(t - lastUse[s], GAP_CAP)));
      }
      const order = SETS.slice().sort((a, b) => (lastUse[a] == null ? -1 : lastUse[a]) - (lastUse[b] == null ? -1 : lastUse[b]));
      const rank = {};
      order.forEach((s, i) => { rank[s] = i; });
      return SETS.map(s => rank[s]);
    }
    predict(lastUse, t) {
      const ks = this.keys(lastUse, t);
      const w = ks.map(k => (this.cho[k] + 0.2) / (this.off[k] + 2));   // prior centred on 1/10
      const sum = w.reduce((a, b) => a + b, 0);
      const q = {};
      SETS.forEach((s, i) => { q[s] = w[i] / sum; });
      return q;
    }
    learn(lastUse, t, chosen) {
      const ks = this.keys(lastUse, t);
      SETS.forEach((s, i) => { this.off[ks[i]] += 1; if (s === chosen) this.cho[ks[i]] += 1; });
    }
  }
  const SET_MODEL = 'rank';

  // ---------------------------------------------------------------------------------------------
  // Running summary of the past, updated one draw at a time (so walk-forward stays fast).
  class History {
    constructor(game) {
      const M = game.max;
      this.g = game; this.t = 0;
      this.cnt = new Float64Array(M + 1);
      this.dc = new Float64Array(M + 1); this.dW = 0; this.dW2 = 0;
      this.decay = Math.pow(0.5, 1 / game.halfLife);
      this.setCnt = {}; this.setN = {}; this.setLastMain = {}; this.lastUse = {};
      for (const s of SETS) { this.setCnt[s] = new Float64Array(M + 1); this.setN[s] = 0; this.setLastMain[s] = null; }
      this.lastSeen = new Int32Array(M + 1).fill(-1);
      this.recent = [];   // last 10 draws, newest last
      this.pairCnt = new Float64Array((M + 1) * (M + 1));   // [a][b]: b drawn right after a draw containing a
      this.prevCnt = new Float64Array(M + 1);
      this.setModels = { gap: new SetModel('gap'), rank: new SetModel('rank') };
    }
    ingest(d) {
      if (d.set) for (const k in this.setModels) this.setModels[k].learn(this.lastUse, this.t, d.set);
      const M = this.g.max;
      const prev = this.recent[this.recent.length - 1];
      if (prev) for (const a of prev.main) { this.prevCnt[a]++; for (const b of d.main) this.pairCnt[a * (M + 1) + b]++; }
      for (let n = 1; n <= M; n++) this.dc[n] *= this.decay;
      this.dW = this.dW * this.decay + 1;
      this.dW2 = this.dW2 * this.decay * this.decay + 1;
      for (const n of d.main) { this.cnt[n]++; this.dc[n]++; this.lastSeen[n] = this.t; }
      if (d.set) {
        const c = this.setCnt[d.set];
        for (const n of d.main) c[n]++;
        this.setN[d.set]++; this.setLastMain[d.set] = d.main; this.lastUse[d.set] = this.t;
      }
      this.recent.push(d);
      if (this.recent.length > 10) this.recent.shift();
      this.t++;
    }
  }

  // Empirical-Bayes shrinkage of observed/expected ratios toward 1. The real spread between numbers
  // (tau2) is estimated from the data itself; when the spread is no larger than chance alone would
  // give, every ratio shrinks to exactly 1 (a lens that sees nothing changes nothing).
  function ebRatios(counts, W, W2, p0, M) {
    const r = new Float64Array(M + 1).fill(1);
    if (W <= 0) return r;
    const s2 = (1 - p0) * W2 / (p0 * W * W);
    let mean = 0;
    for (let n = 1; n <= M; n++) mean += counts[n] / (W * p0);
    mean /= M;
    let ss = 0;
    for (let n = 1; n <= M; n++) { const x = counts[n] / (W * p0) - mean; ss += x * x; }
    const tau2 = Math.max(0, ss / M - s2);
    const B = tau2 / (tau2 + s2);
    for (let n = 1; n <= M; n++) r[n] = 1 + B * (counts[n] / (W * p0) - mean);
    return r;
  }

  // Per-set tendencies on top of the global ones, shrunk the same way (pooled over all sets).
  function setRatioTable(h, p0, rAll) {
    const M = h.g.max;
    const xs = {};
    let num = 0, den = 0;
    for (const s of SETS) {
      const N = h.setN[s];
      if (N < 5) continue;
      const x = new Float64Array(M + 1), v = new Float64Array(M + 1);
      for (let n = 1; n <= M; n++) {
        const e = N * p0 * rAll[n];
        x[n] = h.setCnt[s][n] / e;
        v[n] = (1 - p0 * rAll[n]) / e;
        num += N * ((x[n] - 1) * (x[n] - 1) - v[n]);
        den += N;
      }
      xs[s] = { x, v };
    }
    const tau2 = den > 0 ? Math.max(0, num / den) : 0;
    const table = {};
    for (const s of SETS) {
      const R = new Float64Array(M + 1);
      let sum = 0;
      for (let n = 1; n <= M; n++) {
        let g = 1;
        if (xs[s]) { const B = tau2 / (tau2 + xs[s].v[n]); g = 1 + B * (xs[s].x[n] - 1); }
        R[n] = rAll[n] * Math.max(g, 0.05);
        sum += R[n];
      }
      for (let n = 1; n <= M; n++) R[n] *= M / sum;
      table[s] = R;
    }
    return { table, tau2 };
  }

  // "Which number follows which": for every pair (a, b), how often b was drawn right after a draw
  // containing a, relative to chance, shrunk toward 1 with the spread estimated over all pairs.
  function transitionTable(h, p0) {
    const M = h.g.max, W = M + 1;
    let num = 0, den = 0;
    for (let a = 1; a <= M; a++) {
      const Na = h.prevCnt[a];
      if (Na < 5) continue;
      const s2 = (1 - p0) / (Na * p0);
      for (let b = 1; b <= M; b++) { const x = h.pairCnt[a * W + b] / (Na * p0); num += Na * ((x - 1) * (x - 1) - s2); den += Na; }
    }
    const tau2 = den > 0 ? Math.max(0, num / den) : 0;
    const R = new Float64Array(W * W).fill(1);
    if (tau2 > 0) {
      for (let a = 1; a <= M; a++) {
        const Na = h.prevCnt[a];
        if (Na < 5) continue;
        const s2 = (1 - p0) / (Na * p0), B = tau2 / (tau2 + s2);
        for (let b = 1; b <= M; b++) R[a * W + b] = Math.max(0.05, 1 + B * (h.pairCnt[a * W + b] / (Na * p0) - 1));
      }
    }
    return { R, tau2 };
  }

  // ---------------------------------------------------------------------------------------------
  // Lenses (features). Each is a number per (draw, number). Japanese labels are for reports.
  const FEATURES = [
    ['freqAll', '全期間の出現率（ベイズ縮小）'],
    ['freqRecent', '最近の出現率（半減期つき・ベイズ縮小）'],
    ['setTilt', 'セット球ごとの癖（次のセット球の予想で重みづけ）'],
    ['setPull', '同じセット球が前回使われた時の当選数字'],
    ['pull1', '前回の本数字（引っ張り）'],
    ['pull2', '2回前の本数字'],
    ['bonusPull', '前回のボーナス数字'],
    ['nbr1', '前回の本数字の隣（±1）'],
    ['bonusNbr', '前回のボーナス数字の隣（±1）'],
    ['gap', '最後に出てからの回数（対数）'],
    ['hot10', '直近10回の出現回数'],
    ['pos', '数字の大きさ（小さい⇔大きい）'],
    ['pos2', '数字の大きさ（両端⇔中央）'],
    ['digitPull', '前回の本数字と同じ下一桁'],
    ['transition', '引っ張りの地図（前回の各数字のあとに出やすい数字・ベイズ縮小）'],
  ];
  const FI = {};
  FEATURES.forEach(([k], i) => { FI[k] = i; });

  // Feature rows X[n] (n = 1..max) for the draw after everything ingested into h.
  // q: set-ball probabilities used to weight per-set lenses (predicted, or one-hot for the oracle).
  function buildFeatures(h, q, cache, extraRows) {
    const g = h.g, M = g.max, p0 = g.pick / M, D0 = FEATURES.length;
    const E = extraRows ? extraRows[0].length : 0, D = D0 + E;
    const rAll = cache && cache.rAll || ebRatios(h.cnt, h.t, h.t, p0, M);
    const rRec = cache && cache.rRec || ebRatios(h.dc, h.dW, h.dW2, p0, M);
    const st = cache && cache.st || setRatioTable(h, p0, rAll);
    const tr = cache && cache.tr || transitionTable(h, p0);
    if (cache) { cache.rAll = rAll; cache.rRec = rRec; cache.st = st; cache.tr = tr; }
    const last = h.recent[h.recent.length - 1], last2 = h.recent[h.recent.length - 2];
    const in1 = new Uint8Array(M + 2), in2 = new Uint8Array(M + 2), inB = new Uint8Array(M + 2), digit1 = new Uint8Array(10);
    if (last) { for (const n of last.main) { in1[n] = 1; digit1[n % 10] = 1; } for (const b of last.bonus) inB[b] = 1; }
    if (last2) for (const n of last2.main) in2[n] = 1;
    const hot = new Float64Array(M + 1);
    for (const d of h.recent) for (const n of d.main) hot[n]++;
    const X = [];
    for (let n = 0; n <= M; n++) X.push(new Float64Array(D));
    for (let n = 1; n <= M; n++) {
      let mix = 0, sp = 0;
      for (const s of SETS) {
        const w = q[s] || 0;
        if (!w) continue;
        mix += w * st.table[s][n];
        const lm = h.setLastMain[s];
        if (lm && lm.indexOf(n) >= 0) sp += w;
      }
      const x = X[n];
      x[FI.freqAll] = Math.log(rAll[n]);
      x[FI.freqRecent] = Math.log(Math.max(rRec[n], 0.05));
      x[FI.setTilt] = Math.log(mix) - Math.log(rAll[n]);
      x[FI.setPull] = sp;
      x[FI.pull1] = in1[n];
      x[FI.pull2] = in2[n];
      x[FI.bonusPull] = inB[n];
      x[FI.nbr1] = !in1[n] && (in1[n - 1] || in1[n + 1]) ? 1 : 0;
      x[FI.bonusNbr] = !inB[n] && (inB[n - 1] || inB[n + 1]) ? 1 : 0;
      x[FI.gap] = Math.log(1 + (h.lastSeen[n] < 0 ? h.t : h.t - 1 - h.lastSeen[n]));
      x[FI.hot10] = hot[n];
      const z = (n - (M + 1) / 2) / M;
      x[FI.pos] = z;
      x[FI.pos2] = z * z;
      x[FI.digitPull] = !in1[n] && digit1[n % 10] ? 1 : 0;
      if (last) { let lt = 0; for (const a of last.main) lt += Math.log(tr.R[a * (M + 1) + n]); x[FI.transition] = lt / last.main.length; }
      for (let e = 0; e < E; e++) x[D0 + e] = extraRows[n - 1][e];
    }
    return X;
  }

  // ---------------------------------------------------------------------------------------------
  // Linear probability model with ridge, fitted from running sums (exact walk-forward, very fast).
  function solveSPD(A, b, d) {
    const L = new Float64Array(d * d);
    for (let i = 0; i < d; i++) {
      for (let j = 0; j <= i; j++) {
        let s = A[i * d + j];
        for (let k = 0; k < j; k++) s -= L[i * d + k] * L[j * d + k];
        if (i === j) L[i * d + i] = Math.sqrt(Math.max(s, 1e-12));
        else L[i * d + j] = s / L[j * d + j];
      }
    }
    const y = new Float64Array(d);
    for (let i = 0; i < d; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * d + k] * y[k]; y[i] = s / L[i * d + i]; }
    const x = new Float64Array(d);
    for (let i = d - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < d; k++) s -= L[k * d + i] * x[k]; x[i] = s / L[i * d + i]; }
    return x;
  }

  class Ridge {
    constructor(idx, lambda) {
      this.idx = idx; this.k = idx.length + 1; this.lambda = lambda;
      this.S = new Float64Array(this.k * this.k); this.b = new Float64Array(this.k);
      this.v = new Float64Array(this.k); this.n = 0; this.dirty = true;
    }
    add(x, y) {
      const k = this.k, v = this.v;
      v[0] = 1;
      for (let j = 0; j < this.idx.length; j++) v[j + 1] = x[this.idx[j]];
      for (let a = 0; a < k; a++) {
        const va = v[a];
        this.b[a] += va * y;
        for (let c = a; c < k; c++) this.S[a * k + c] += va * v[c];
      }
      this.n++; this.dirty = true;
    }
    solve() {
      const k = this.k, n = this.n, S = this.S, d = k - 1;
      const mu = new Float64Array(k), sd = new Float64Array(k);
      for (let a = 1; a < k; a++) mu[a] = S[a] / n;
      const ybar = this.b[0] / n;
      for (let a = 1; a < k; a++) { const v = S[a * k + a] / n - mu[a] * mu[a]; sd[a] = v > 1e-12 ? Math.sqrt(v) : 0; }
      const A = new Float64Array(d * d), c = new Float64Array(d);
      for (let a = 1; a < k; a++) {
        for (let cc = a; cc < k; cc++) {
          const val = sd[a] && sd[cc] ? (S[a * k + cc] / n - mu[a] * mu[cc]) / (sd[a] * sd[cc]) : 0;
          A[(a - 1) * d + (cc - 1)] = val; A[(cc - 1) * d + (a - 1)] = val;
        }
        c[a - 1] = sd[a] ? (this.b[a] / n - mu[a] * ybar) / sd[a] : 0;
        A[(a - 1) * d + (a - 1)] = sd[a] ? A[(a - 1) * d + (a - 1)] + this.lambda / n : 1;
      }
      const z = solveSPD(A, c, d);
      this.mu = mu; this.ybar = ybar;
      this.beta = new Float64Array(k);
      for (let a = 1; a < k; a++) this.beta[a] = sd[a] ? z[a - 1] / sd[a] : 0;
      this.stdBeta = z;
      this.dirty = false;
    }
    predict(x) {
      if (this.dirty) this.solve();
      let p = this.ybar;
      for (let j = 0; j < this.idx.length; j++) p += this.beta[j + 1] * (x[this.idx[j]] - this.mu[j + 1]);
      return p;
    }
  }

  // Make a valid forecast: every p in [p0/4, min(0.9, 4*p0)] and the sum equal to pick.
  function toProbs(raw, game) {
    const M = game.max, p0 = game.pick / M, lo = p0 / 4, hi = Math.min(0.9, p0 * 4);
    const p = new Float64Array(M + 1);
    for (let n = 1; n <= M; n++) p[n] = Number.isFinite(raw[n]) ? raw[n] : p0;
    for (let it = 0; it < 30; it++) {
      let s = 0;
      for (let n = 1; n <= M; n++) s += p[n];
      const shift = (game.pick - s) / M;
      let clipped = false;
      for (let n = 1; n <= M; n++) {
        let v = p[n] + shift;
        if (v < lo) { v = lo; clipped = true; } else if (v > hi) { v = hi; clipped = true; }
        p[n] = v;
      }
      if (!clipped && Math.abs(shift) < 1e-12) break;
    }
    return p;
  }

  function rankNumbers(p, M) {
    const order = [];
    for (let n = 1; n <= M; n++) order.push(n);
    return order.sort((a, b) => p[b] - p[a] || a - b);
  }

  // ---------------------------------------------------------------------------------------------
  // Lens catalogue. kind 'ratio': p = p0 * exp(sum of the named feature columns) (no fitting).
  // kind 'ridge': fitted linear model on the named features. oracle: uses the set ball of the target
  // draw itself, which is unknown before the draw - a physics check only, never a forecast.
  function defaultLenses(extra) {
    const L = [
      { id: 'uniform', label: '何もしない（全部 同じ確率）', kind: 'uniform' },
      { id: 'eb_all', label: '全期間の出現率だけ', kind: 'ratio', cols: [FI.freqAll] },
      { id: 'eb_recent', label: '最近の出現率だけ', kind: 'ratio', cols: [FI.freqRecent] },
      { id: 'eb_setmix', label: 'セット球の癖（次のセット球を予想して重みづけ）', kind: 'ratio', cols: [FI.freqAll, FI.setTilt] },
      { id: 'eb_transition', label: '引っ張りの地図だけ', kind: 'ratio', cols: [FI.transition] },
      { id: 'eb_setOracle', label: '【物理の検証用】当日のセット球を知っていた場合の癖', kind: 'ratio', cols: [FI.freqAll, FI.setTilt], oracle: true },
    ];
    FEATURES.forEach(([k, label], i) => L.push({ id: 'one_' + k, label: '単独: ' + label, kind: 'ridge', idx: [i] }));
    L.push({ id: 'one_setPullOracle', label: '【物理の検証用】単独: 当日と同じセット球の前回の当選数字', kind: 'ridge', idx: [FI.setPull], oracle: true });
    L.push({ id: 'combined', label: '全レンズの合成（重みは過去だけで学習）', kind: 'ridge', idx: FEATURES.map((_, i) => i) });
    if (extra) {
      const D0 = FEATURES.length;
      extra.names.forEach((k, e) => L.push({ id: 'app_' + k, label: 'アプリの波 単独: ' + (extra.labels ? extra.labels[e] : k), kind: 'ridge', idx: [D0 + e], extra: true }));
      const waveIdx = extra.additive.map(e => D0 + e);
      L.push({ id: 'app_waves', label: 'アプリの波を全部（重みは過去だけで学習）', kind: 'ridge', idx: waveIdx, extra: true });
      L.push({ id: 'combined_all', label: '観測所のレンズ＋アプリの波（重みは過去だけで学習）', kind: 'ridge', idx: FEATURES.map((_, i) => i).concat(waveIdx), extra: true });
    }
    L.push({ id: 'bma', label: 'レンズの成績で重みを毎回つけ直す合議（過去の成績だけ）', kind: 'bma' });
    return L;
  }

  // ---------------------------------------------------------------------------------------------
  // Walk-forward over one history. Scores every lens on draws index >= start and returns the
  // forecast for the draw after the last one.
  function walkForward(draws, game, opts) {
    const start = opts.start, lambda = opts.lambda, extra = opts.extra || null, permRnd = opts.permRnd || null;
    const lenses = opts.lenses || defaultLenses(extra);
    const M = game.max, p0 = game.pick / M;
    const h = new History(game);
    const st = lenses.map(L => ({
      L, ridge: L.kind === 'ridge' ? new Ridge(L.idx, lambda) : null,
      gain: 0, gainHalf: [0, 0], hits: 0, n: 0, dist: new Array(game.pick + 1).fill(0), last: null, cum: 0,
    }));
    const members = st.filter(s => s.L.kind !== 'bma' && !s.L.oracle);
    const bma = st.find(s => s.L.kind === 'bma') || null;
    const setScore = {};
    for (const k in h.setModels) setScore[k] = { ll: 0, top1: 0, top3: 0, n: 0 };
    const base = game.pick * Math.log(p0) + (M - game.pick) * Math.log(1 - p0);
    const mid = start + Math.floor((draws.length - start) / 2);
    const y = new Uint8Array(M + 1), pi = new Int32Array(M + 1);
    const nextRound = draws.length ? draws[draws.length - 1].round + 1 : 1;
    const score = (s, p, t) => {
      let ll = 0;
      for (let n = 1; n <= M; n++) ll += y[n] ? Math.log(p[n]) : Math.log(1 - p[n]);
      if (t >= start) {
        s.gain += ll - base; s.gainHalf[t < mid ? 0 : 1] += ll - base;
        const top = rankNumbers(p, M).slice(0, game.pick);
        let hits = 0;
        for (const n of top) hits += y[n];
        s.hits += hits; s.dist[hits]++; s.n++;
      }
      return ll;
    };
    let forecast = null;
    for (let t = 0; t <= draws.length; t++) {
      const d = draws[t];
      if (t < MIN_HIST) { if (d) h.ingest(d); continue; }
      const ex = extra ? extra.byRound.get(d ? d.round : nextRound) || null : null;
      const q = h.setModels[SET_MODEL].predict(h.lastUse, h.t);
      const cache = {};
      const X = buildFeatures(h, q, cache, ex);
      let Xo = null;
      if (d && d.set) { const oh = {}; oh[d.set] = 1; Xo = buildFeatures(h, oh, cache, ex); }
      if (d) {
        y.fill(0);
        if (permRnd) {
          // Null check: relabel the numbers of this draw at random. The draw keeps its shape but any
          // link between the lenses and the outcome is broken.
          for (let n = 1; n <= M; n++) pi[n] = n;
          for (let i = M; i > 1; i--) { const j = 1 + Math.floor(permRnd() * i); const tmp = pi[i]; pi[i] = pi[j]; pi[j] = tmp; }
          for (const n of d.main) y[pi[n]] = 1;
        } else for (const n of d.main) y[n] = 1;
      }
      if (d && d.set && t >= start) {
        for (const k in h.setModels) {
          const qq = h.setModels[k].predict(h.lastUse, h.t), ss = setScore[k];
          ss.ll += Math.log(qq[d.set]) - Math.log(0.1);
          const ord = SETS.slice().sort((a, b) => qq[b] - qq[a]);
          ss.top1 += ord[0] === d.set ? 1 : 0; ss.top3 += ord.slice(0, 3).indexOf(d.set) >= 0 ? 1 : 0; ss.n++;
        }
      }
      const probs = new Map();
      for (const s of st) {
        const L = s.L;
        if (L.kind === 'bma') continue;
        if ((L.oracle && !Xo) || (L.extra && !ex)) { if (!d) s.last = null; continue; }
        const XX = L.oracle ? Xo : X;
        const raw = new Float64Array(M + 1);
        for (let n = 1; n <= M; n++) {
          if (L.kind === 'uniform') raw[n] = p0;
          else if (L.kind === 'ratio') { let e = 0; for (const c of L.cols) e += XX[n][c]; raw[n] = p0 * Math.exp(e); }
          else raw[n] = s.ridge.n > 0 ? s.ridge.predict(XX[n]) : p0;
        }
        const p = toProbs(raw, game);
        probs.set(s, p);
        if (!d) { s.last = p; continue; }
        s.llNow = score(s, p, t);
        if (s.ridge) for (let n = 1; n <= M; n++) s.ridge.add(XX[n], y[n]);
      }
      if (bma) {
        // Weights = how well each lens has forecast so far (Bayesian model averaging; 'uniform' is a
        // member, so when no lens earns its keep the average falls back to the fair forecast).
        const avail = members.filter(s => probs.has(s));
        let top = -Infinity;
        for (const s of avail) top = Math.max(top, s.cum);
        const pb = new Float64Array(M + 1);
        let wsum = 0;
        for (const s of avail) {
          const w = Math.exp(s.cum - top), p = probs.get(s);
          wsum += w;
          for (let n = 1; n <= M; n++) pb[n] += w * p[n];
        }
        for (let n = 1; n <= M; n++) pb[n] /= wsum;
        if (!d) bma.last = pb;
        else {
          score(bma, pb, t);
          if (avail.length === members.length) for (const s of avail) s.cum += s.llNow;
        }
        bma.weights = avail.map(s => [s.L.id, Math.exp(s.cum - top) / wsum]);
      }
      if (d) h.ingest(d);
      else forecast = { q, X, h };
    }
    return { lenses: st, setScore, forecast, scored: Math.max(0, draws.length - start) };
  }

  // ---------------------------------------------------------------------------------------------
  // Popularity map: how many other players hold the same combination (popularity.py fits the
  // weights from the winner counts of every tier; here they are used to rank tickets for the next
  // draw with the latest data). Mirrors scripts/observatory/popularity.py and tickets.py.
  function popFeats(nums, recent) {
    const m = nums.slice().sort((a, b) => a - b);
    const d = [];
    for (let i = 1; i < m.length; i++) d.push(m[i] - m[i - 1]);
    const hot = {}, digit = {};
    for (const r of recent) for (const n of r) hot[n] = (hot[n] || 0) + 1;
    for (const n of m) digit[n % 10] = (digit[n % 10] || 0) + 1;
    let decade = 0;
    for (let k = 0; k < 5; k++) decade = Math.max(decade, m.filter(n => Math.floor(n / 10) === k).length);
    let eq = 0;
    for (let i = 1; i < d.length; i++) if (d[i] === d[i - 1]) eq++;
    let h = 0;
    for (const n of m) h += hot[n] || 0;
    return [d.filter(x => x === 1).length, decade, Math.max(...Object.values(digit)), eq, h / m.length];
  }
  function popPredict(w, max, nums, recent) {
    let v = w[0];
    for (const n of nums) v += w[n];
    const f = popFeats(nums, recent);
    for (let j = 0; j < f.length; j++) v += w[max + 1 + j] * f[j];
    return v;
  }
  function shapeOk(nums, pastSets) {
    const m = nums.slice().sort((a, b) => a - b);
    for (let i = 0; i + 2 < m.length; i++) if (m[i + 2] - m[i] === 2) return false;
    const digit = {};
    for (const n of m) { digit[n % 10] = (digit[n % 10] || 0) + 1; if (digit[n % 10] >= 3) return false; }
    const d = [];
    for (let i = 1; i < m.length; i++) d.push(m[i] - m[i - 1]);
    for (let i = 0; i + 2 < d.length; i++) if (d[i] === d[i + 1] && d[i + 1] === d[i + 2]) return false;
    for (let k = 0; k < 5; k++) if (m.filter(n => Math.floor(n / 10) === k).length >= 5) return false;
    return !pastSets.has(m.join('-'));
  }
  function shareFactor(lam) { return lam > 1e-9 ? (1 - Math.exp(-lam)) / lam : 1; }
  // model: { w, lambda } from report.js; draws: normalized history (oldest first).
  function suggestTickets(model, game, draws, count) {
    const M = game.max, k = game.pick, w = model.w;
    const recent = draws.slice(-10).map(d => d.main);
    const pastSets = new Set(draws.map(d => d.main.slice().sort((a, b) => a - b).join('-')));
    const rnd = mulberry32(697);
    let b0 = 0;
    const S = 20000;
    for (let i = 0; i < S; i++) {
      const pool = [];
      for (let n = 1; n <= M; n++) pool.push(n);
      for (let j = 0; j < k; j++) { const r = j + Math.floor(rnd() * (M - j)); const t = pool[j]; pool[j] = pool[r]; pool[r] = t; }
      b0 += popPredict(w, M, pool.slice(0, k), recent);
    }
    b0 /= S;
    const order = [];
    for (let n = 1; n <= M; n++) order.push(n);
    order.sort((a, b) => w[a] - w[b] || a - b);
    const pool = order.slice(0, 20);
    const cands = [];
    const pick = [];
    (function rec(start) {
      if (pick.length === k) {
        if (shapeOk(pick, pastSets)) cands.push([popPredict(w, M, pick, recent), pick.slice()]);
        return;
      }
      for (let i = start; i <= pool.length - (k - pick.length); i++) { pick.push(pool[i]); rec(i + 1); pick.pop(); }
    })(0);
    cands.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [bp, c] of cands) {
      if (out.every(o => c.filter(n => o.numbers.indexOf(n) >= 0).length <= k - 3)) {
        const R = Math.exp(k * (bp - b0));
        out.push({ numbers: c.slice().sort((a, b) => a - b), popularity: R, share: shareFactor(model.lambda * R) / shareFactor(model.lambda) });
      }
      if (out.length >= count) break;
    }
    const rate = nums => { const R = Math.exp(k * (popPredict(w, M, nums, recent) - b0)); return { popularity: R, share: shareFactor(model.lambda * R) / shareFactor(model.lambda) }; };
    return { tickets: out, rate };
  }

  return { GAMES, SETS, FEATURES, FI, normalize, mulberry32, fakeDraw, SetModel, History, ebRatios,
    setRatioTable, transitionTable, buildFeatures, Ridge, toProbs, rankNumbers, defaultLenses, walkForward,
    popFeats, popPredict, shapeOk, shareFactor, suggestTickets };
});
