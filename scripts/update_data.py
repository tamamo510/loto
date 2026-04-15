#!/usr/bin/env python3
"""
Fetch latest Loto6/Loto7 data + set balls from sougaku.com
and update data.js in the repository.
Runs via GitHub Actions or manually.
"""
import re
import json
import urllib.request
from html.parser import HTMLParser

URLS = {
    'loto6': 'https://sougaku.com/loto6/data/list1/',
    'loto7': 'https://sougaku.com/loto7/data/list1/',
}
CFG = {
    'loto6': {'pick': 6, 'bonus': 1, 'max': 43},
    'loto7': {'pick': 7, 'bonus': 2, 'max': 37},
}
DATA_JS = 'data.js'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'


class TableParser(HTMLParser):
    """Extract table rows from HTML."""
    def __init__(self):
        super().__init__()
        self.in_td = False
        self.in_tr = False
        self.rows = []
        self.current_row = []
        self.current_cell = ''

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.in_tr = True
            self.current_row = []
        elif tag == 'td' and self.in_tr:
            self.in_td = True
            self.current_cell = ''

    def handle_endtag(self, tag):
        if tag == 'td' and self.in_td:
            self.in_td = False
            self.current_row.append(self.current_cell.strip())
        elif tag == 'tr' and self.in_tr:
            self.in_tr = False
            if self.current_row:
                self.rows.append(self.current_row)

    def handle_data(self, data):
        if self.in_td:
            self.current_cell += data


def fetch_page(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8', errors='replace')


def parse_draws(html, game_type):
    cfg = CFG[game_type]
    pick = cfg['pick']
    bcnt = cfg['bonus']

    parser = TableParser()
    parser.feed(html)

    results = []
    for row in parser.rows:
        if len(row) < pick + bcnt + 3:
            continue
        m = re.match(r'第?(\d+)回?', row[0])
        if not m:
            continue
        rnd = int(m.group(1))
        if rnd < 1:
            continue

        nums = []
        for i in range(1, pick + 1):
            try:
                n = int(row[i])
                if 1 <= n <= cfg['max']:
                    nums.append(n)
            except (ValueError, IndexError):
                pass
        if len(nums) != pick:
            continue

        bonuses = []
        for i in range(pick + 1, pick + 1 + bcnt):
            try:
                n = int(row[i])
                if 1 <= n <= cfg['max']:
                    bonuses.append(n)
            except (ValueError, IndexError):
                pass

        set_ball = ''
        for i in range(pick + bcnt + 1, len(row)):
            if re.match(r'^[A-J]$', row[i]):
                set_ball = row[i]
                break

        results.append({
            'round': rnd,
            'numbers': sorted(nums),
            'bonuses': bonuses,
            'set_ball': set_ball,
        })

    results.sort(key=lambda x: x['round'])
    return results


def read_data_js():
    with open(DATA_JS, 'r', encoding='utf-8') as f:
        return f.read()


def get_existing_rounds(content, var_name):
    """Extract round numbers from a JS array variable."""
    pattern = rf'const\s+{var_name}\s*=\s*\['
    m = re.search(pattern, content)
    if not m:
        return set(), -1, -1
    start = m.start()
    # Find all round numbers [N, "date", ...]
    rounds = set()
    for rm in re.finditer(r'\[(\d+),\s*"', content[start:]):
        rounds.add(int(rm.group(1)))
    return rounds, start, -1


def get_existing_set_balls(content, var_name):
    """Extract existing set ball data."""
    pattern = rf'const\s+{var_name}\s*=\s*\{{(.*?)\}};'
    m = re.search(pattern, content)
    if not m:
        return {}
    balls = {}
    for rm in re.finditer(r'(\d+):"([A-J])"', m.group(1)):
        balls[int(rm.group(1))] = rm.group(2)
    return balls


def update_data_js(content, game_type, new_draws):
    """Append new draw data and update set balls."""
    cfg = CFG[game_type]
    var_data = 'LOTO6_DATA' if game_type == 'loto6' else 'LOTO7_DATA'
    var_set = 'LOTO6_SET_BALLS' if game_type == 'loto6' else 'LOTO7_SET_BALLS'

    existing_rounds, _, _ = get_existing_rounds(content, var_data)
    existing_sets = get_existing_set_balls(content, var_set)

    # Find new rounds to add to data array
    new_entries = []
    for d in new_draws:
        if d['round'] not in existing_rounds:
            if game_type == 'loto6':
                bonus = d['bonuses'][0] if d['bonuses'] else 0
                entry = f"[{d['round']}, \"\", {json.dumps(d['numbers'])}, {bonus}, 0]"
            else:
                entry = f"[{d['round']}, \"\", {json.dumps(d['numbers'])}, {json.dumps(d['bonuses'])}, 0]"
            new_entries.append((d['round'], entry))

    if new_entries:
        # Find the end of the data array ("];") and insert before it
        pattern = rf'(const\s+{var_data}\s*=\s*\[.*?)\];'
        m = re.search(pattern, content, re.DOTALL)
        if m:
            new_entries.sort(key=lambda x: x[0])
            additions = ', '.join(e[1] for e in new_entries)
            old_end = m.group(0)
            new_end = old_end[:-2] + ',\n' + additions + '];'
            content = content.replace(old_end, new_end)

    # Update set balls
    new_sets = dict(existing_sets)
    for d in new_draws:
        if d['set_ball'] and d['round'] not in new_sets:
            new_sets[d['round']] = d['set_ball']

    if len(new_sets) > len(existing_sets):
        items = ','.join(f'{r}:"{new_sets[r]}"' for r in sorted(new_sets.keys()))
        new_set_line = f'const {var_set} = {{{items}}};'
        old_pattern = rf'const\s+{var_set}\s*=\s*\{{.*?\}};'
        content = re.sub(old_pattern, new_set_line, content)

    return content, len(new_entries), len(new_sets) - len(existing_sets)


def main():
    content = read_data_js()
    total_new = 0
    total_sets = 0

    for game_type, url in URLS.items():
        print(f'Fetching {game_type} from {url}...')
        try:
            html = fetch_page(url)
            print(f'  Downloaded {len(html)} bytes')
        except Exception as e:
            print(f'  ERROR fetching: {e}')
            continue

        draws = parse_draws(html, game_type)
        print(f'  Parsed {len(draws)} rounds')
        if not draws:
            print(f'  WARNING: No data parsed, skipping')
            continue

        max_round = max(d['round'] for d in draws)
        print(f'  Latest round: R{max_round}')

        content, added, sets_added = update_data_js(content, game_type, draws)
        total_new += added
        total_sets += sets_added
        print(f'  Added {added} new rounds, {sets_added} new set balls')

    if total_new > 0 or total_sets > 0:
        with open(DATA_JS, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'\ndata.js updated: +{total_new} rounds, +{total_sets} set balls')
    else:
        print('\nNo new data to add.')

    return total_new > 0 or total_sets > 0


if __name__ == '__main__':
    import sys
    changed = main()
    sys.exit(0 if changed else 1)
