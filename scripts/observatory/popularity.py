"""Usage: python3 scripts/observatory/popularity.py [--json out.json]

Popularity map: which numbers do players choose more often?

Source: the owner's CSV files (loto7.csv R1-R668, loto6.csv R1-R2085, Shift-JIS) with the number
of winners per prize tier for every draw.

Idea. Under fair draws every combination is equally likely, but players do not pick uniformly.
When the winning numbers are popular, many tickets share them, so every tier has more winners
than chance would give. The effect grows with the number of matched numbers m: a ticket in the
4-match tier shares 4 numbers with the winning set, a ticket in the 6-match tier shares 6.
So inside one draw,  log(winners_k / P_k) = a_d + b_d * m_k,  where P_k is the tier probability
for a uniformly random ticket, a_d absorbs the sales of that draw (which we do not know) and
b_d measures how popular the winning numbers were. Fitting b_d from the tiers of one draw needs
no sales figures at all.

Then b_d is explained by which numbers won: b_d = c + sum_{n in winning set} beta_n. beta_n is
the popularity of number n (log scale, per matched number). Checked walk-forward: beta is fitted
on earlier draws only and must predict b_d of later draws.
"""
import csv
import io
import json
import math
import sys
from math import comb

GAMES = {
    'L7': {'file': 'loto7.csv', 'max': 37, 'pick': 7, 'nb': 2,
           # tier -> matched main numbers used in the slope fit (2nd tier left out: it needs the bonus)
           'tiers': {3: 6, 4: 5, 5: 4, 6: 3}},
    'L6': {'file': 'loto6.csv', 'max': 43, 'pick': 6, 'nb': 1,
           'tiers': {3: 5, 4: 4, 5: 3}},
}


def tier_prob(g, k):
    M, p, nb = g['max'], g['pick'], g['nb']
    other = M - p - nb   # numbers that are neither main nor bonus
    total = comb(M, p)
    if g['pick'] == 7:
        if k == 3: return comb(7, 6) * other / total                      # 6 main, 7th not bonus
        if k == 4: return comb(7, 5) * comb(M - 7, 2) / total
        if k == 5: return comb(7, 4) * comb(M - 7, 3) / total
        if k == 6: return comb(7, 3) * (comb(M - 7, 4) - comb(other, 4)) / total   # 3 main + >=1 bonus
    else:
        if k == 3: return comb(6, 5) * other / total
        if k == 4: return comb(6, 4) * comb(M - 6, 2) / total
        if k == 5: return comb(6, 3) * comb(M - 6, 3) / total
    raise ValueError(k)


def load(g):
    raw = open(g['file'], 'rb').read().decode('cp932')
    rows = list(csv.reader(io.StringIO(raw)))
    h, body = rows[0], rows[1:]
    ci = h.index('1等口数')
    draws = []
    for r in body:
        main = [int(x) for x in r[2:2 + g['pick']]]
        bonus = [int(x) for x in r[2 + g['pick']:2 + g['pick'] + g['nb']]]
        winners = {k: int(r[ci + k - 1]) for k in range(1, max(g['tiers']) + 1)}
        draws.append({'round': int(r[0]), 'date': r[1], 'main': main, 'bonus': bonus, 'w': winners})
    return draws


def slope(g, d):
    xs, ys = [], []
    for k, m in g['tiers'].items():
        if d['w'][k] <= 0:
            return None
        xs.append(m)
        ys.append(math.log(d['w'][k] / tier_prob(g, k)))
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)


def solve(A, b):
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        for r in range(n):
            if r != c and M[r][c]:
                f = M[r][c] / M[c][c]
                for j in range(c, n + 1):
                    M[r][j] -= f * M[c][j]
    return [M[i][n] / M[i][i] for i in range(n)]


# Shape of a ticket. Learned from 670/2085 winning sets, so only shapes that fair draws produce
# often enough are covered; extreme shapes (1-2-3-4-5-6-7, a whole column of the slip) are kept
# out of suggested tickets by the rules in shape_ok() instead.
PATTERNS = ['consec', 'sameDecade', 'sameDigit', 'arith3', 'hot10']


