"""Usage: python3 scripts/observatory/tickets.py [--json out.json] [--n 5]

Tickets that fewer people share. Every combination is equally likely to win (observatory, 18th
thread), but the jackpot is split between everyone holding the same combination. This picks
combinations the popularity map (popularity.py) rates as rarely chosen, and checks the map on the
real jackpot winner counts: draws whose winning set the map (fitted only on earlier draws) rated
unpopular should have had fewer jackpot winners.
"""
import json
import math
import random
import re
import sys
from itertools import combinations

sys.path.insert(0, __file__.rsplit('/', 1)[0])
import popularity as P


def load_data_js(path='data.js'):
    text = open(path, encoding='utf-8').read()
    out = {}
    for key, var in (('L6', 'LOTO6_DATA'), ('L7', 'LOTO7_DATA')):
        m = re.search(rf'const\s+{var}\s*=\s*(\[.*?\n\]);', text, re.S)
        out[key] = json.loads(m.group(1))
    return out


def shape_ok(nums, g, past_sets):
    """Keep suggestions inside the shapes the map has seen and away from shapes known to draw
    crowds: runs of 3, three or more with one last digit (a column of the slip), 4-step
    arithmetic runs, 5+ in one decade, and exact copies of past winning sets."""
    m = sorted(nums)
    if any(m[i + 2] - m[i] == 2 for i in range(len(m) - 2)):
        return False
    digit = {}
    for n in m:
        digit[n % 10] = digit.get(n % 10, 0) + 1
    if max(digit.values()) >= 3:
        return False
    d = [b - a for a, b in zip(m, m[1:])]
    if any(d[i] == d[i + 1] == d[i + 2] for i in range(len(d) - 2)):
        return False
    if max(sum(1 for n in m if n // 10 == k) for k in range(5)) >= 5:
        return False
    return tuple(m) not in past_sets


def share_factor(lam):
    """Expected fraction of the jackpot pool you keep when you win, with Poisson(lam) others."""
    return (1 - math.exp(-lam)) / lam if lam > 1e-9 else 1.0


def run(key, data_rows, n_out, out):
    g = P.GAMES[key]
    draws = P.load(g)
    rows = []
    for i, d in enumerate(draws):
        b = P.slope(g, d)
        if b is None or i < 10:
            continue
        rows.append((P.design(g, d['main'], [x['main'] for x in draws[i - 10:i]]), b, d))

    # 1) Check on real jackpot counts: walk-forward predicted popularity vs number of 1st-prize winners.
    start = 150 if key == 'L7' else 300
    scored = []
    for t in range(start, len(rows)):
        if (t - start) % 25 == 0:
            w = P.fit(g, [(x, b) for x, b, _ in rows[:t]])
        x, b, d = rows[t]
        scored.append((P.predict(w, x), d['w'][1], d['w'][2]))
    scored.sort(key=lambda s: s[0])
    q = len(scored) // 5
    quint = []
    print(f'===== {key}: popularity map checked on real winner counts (map fitted only on earlier draws, {len(scored)} draws) =====')
    for i in range(5):
        part = scored[i * q:(i + 1) * q] if i < 4 else scored[4 * q:]
        j = sum(s[1] for s in part) / len(part)
        s2 = sum(s[2] for s in part) / len(part)
        quint.append({'jackpot': j, 'second': s2, 'n': len(part)})
        print(f'  quintile {i+1} ({"least" if i == 0 else "most" if i == 4 else "     "} popular by the map): '
              f'1st-prize winners per draw {j:.2f}, 2nd-prize {s2:.1f}  ({len(part)} draws)')

    # 2) Final map on all draws, and tickets for the next draw.
    w = P.fit(g, [(x, b) for x, b, _ in rows])
    recent = [r[2] for r in data_rows[-10:]]
    past_sets = {tuple(sorted(r[2])) for r in data_rows}
    rnd = random.Random(697)
    base = [P.predict(w, P.design(g, rnd.sample(range(1, g['max'] + 1), g['pick']), recent)) for _ in range(20000)]
    b0 = sum(base) / len(base)
    lam = sum(d['w'][1] for d in draws) / len(draws)    # mean jackpot winners per draw (average combination)
    beta = w[1:g['max'] + 1]
    pool = sorted(range(1, g['max'] + 1), key=lambda n: beta[n - 1])[:20]
    cands = []
    for c in combinations(pool, g['pick']):
        if not shape_ok(c, g, past_sets):
            continue
        cands.append((P.predict(w, P.design(g, c, recent)), c))
    cands.sort()
    picks = []
    for bpred, c in cands:
        if all(len(set(c) & set(p[1])) <= g['pick'] - 3 for p in picks):
            picks.append((bpred, c))
        if len(picks) >= n_out:
            break

    def describe(c):
        bp = P.predict(w, P.design(g, c, recent))
        R = math.exp(g['pick'] * (bp - b0))
        return {'numbers': sorted(c), 'popularity': R, 'share': share_factor(lam * R) / share_factor(lam)}

    sugg = [describe(c) for _, c in picks]
    nxt = data_rows[-1][0] + 1
    print(f'  next draw R{nxt}: tickets the map rates least shared (popularity 1.00 = average combination):')
    for s in sugg:
        print(f'    {"-".join(map(str, s["numbers"]))}  popularity {s["popularity"]:.2f}  -> jackpot share when won x{s["share"]:.2f} of an average ticket')
    ref = {}
    for label, c in (('app ONE SHOT 18th thread', [7, 9, 10, 20, 31, 35, 36]), ('birthday-style', [3, 7, 8, 11, 12, 21, 28]),
                     ('previous winning set', sorted(data_rows[-1][2]))):
        if len(c) != g['pick']:
            continue
        ref[label] = describe(c)
        print(f'    reference {label}: {"-".join(map(str, sorted(c)))}  popularity {ref[label]["popularity"]:.2f}  share x{ref[label]["share"]:.2f}')
    out[key] = {'nextRound': nxt, 'checkQuintiles': quint, 'jackpotLambda': lam, 'suggestions': sugg, 'reference': ref,
                'beta': {n: beta[n - 1] for n in range(1, g['max'] + 1)}, 'gamma': dict(zip(P.PATTERNS, w[g['max'] + 1:]))}


if __name__ == '__main__':
    D = load_data_js()
    n_out = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 5
    out = {}
    for key in ('L7', 'L6'):
        run(key, D[key], n_out, out)
        print()
    if '--json' in sys.argv:
        json.dump(out, open(sys.argv[sys.argv.index('--json') + 1], 'w'), ensure_ascii=False, indent=1)
