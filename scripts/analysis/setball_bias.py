"""Usage: python3 scripts/analysis/setball_bias.py [data.js]

Microscope for a physical hypothesis: each set ball (A-J) is a separate physical set of balls,
so small differences in weight or size could give each set its own number tendencies.

If such per-set tendencies are real and stable, a number that ran hot under set X in one half of
history should also run hot under set X in the other half. Under a fair draw the two halves are
unrelated. So for every set we correlate the per-number deviations (observed - expected) between
the earlier and later halves of that set's draws, average over sets, and compare with a
permutation null (shuffling which draw belongs to which set, keeping the draws themselves).

A second, forward-looking check: before each draw, rank numbers by their past frequency under the
same set ball and see how often the top-k of that ranking appear in the draw (vs pick/max).
"""
import json
import math
import random
import re
import sys


def load_data_js(path):
    text = open(path, encoding='utf-8').read()
    out = {}
    for key, var in (('L6', 'LOTO6_DATA'), ('L7', 'LOTO7_DATA')):
        m = re.search(rf'const\s+{var}\s*=\s*(\[.*?\n\]);', text, re.S)
        out[key] = json.loads(m.group(1))
    return out


def corr(a, b):
    n = len(a)
    ma, mb = sum(a) / n, sum(b) / n
    sa = math.sqrt(sum((x - ma) ** 2 for x in a))
    sb = math.sqrt(sum((y - mb) ** 2 for y in b))
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (sa * sb) if sa and sb else 0.0


def split_half_score(rows, sets, pick, mx):
    """Average over sets of corr(deviation in earlier half, deviation in later half)."""
    by_set = {}
    for r, s in zip(rows, sets):
        by_set.setdefault(s, []).append(r[2])
    cs = []
    for s, draws in by_set.items():
        if len(draws) < 20:
            continue
        h = len(draws) // 2
        dev = []
        for part in (draws[:h], draws[h:]):
            cnt = [0] * (mx + 1)
            for d in part:
                for n in d:
                    cnt[n] += 1
            e = len(part) * pick / mx
            dev.append([cnt[n] - e for n in range(1, mx + 1)])
        cs.append(corr(dev[0], dev[1]))
    return sum(cs) / len(cs), len(cs)


def forward_topk(rows, pick, mx, k=5, min_hist=10):
    """Before each draw: top-k numbers by past frequency under the same set ball."""
    hist = {}
    hits = trials = 0
    for r in rows:
        s = r[5] if len(r) > 5 else ''
        past = hist.get(s, [])
        if s and len(past) >= min_hist:
            cnt = [0] * (mx + 1)
            for d in past:
                for n in d:
                    cnt[n] += 1
            top = sorted(range(1, mx + 1), key=lambda n: (-cnt[n], n))[:k]
            hits += sum(n in r[2] for n in top)
            trials += k
        hist.setdefault(s, []).append(r[2])
    p0 = pick / mx
    z = (hits - trials * p0) / math.sqrt(trials * p0 * (1 - p0))
    return hits / trials, p0, z, trials


def run(name, rows, pick, mx, perms=2000):
    rows = [r for r in rows if len(r) > 5 and r[5]]
    sets = [r[5] for r in rows]
    obs, nsets = split_half_score(rows, sets, pick, mx)
    rng = random.Random(510)
    null = []
    for _ in range(perms):
        sh = sets[:]
        rng.shuffle(sh)
        null.append(split_half_score(rows, sh, pick, mx)[0])
    p = (1 + sum(v >= obs for v in null)) / (perms + 1)
    mean_null = sum(null) / len(null)
    print(f'===== {name}: {len(rows)} draws with a set ball, {nsets} sets =====')
    print(f'  split-half consistency of per-set number tendencies: r = {obs:+.4f} '
          f'(shuffled sets: mean {mean_null:+.4f}), one-sided p = {p:.3f}')
    for k in (3, 5, 7):
        rate, p0, z, trials = forward_topk(rows, pick, mx, k)
        print(f'  forward: top-{k} by past frequency under the same set -> appeared {rate*100:.2f}% '
              f'(chance {p0*100:.2f}%, z={z:+.2f}, {trials} number-draws)')
    print()


D = load_data_js(sys.argv[1] if len(sys.argv) > 1 else 'data.js')
run('L7', D['L7'], 7, 37)
run('L6', D['L6'], 6, 43)
