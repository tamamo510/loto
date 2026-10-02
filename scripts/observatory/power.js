// How fine is the microscope? Plant a known tilt in fake histories and count how often the
// observatory notices it (total walk-forward gain above the 95th percentile of fair histories).
// Usage: node scripts/observatory/power.js --game L7 [--fair 200] [--sims 100] [--data data.js]
// Tilts: every number's draw weight is 1 + s*z (z standard normal, fixed per history); for the set
// version every set ball gets its own independent tilt. Balls are drawn one by one with
// probability proportional to their weight among the balls still in the machine.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const O = require('./obs_core.js');

const args = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) { args[process.argv[i].slice(2)] = process.argv[i + 1]; i++; }
const GAME = args.game || 'L7';
const FAIR = +(args.fair || 200), SIMS = +(args.sims || 100);
const DATA = args.data || path.join(__dirname, '..', '..', 'data.js');
const src = fs.readFileSync(DATA, 'utf8');
const D = vm.runInNewContext(src + '\n;({ L6: LOTO6_DATA, L7: LOTO7_DATA })');
const game = O.GAMES[GAME], M = game.max;
const draws = O.normalize(D[GAME]);
const start = GAME === 'L7' ? 100 : 200;
const LENSES = O.defaultLenses().filter(L => ['eb_all', 'eb_setmix', 'eb_setOracle', 'bma', 'uniform'].includes(L.id) || L.id === 'one_freqAll');
const IDS = LENSES.map(L => L.id);

function gauss(rnd) { const u = Math.max(rnd(), 1e-12), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function weights(s, rnd) { const w = new Float64Array(M + 1); for (let n = 1; n <= M; n++) w[n] = Math.max(0.05, 1 + s * gauss(rnd)); return w; }
function tiltedDraw(d, w, rnd) {
  const left = [];
  for (let n = 1; n <= M; n++) left.push(n);
  const out = [];
  for (let k = 0; k < game.pick + game.nBonus; k++) {
    let tot = 0;
    for (const n of left) tot += w[n];
    let u = rnd() * tot, i = 0;
    while (i < left.length - 1 && (u -= w[left[i]]) > 0) i++;
    out.push(left[i]); left.splice(i, 1);
  }
  return { round: d.round, date: d.date, set: d.set, main: out.slice(0, game.pick).sort((a, b) => a - b), bonus: out.slice(game.pick) };
}
function run(hist) {
  const r = O.walkForward(hist, game, { start, lambda: 2000, lenses: LENSES });
  const g = {};
  r.lenses.forEach(s => { g[s.L.id] = s.gain; });
  return g;
}

const t0 = Date.now();
const fair = [];
for (let r = 0; r < FAIR; r++) { const rnd = O.mulberry32(910000 + r); fair.push(run(draws.map(d => O.fakeDraw(d, game, rnd)))); }
const q95 = {};
for (const id of IDS) { const v = fair.map(g => g[id]).sort((a, b) => a - b); q95[id] = v[Math.floor(0.95 * v.length)]; }
console.log(`${GAME}: 公平な歴史 ${FAIR}本で「見えた」の線（上位5%）を決め、傾けた歴史 各${SIMS}本で検出率を測る（${draws.length}回、採点は第${draws[start].round}回から）`);
for (const kind of ['global', 'perSet']) {
  for (const s of (kind === 'global' ? [0.03, 0.05, 0.08, 0.12] : [0.05, 0.10, 0.15, 0.25])) {
    const hit = {};
    IDS.forEach(id => { hit[id] = 0; });
    let gainSum = {};
    IDS.forEach(id => { gainSum[id] = 0; });
    for (let r = 0; r < SIMS; r++) {
      const rnd = O.mulberry32(920000 + r * 7 + Math.round(s * 1000));
      let hist;
      if (kind === 'global') { const w = weights(s, rnd); hist = draws.map(d => tiltedDraw(d, w, rnd)); }
      else { const ws = {}; for (const x of O.SETS) ws[x] = weights(s, rnd); hist = draws.map(d => tiltedDraw(d, d.set ? ws[d.set] : ws.A, rnd)); }
      const g = run(hist);
      for (const id of IDS) { if (g[id] > q95[id]) hit[id]++; gainSum[id] += g[id]; }
    }
    const label = kind === 'global' ? `全セット共通の傾き ±${(s * 100).toFixed(0)}%` : `セット球ごとに別の傾き ±${(s * 100).toFixed(0)}%`;
    console.log(`  ${label}: ` + IDS.filter(id => id !== 'uniform').map(id => `${id} 検出${(100 * hit[id] / SIMS).toFixed(0)}% (平均の得 ${(gainSum[id] / SIMS).toFixed(1)} nats)`).join(' / '));
  }
}
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
