// GLEF Observatory runner (Node).
// Usage: node scripts/observatory/run.js --game L7 [--sims 1000] [--null perm|fake] [--lambda 2000]
//          [--waves waves_L7.json] [--json out.json] [--data data.js]
// Prints the walk-forward score of every lens, its p-value against the null check, how well the
// next set ball can be guessed, and the forecast for the next draw.
//   --null fake : fake histories with fair random numbers (same set-ball sequence); features are
//                 recomputed from the fake history. Not available with --waves.
//   --null perm : real history, but each scored draw's numbers are relabelled at random, which
//                 breaks any link between the lenses and the outcome (default with --waves).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const O = require('./obs_core.js');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1]; i++; }
}
const GAME = args.game || 'L7';
const R = +(args.sims || 200);
const LAMBDA = +(args.lambda || 2000);
const DATA = args.data || path.join(__dirname, '..', '..', 'data.js');
const NULL = args.null || (args.waves ? 'perm' : 'fake');

const WAVE_LABELS = {
  depth: 'depthWave（ギャップ）', vert: 'vertWave（直近3回+WMA）', horz: 'horzWave（ゾーンMACD）', cross: 'crossWave（共起+相互情報量）',
  co: 'coBias（キャリーオーバー）', fourier: 'fourierWave（FFT周期）', markov: 'markovWave（ゾーン遷移）', rqa: 'rqaWave（再帰定量化）',
  cold: 'coldWave（削除数字+KDE）', set: 'setWave（セット球）', crossLoto: 'crossLotoBias（他ロト引っ張り）', digit: 'digitWave（下一桁）',
  wavelet: 'waveletWave（Haar）', hmm: 'hmmBias（HMM）', lyapunov: 'lyapunovBias（乗算調整器）', appTotal: 'アプリの合計点（乗数すべて1.0）',
};

function loadData(file) {
  const src = fs.readFileSync(file, 'utf8');
  return vm.runInNewContext(src + '\n;({ L6: LOTO6_DATA, L7: LOTO7_DATA })');
}

function loadWaves(file) {
  const w = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byRound = new Map();
  w.rounds.forEach((r, i) => { if (w.waves[i]) byRound.set(r, w.waves[i]); });
  return { names: w.names, labels: w.names.map(k => WAVE_LABELS[k] || k), additive: w.names.map((_, i) => i).filter(i => i < 14), byRound };
}

// Set-ball predictability vs shuffled set sequences (same sets, order destroyed).
function setPermutationTest(draws, start, perms) {
  const score = seq => {
    const lastUse = {};
    const m = new O.SetModel('rank');
    let ll = 0;
    seq.forEach((s, t) => {
      if (t >= start) ll += Math.log(m.predict(lastUse, t)[s]) - Math.log(0.1);
      m.learn(lastUse, t, s);
      lastUse[s] = t;
    });
    return ll;
  };
  const seq = draws.map(d => d.set).filter(Boolean);
  const obs = score(seq);
  const rnd = O.mulberry32(97);
  let ge = 0, sum = 0;
  for (let r = 0; r < perms; r++) {
    const sh = seq.slice();
    for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = sh[i]; sh[i] = sh[j]; sh[j] = t; }
    const v = score(sh);
    sum += v;
    if (v >= obs) ge++;
  }
  return { obs, nullMean: sum / perms, p: (ge + 1) / (perms + 1) };
}

// Mixing check: are numbers close to each other drawn together more (or less) often than a fair
// machine would give? Counts pairs at distance 1, 2, 3 inside each draw, compared with simulated
// fair draws of the same size.
function mixingCheck(draws, game, sims) {
  const count = ds => { const c = [0, 0, 0, 0]; for (const d of ds) for (let i = 0; i < d.main.length; i++) for (let j = i + 1; j < d.main.length; j++) { const k = d.main[j] - d.main[i]; if (k <= 3) c[k]++; } return c; };
  const obs = count(draws);
  const rnd = O.mulberry32(4242);
  const acc = [[], [], [], []];
  for (let r = 0; r < sims; r++) { const c = count(draws.map(d => O.fakeDraw(d, game, rnd))); for (let k = 1; k <= 3; k++) acc[k].push(c[k]); }
  return [1, 2, 3].map(k => {
    const m = acc[k].reduce((a, b) => a + b, 0) / sims;
    const sd = Math.sqrt(acc[k].reduce((a, b) => a + (b - m) * (b - m), 0) / (sims - 1));
    return { k, obs: obs[k], mean: m, z: (obs[k] - m) / sd };
  });
}

const D = loadData(DATA);
const game = O.GAMES[GAME];
const draws = O.normalize(D[GAME]);
const start = GAME === 'L7' ? 100 : 200;
const extra = args.waves ? loadWaves(args.waves) : null;
if (extra && NULL === 'fake') { console.error('--null fake cannot be used with --waves'); process.exit(2); }

const t0 = Date.now();
const real = O.walkForward(draws, game, { start, lambda: LAMBDA, extra });
const tReal = (Date.now() - t0) / 1000;
const K = real.lenses.length;
const nullGain = [...Array(K)].map(() => []), nullHits = [...Array(K)].map(() => []);
for (let r = 0; r < R; r++) {
  let res;
  if (NULL === 'fake') {
    const rnd = O.mulberry32(510000 + r);
    res = O.walkForward(draws.map(d => O.fakeDraw(d, game, rnd)), game, { start, lambda: LAMBDA });
  } else {
    res = O.walkForward(draws, game, { start, lambda: LAMBDA, extra, permRnd: O.mulberry32(710000 + r) });
  }
  res.lenses.forEach((s, i) => { nullGain[i].push(s.gain); nullHits[i].push(s.n ? s.hits / s.n : 0); });
}
const tAll = (Date.now() - t0) / 1000;

