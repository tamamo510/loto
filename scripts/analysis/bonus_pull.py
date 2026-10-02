"""Usage: python3 scripts/analysis/bonus_pull.py [data.js]

Bonus-number "pull": do the previous draw's bonus numbers (and their ±1 neighbours)
show up in the next draw's main numbers more often than chance?

For each draw t (t >= 2) build a candidate set S from draw t-1, count how many of draw t's
main numbers fall in S, and compare with the exact hypergeometric expectation for |S|.
"""
import json
import math
import re
import sys
from math import comb


def load_data_js(path):
    """Read LOTO6_DATA / LOTO7_DATA straight from data.js (the arrays are JSON-compatible)."""
    text = open(path, encoding='utf-8').read()
    out = {}
    for key, var in (('L6', 'LOTO6_DATA'), ('L7', 'LOTO7_DATA')):
        m = re.search(rf'const\s+{var}\s*=\s*(\[.*?\n\]);', text, re.S)
        out[key] = json.loads(m.group(1))
    return out


D = load_data_js(sys.argv[1] if len(sys.argv) > 1 else 'data.js')
GAMES = {'L7': dict(rows=D['L7'], pick=7, mx=37), 'L6': dict(rows=D['L6'], pick=6, mx=43)}


def bonuses(row):
    b = row[3]
    return b if isinstance(b, list) else [b]


def cand(row, mode, mx):
    bs = bonuses(row)
    if mode == 'exact':
        s = set(bs)
    elif mode == 'pm1':
        s = {x + d for x in bs for d in (-1, 1)}
    elif mode == 'exact+pm1':          # 温子の仮説: そのまま or 前後1つ
        s = {x + d for x in bs for d in (-1, 0, 1)}
    elif mode == 'prev_main':          # 比較: 前回の本数字そのまま
        s = set(row[2])
    elif mode == 'placebo+10':         # 対照: ボーナス+10/±1 (意味のない集合)
        s = {((x + 10 + d - 1) % mx) + 1 for x in bs for d in (-1, 0, 1)}
    return {x for x in s if 1 <= x <= mx}


def hyper(m, pick, mx):
    """k = |S ∩ main| when `pick` numbers are drawn from mx and |S| = m."""
    p0 = comb(mx - m, pick) / comb(mx, pick)
    mean = pick * m / mx
    var = pick * (m / mx) * ((mx - m) / mx) * ((mx - pick) / (mx - 1))
    return 1 - p0, mean, var


def analyse(g, mode, last=None):
    rows, pick, mx = g['rows'], g['pick'], g['mx']
    idx = range(1, len(rows))
    if last:
        idx = range(len(rows) - last, len(rows))
    n = hit_draws = hit_sum = 0
    exp_hit = var_hit = exp_sum = var_sum = 0.0
    sizes = []
    for t in idx:
        s = cand(rows[t - 1], mode, mx)
        k = len(s & set(rows[t][2]))
        p1, mean, var = hyper(len(s), pick, mx)
        n += 1
        hit_draws += k >= 1
        hit_sum += k
        exp_hit += p1
        var_hit += p1 * (1 - p1)
        exp_sum += mean
        var_sum += var
        sizes.append(len(s))
    z_hit = (hit_draws - exp_hit) / math.sqrt(var_hit) if var_hit else 0
    z_sum = (hit_sum - exp_sum) / math.sqrt(var_sum) if var_sum else 0
    return dict(n=n, avg_size=sum(sizes) / n, obs_rate=hit_draws / n, exp_rate=exp_hit / n, z_hit=z_hit,
                obs_k=hit_sum / n, exp_k=exp_sum / n, z_k=z_sum)


def norm_p_two_sided(z):
    return math.erfc(abs(z) / math.sqrt(2))


for name, g in GAMES.items():
    print(f'===== {name}: {len(g["rows"])} draws (R{g["rows"][0][0]}-R{g["rows"][-1][0]}) =====')
    for mode in ['exact+pm1', 'exact', 'pm1', 'prev_main', 'placebo+10']:
        for last in [None, 100, 50, 20]:
            r = analyse(g, mode, last)
            tag = 'all' if not last else f'last{last}'
            print(f'{mode:11s} {tag:7s} n={r["n"]:4d} |S|={r["avg_size"]:.2f}  '
                  f'>=1hit: obs {r["obs_rate"]*100:5.1f}% vs exp {r["exp_rate"]*100:5.1f}% (z={r["z_hit"]:+.2f}, p={norm_p_two_sided(r["z_hit"]):.2f})  '
                  f'avg hits: obs {r["obs_k"]:.3f} vs exp {r["exp_k"]:.3f} (z={r["z_k"]:+.2f}, p={norm_p_two_sided(r["z_k"]):.2f})')
        print()

# Tonight's candidate set (L7 R697 from R696's bonus numbers)
last = GAMES['L7']['rows'][-1]
s = sorted(cand(last, 'exact+pm1', 37))
p1, mean, _ = hyper(len(s), 7, 37)
print(f'L7 R{last[0]+1} candidates from R{last[0]} bonus {bonuses(last)}: {s}  '
      f'-> chance at least one appears by pure luck: {p1*100:.1f}%, expected count {mean:.2f}')
