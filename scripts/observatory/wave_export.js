// Export the app's own wave values (index.html) for every past cutoff, so the observatory can
// score each wave walk-forward with the same microscope as its own lenses.
// For cutoff idx the app sees only draws[0..idx-1] (exactly what quickBacktest gives it) and all
// CMA-ES multipliers stay at their default 1.0.
// Usage: node scripts/observatory/wave_export.js <loto7|loto6> <out.json> [firstIdx] [url]
'use strict';
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const GAME = process.argv[2] || 'loto7';
const OUT = process.argv[3] || 'waves.json';
const FIRST = +(process.argv[4] || 60);
const URL = process.argv[5] || 'http://127.0.0.1:8765/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGEERROR', String(e)));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(g => setGame(g), GAME);
  const total = await page.evaluate(() => getDraws().length);
  const names = ['depth', 'vert', 'horz', 'cross', 'co', 'fourier', 'markov', 'rqa', 'cold', 'set', 'crossLoto', 'digit', 'wavelet', 'hmm', 'lyapunov', 'appTotal'];
  const out = { game: GAME, names, firstIdx: FIRST, rounds: [], waves: [] };
  const t0 = Date.now();
  const CH = 10;
  for (let a = FIRST; a <= total; a += CH) {
    const b = Math.min(total, a + CH - 1);
    const chunk = await page.evaluate(({ a, b }) => {
      const draws = getDraws(), c = CFG[gameType], mx = c.max;
      learnedParams = { ..._LEARN_DEFAULTS };
      const res = [];
      for (let idx = a; idx <= b; idx++) {
        const td = draws.slice(0, idx);
        _seededRng = _mulberry32(_drawSeed(td) + 3);
        try {
          const ar = calcAnomalyRisk(td), arRisk = ar.risk + Math.min(0.1, (ar.klDiv || 0) * 0.5);
          const mat = buildMatrix(td), miMat = buildMIMatrix(td), zt = buildZoneTransition(td), rqa = buildRQACache(td),
            sb = buildSetBallCache(td), cl = buildCrossLotoCache(td), hmm = buildHMMCache(td), kde = buildKDECache(td), ly = buildLyapunovCache(td);
          const pre = [];
          for (let i = 1; i <= mx; i++) pre.push({ num: i, score: depthWave(i, td) + vertWave(i, td) + horzWave(i, td) });
          pre.sort((x, y) => y.score - x.score);
          const tops = pre.slice(0, 10).map(s => s.num);
          const rows = [];
          for (let i = 1; i <= mx; i++) {
            const v = [depthWave(i, td), vertWave(i, td), horzWave(i, td), crossWave(i, tops, mat, miMat), coBias(i, td), fourierWave(i, td),
              markovWave(i, zt), rqaWave(i, td, rqa), coldWave(i, td, arRisk || 0, kde), setWave(i, sb), crossLotoBias(i, cl), digitWave(i, td),
              waveletWave(i, td), hmmBias(i, td, hmm), lyapunovBias(i, td, ly)];
            let base = 0;
            for (let k = 0; k < 14; k++) base += v[k];
            v.push(base * (1 + v[14]));
            rows.push(v.map(x => (Number.isFinite(x) ? Math.round(x * 1e5) / 1e5 : 0)));
          }
          res.push({ round: idx < draws.length ? draws[idx].round : draws[draws.length - 1].round + 1, rows });
        } catch (e) {
          res.push({ round: idx < draws.length ? draws[idx].round : draws[draws.length - 1].round + 1, error: String(e) });
        } finally { _seededRng = null; }
      }
      return res;
    }, { a, b });
    for (const r of chunk) { out.rounds.push(r.round); out.waves.push(r.rows || null); if (r.error) console.error('R' + r.round, r.error); }
    const done = b - FIRST + 1, all = total - FIRST + 1;
    console.error(`${done}/${all} cutoffs, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  await browser.close();
  console.error('written', OUT);
})().catch(e => { console.error('FAILED', e && e.stack || e); process.exit(1); });
