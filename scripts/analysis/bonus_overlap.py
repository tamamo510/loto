"""Usage: python3 scripts/analysis/bonus_overlap.py [data.js]

Owner's follow-up hypothesis (2026-10-02): a bonus-pull candidate may be weak on its own, but
when it also overlaps with another signal it could work as an anchor.

Unit of analysis = one candidate number in one draw. Candidates come from the previous draw's
bonus numbers (exact and ±1). For each candidate we record which other signals it overlaps with
and whether it then appeared in the next draw's main numbers. Under a fair draw every number
appears with probability pick/max (L7: 7/37 = 18.9%), whatever else is true about it, so each
group is compared with that rate (binomial z). All numbers (not only candidates) are shown with
the same split as a reference.
"""
import json
import math
import re
import sys


def load_data_js(path):
    text = open(path, encoding='utf-8').read()
    out = {}
    for key, var in (('L6', 'LOTO6_DATA'), ('L7', 'LOTO7_DATA')):
        m = re.search(rf'const\s+{var}\s*=\s*(\[.*?\n\]);', text, re.S)
        out[key] = json.loads(m.group(1))
    return out


def bonuses(row):
    b = row[3]
    return b if isinstance(b, list) else [b]


def features(n, t, rows):
    prev = rows[t - 1]
    last5 = [r[2] for r in rows[t - 5:t]]
    last10 = [r[2] for r in rows[t - 10:t]]
    return {
        'exact bonus': n in bonuses(prev),
        'bonus ±1 only': n not in bonuses(prev),
        'also prev main (pull)': n in prev[2],
        'also next to prev main': n not in prev[2] and (n - 1 in prev[2] or n + 1 in prev[2]),
        'hot (>=2 in last 5)': sum(n in m for m in last5) >= 2,
        'cold (0 in last 10)': not any(n in m for m in last10),
        'no overlap with these': not (n in prev[2] or n - 1 in prev[2] or n + 1 in prev[2]
                                      or sum(n in m for m in last5) >= 2 or not any(n in m for m in last10)),
    }


def run(name, rows, pick, mx):
    p0 = pick / mx
    groups = {}
    ref = {}
    for t in range(10, len(rows)):
        cand = {x + d for x in bonuses(rows[t - 1]) for d in (-1, 0, 1) if 1 <= x + d <= mx}
        nxt = set(rows[t][2])
        for n in range(1, mx + 1):
            f = features(n, t, rows)
            hit = n in nxt
            tgt = groups if n in cand else ref
            for k, v in f.items():
                if n not in cand and k in ('exact bonus', 'bonus ±1 only'):
                    continue
                if v:
                    g = tgt.setdefault(k, [0, 0])
                    g[0] += 1
                    g[1] += hit
            if n in cand:
                g = groups.setdefault('ALL candidates', [0, 0])
                g[0] += 1
                g[1] += hit

    def show(label, g):
        n, h = g
        rate = h / n
        z = (h - n * p0) / math.sqrt(n * p0 * (1 - p0))
        print(f'  {label:26s} n={n:5d}  appeared {rate*100:5.1f}%  (chance {p0*100:.1f}%, z={z:+.2f})')

    print(f'===== {name}: candidates from previous bonus (exact & ±1), draws 11..{len(rows)} =====')
    for k in ['ALL candidates', 'exact bonus', 'bonus ±1 only', 'also prev main (pull)', 'also next to prev main',
              'hot (>=2 in last 5)', 'cold (0 in last 10)', 'no overlap with these']:
        if k in groups:
            show(k, groups[k])
    print('  -- reference: every number, same splits --')
    for k in ['also prev main (pull)', 'also next to prev main', 'hot (>=2 in last 5)', 'cold (0 in last 10)']:
        if k in ref:
            show('ref ' + k, ref[k])
    print()


D = load_data_js(sys.argv[1] if len(sys.argv) > 1 else 'data.js')
run('L7', D['L7'], 7, 37)
run('L6', D['L6'], 6, 43)