const lines = [];
const line = s => lines.push(s);
const chanceHits = game.pick * game.pick / game.max;
line(`===== ${GAME}: ${game.max}個から${game.pick}個 / 採点: 第${draws[start].round}回〜第${draws[draws.length - 1].round}回 (${real.scored}回) / 学習は毎回その回より前だけ =====`);
line(`(比較: ${NULL === 'fake' ? '偶然の作り物の歴史' : '当選数字の札をランダムに付け替えた歴史'} ${R}本, ridge λ=${LAMBDA}, 計算 ${tReal.toFixed(1)}s, 比較込み ${tAll.toFixed(0)}s${extra ? ', アプリの波あり' : ''})`);
const perm = setPermutationTest(draws, start, 1000);
for (const k in real.setScore) {
  const s = real.setScore[k];
  line(`セット球の予想[${k}]: 1回あたり ${(s.ll / s.n).toFixed(4)} nats 得 / 1番手的中 ${(100 * s.top1 / s.n).toFixed(1)}% (偶然10%) / 上位3つに入る ${(100 * s.top3 / s.n).toFixed(1)}% (偶然30%)`);
}
line(`  並びを混ぜたセット球列との比較 [rank]: 実際 ${perm.obs.toFixed(1)} nats / 混ぜた列の平均 ${perm.nullMean.toFixed(1)} / p = ${perm.p.toFixed(4)}`);
const mix = mixingCheck(draws, game, 2000);
line('混ざり具合の検査（同じ回に差が1・2・3の数字の組が出た数、全回）: ' + mix.map(m => `差${m.k}: ${m.obs}組 (公平な機械なら平均 ${m.mean.toFixed(1)}, z=${m.z >= 0 ? '+' : ''}${m.z.toFixed(2)})`).join(' / '));
line('');
line(`レンズ | 1回あたりの得(ミリnats) | 前半/後半(nats) | 合計(nats) | 比較の平均 | 同等以上の割合 p | 上位${game.pick}個の平均当たり (偶然 ${chanceHits.toFixed(3)}) | 比較での平均当たり | 当たり数の分布`);
const table = [];
real.lenses.forEach((s, i) => {
  const g = s.gain, ng = nullGain[i];
  const nm = ng.length ? ng.reduce((a, b) => a + b, 0) / ng.length : NaN;
  const p = ng.length ? (ng.filter(v => v >= g).length + 1) / (ng.length + 1) : NaN;
  const nh = nullHits[i].length ? nullHits[i].reduce((a, b) => a + b, 0) / nullHits[i].length : NaN;
  const avgHits = s.n ? s.hits / s.n : 0;
  table.push({ id: s.L.id, label: s.L.label, n: s.n, gain: g, gainHalf: s.gainHalf, nullMean: nm, p, avgHits, nullHits: nh, dist: s.dist });
  line(`${s.L.id.padEnd(18)} | ${(1000 * g / Math.max(1, s.n)).toFixed(2).padStart(7)} | ${s.gainHalf[0].toFixed(1).padStart(6)}/${s.gainHalf[1].toFixed(1).padStart(6)} | ${g.toFixed(2).padStart(7)} | ${nm.toFixed(2).padStart(7)} | p=${p.toFixed(3)} | ${avgHits.toFixed(3)} | ${nh.toFixed(3)} | ${JSON.stringify(s.dist)} | ${s.L.label}`);
});
const comb = real.lenses.find(s => s.L.id === (extra ? 'combined_all' : 'combined'));
if (comb && comb.ridge) {
  comb.ridge.solve();
  line('');
  line(`合成レンズ[${comb.L.id}]の重み（標準化した単位、最終時点）:`);
  const names = O.FEATURES.map(f => f[0]).concat(extra ? extra.names : []);
  comb.L.idx.forEach((c, j) => line(`  ${names[c].padEnd(11)} ${comb.ridge.stdBeta[j] >= 0 ? '+' : ''}${comb.ridge.stdBeta[j].toFixed(4)}`));
}
const bma = real.lenses.find(s => s.L.kind === 'bma');
if (bma && bma.weights) {
  line('');
  line('合議[bma]の最終の重み 上位8: ' + bma.weights.slice().sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, w]) => `${id} ${(100 * w).toFixed(1)}%`).join(' / '));
}
const f = real.forecast;
const qs = O.SETS.slice().sort((a, b) => f.q[b] - f.q[a]);
line('');
const nextRound = draws[draws.length - 1].round + 1;
line(`次の回 (第${nextRound}回) のセット球予想: ` + qs.slice(0, 5).map(s => `${s} ${(100 * f.q[s]).toFixed(1)}%`).join(' / '));
const forecasts = {};
for (const id of ['bma', extra ? 'combined_all' : 'combined', 'eb_setmix', 'eb_all']) {
  const s = real.lenses.find(x => x.L.id === id);
  if (!s || !s.last) continue;
  const ord = O.rankNumbers(s.last, game.max);
  forecasts[id] = ord.map(n => [n, s.last[n]]);
  line(`次の回の予報 [${id}] 上位12: ` + ord.slice(0, 12).map(n => `${n}(${(100 * s.last[n]).toFixed(1)}%)`).join(' ') + ` / 偶然 ${(100 * game.pick / game.max).toFixed(1)}%`);
}
console.log(lines.join('\n'));
if (args.json) {
  fs.writeFileSync(args.json, JSON.stringify({ game: GAME, null: NULL, sims: R, lambda: LAMBDA, scored: real.scored,
    firstRound: draws[start].round, lastRound: draws[draws.length - 1].round, setScore: real.setScore, setPerm: perm, mixing: mix,
    table, nextRound, setForecast: f.q, forecasts }, null, 1));
}