def pattern_feats(nums, recent):
    m = sorted(nums)
    diffs = [b - a for a, b in zip(m, m[1:])]
    hot = {}
    for dd in recent:
        for n in dd:
            hot[n] = hot.get(n, 0) + 1
    digit = {}
    for n in m:
        digit[n % 10] = digit.get(n % 10, 0) + 1
    return [
        sum(1 for x in diffs if x == 1),                                   # consecutive pairs
        max(sum(1 for n in m if n // 10 == k) for k in range(5)),          # most numbers in one decade
        max(digit.values()),                                               # most numbers with one last digit
        sum(1 for x, y in zip(diffs, diffs[1:]) if x == y),                # equal steps in a row
        sum(hot.get(n, 0) for n in m) / len(m),                            # appearances in the last 10 draws
    ]


def design(g, main, recent):
    return [1.0] + [1.0 if n in main else 0.0 for n in range(1, g['max'] + 1)] + pattern_feats(main, recent)


def fit(g, rows, lam=2.0):
    """Ridge fit of b = c + sum beta_n (winning numbers) + sum gamma_j (shape). rows: (x, b)."""
    K = len(rows[0][0])
    A = [[0.0] * K for _ in range(K)]
    v = [0.0] * K
    for x, b in rows:
        nz = [i for i in range(K) if x[i]]
        for i in nz:
            v[i] += x[i] * b
            for j in nz:
                A[i][j] += x[i] * x[j]
    for i in range(1, K):
        A[i][i] += lam
    return solve(A, v)


def predict(w, x):
    return sum(a * b for a, b in zip(w, x))


def corr(a, b):
    n = len(a)
    ma, mb = sum(a) / n, sum(b) / n
    sa = math.sqrt(sum((x - ma) ** 2 for x in a))
    sb = math.sqrt(sum((y - mb) ** 2 for y in b))
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (sa * sb)


def run(key, out):
    g = GAMES[key]
    draws = load(g)
    rows = []
    for i, d in enumerate(draws):
        b = slope(g, d)
        if b is None or i < 10:
            continue
        rows.append((design(g, d['main'], [x['main'] for x in draws[i - 10:i]]), b, d))
    bs = [b for _, b, _ in rows]
    mb = sum(bs) / len(bs)
    print(f'===== {key}: {len(rows)} draws with all tiers (R{rows[0][2]["round"]}-R{rows[-1][2]["round"]}) =====')
    print(f'  popularity slope b per draw: mean {mb:+.4f}, sd {math.sqrt(sum((x-mb)**2 for x in bs)/len(bs)):.4f} (log winners per matched number)')
    K0 = g['max'] + 1
    start = 150 if key == 'L7' else 300
    res = {}
    for label, cols in (('numbers only', K0), ('numbers + shape', K0 + len(PATTERNS))):
        pred, act = [], []
        for t in range(start, len(rows)):
            if (t - start) % 25 == 0:
                w = fit(g, [(x[:cols], b) for x, b, _ in rows[:t]])
            x, b, _ = rows[t]
            pred.append(predict(w, x[:cols]))
            act.append(b)
        r = corr(pred, act)
        res[label] = r
        print(f'  walk-forward [{label}]: predicted vs actual popularity of the winning set, {len(act)} draws: r = {r:+.3f} (R^2 = {r*r:.2f})')
    w = fit(g, [(x, b) for x, b, _ in rows])
    beta = [0.0] + w[1:K0]
    gamma = dict(zip(PATTERNS, w[K0:]))
    order = sorted(range(1, g['max'] + 1), key=lambda n: beta[n])
    fmt = lambda n: f'{n}({beta[n]:+.3f})'
    print('  least popular 12:', ' '.join(fmt(n) for n in order[:12]))
    print('  most popular 12: ', ' '.join(fmt(n) for n in order[::-1][:12]))
    print('  shape effects (per unit):', ' '.join(f'{k} {v:+.4f}' for k, v in gamma.items()))
    out[key] = {'rounds': [rows[0][2]['round'], rows[-1][2]['round']], 'n': len(rows), 'walkForward': res,
                'w': w, 'beta': {n: beta[n] for n in range(1, g['max'] + 1)}, 'gamma': gamma,
                'jackpotWinnersMean': sum(d['w'][1] for d in draws) / len(draws)}
    return rows, w


if __name__ == '__main__':
    out = {}
    for key in ('L7', 'L6'):
        run(key, out)
        print()
    if '--json' in sys.argv:
        json.dump(out, open(sys.argv[sys.argv.index('--json') + 1], 'w'), ensure_ascii=False, indent=1)
