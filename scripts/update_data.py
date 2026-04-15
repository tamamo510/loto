#!/usr/bin/env python3
"""
Fetch latest Loto6/Loto7 data + set balls from sougaku.com
and update data.js in the repository.

Data sources:
  - Detail pages: date, numbers, bonus, CO, set ball
    Latest: sougaku.com/loto7/data/detail/index.html
    Past:   sougaku.com/loto7/data/detail/index670.html
  - List pages: numbers, bonus, set ball (fallback)
    sougaku.com/loto7/data/list1/

Runs via GitHub Actions or manually.
"""
import re
import json
import urllib.request
from html.parser import HTMLParser

DETAIL_URLS = {
    'loto6': 'https://sougaku.com/loto6/data/detail/',
    'loto7': 'https://sougaku.com/loto7/data/detail/',
}
LIST_URLS = {
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
    """Extract table cell contents from HTML."""
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


def parse_detail_page(html, game_type):
    """Parse a detail page for a single round: date, numbers, bonus, CO, set ball."""
    cfg = CFG[game_type]
    result = {'round': 0, 'date': '', 'numbers': [], 'bonuses': [], 'co': 0, 'set_ball': ''}

    text = re.sub(r'<[^>]+>', ' ', html)  # strip tags for text search
    text = re.sub(r'\s+', ' ', text)

    # Round
    rm = re.search(r'第(\d+)回', text)
    if rm:
        result['round'] = int(rm.group(1))

    # Date: 2026年3月27日
    dm = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', text)
    if dm:
        result['date'] = f"{dm.group(1)}/{dm.group(2)}/{dm.group(3)}"

    # Carryover
    com = re.search(r'キャリーオーバー[^\d]*([\d,]+)円', text)
    if com:
        result['co'] = int(com.group(1).replace(',', ''))

    # Numbers from table cells
    parser = TableParser()
    parser.feed(html)

    all_nums = []
    for row in parser.rows:
        for cell in row:
            cell = cell.strip()
            if re.match(r'^\d{1,2}$', cell):
                n = int(cell)
                if 1 <= n <= cfg['max']:
                    all_nums.append(n)
            if re.match(r'^[A-J]$', cell) and not result['set_ball']:
                result['set_ball'] = cell

    # Try to find numbers near structured area (first group of pick+bonus numbers)
    if len(all_nums) >= cfg['pick'] + cfg['bonus']:
        result['numbers'] = sorted(all_nums[:cfg['pick']])
        result['bonuses'] = all_nums[cfg['pick']:cfg['pick'] + cfg['bonus']]

    return result


def parse_list_page(html, game_type):
    """Parse a list page for multiple rounds: numbers, bonus, set ball."""
    cfg = CFG[game_type]
    parser = TableParser()
    parser.feed(html)

    results = []
    for row in parser.rows:
        if len(row) < cfg['pick'] + cfg['bonus'] + 3:
            continue
        m = re.match(r'第?(\d+)回?', row[0])
        if not m:
            continue
        rnd = int(m.group(1))
        if rnd < 1:
            continue

        nums = []
        for i in range(1, cfg['pick'] + 1):
            try:
                n = int(row[i])
                if 1 <= n <= cfg['max']:
                    nums.append(n)
            except (ValueError, IndexError):
                pass
        if len(nums) != cfg['pick']:
            continue

        bonuses = []
        for i in range(cfg['pick'] + 1, cfg['pick'] + 1 + cfg['bonus']):
            try:
                n = int(row[i])
                if 1 <= n <= cfg['max']:
                    bonuses.append(n)
            except (ValueError, IndexError):
                pass

        set_ball = ''
        for i in range(cfg['pick'] + cfg['bonus'] + 1, len(row)):
            if re.match(r'^[A-J]$', row[i]):
                set_ball = row[i]
                break

        results.append({
            'round': rnd, 'numbers': sorted(nums),
            'bonuses': bonuses, 'set_ball': set_ball,
        })
    return sorted(results, key=lambda x: x['round'])


def read_data_js():
    with open(DATA_JS, 'r', encoding='utf-8') as f:
        return f.read()


def get_max_round(content, var_name):
    """Get the highest round number from a JS array variable."""
    rounds = [int(m.group(1)) for m in re.finditer(r'\[(\d+),\s*"', content)]
    return max(rounds) if rounds else 0


def get_existing_set_balls(content, var_name):
    m = re.search(rf'const\s+{var_name}\s*=\s*\{{(.*?)\}};', content)
    if not m:
        return {}
    return {int(rm.group(1)): rm.group(2) for rm in re.finditer(r'(\d+):"([A-J])"', m.group(1))}


def append_draws_to_js(content, game_type, draws_to_add):
    """Append new draws to the data array in data.js."""
    var_name = 'LOTO6_DATA' if game_type == 'loto6' else 'LOTO7_DATA'
    cfg = CFG[game_type]

    entries = []
    for d in sorted(draws_to_add, key=lambda x: x['round']):
        if game_type == 'loto6':
            bonus = d['bonuses'][0] if d['bonuses'] else 0
            entry = f"[{d['round']}, \"{d.get('date','')}\", {json.dumps(d['numbers'])}, {bonus}, {d.get('co',0)}]"
        else:
            entry = f"[{d['round']}, \"{d.get('date','')}\", {json.dumps(d['numbers'])}, {json.dumps(d['bonuses'])}, {d.get('co',0)}]"
        entries.append(entry)

    if not entries:
        return content

    # Find end of array and append
    pattern = rf'(const\s+{var_name}\s*=\s*\[.*?)\];'
    m = re.search(pattern, content, re.DOTALL)
    if m:
        additions = ', '.join(entries)
        content = content[:m.end()-2] + ',\n' + additions + '];' + content[m.end():]

    return content


def update_set_balls(content, var_name, new_balls):
    """Update set ball dict in data.js."""
    existing = get_existing_set_balls(content, var_name)
    merged = {**existing, **new_balls}
    if len(merged) == len(existing):
        return content, 0

    items = ','.join(f'{r}:"{merged[r]}"' for r in sorted(merged.keys()))
    new_line = f'const {var_name} = {{{items}}};'
    content = re.sub(rf'const\s+{var_name}\s*=\s*\{{.*?\}};', new_line, content)
    return content, len(merged) - len(existing)


def main():
    content = read_data_js()
    total_added = 0
    total_sets = 0

    for game_type in ['loto6', 'loto7']:
        var_data = 'LOTO6_DATA' if game_type == 'loto6' else 'LOTO7_DATA'
        var_set = 'LOTO6_SET_BALLS' if game_type == 'loto6' else 'LOTO7_SET_BALLS'
        detail_base = DETAIL_URLS[game_type]
        max_round = get_max_round(content, var_data)
        print(f'\n{game_type.upper()}: Current max round = R{max_round}')

        # Step 1: Get latest round from detail page
        print(f'  Fetching latest detail page...')
        try:
            latest_html = fetch_page(detail_base + 'index.html')
            latest = parse_detail_page(latest_html, game_type)
            print(f'  Latest: R{latest["round"]} ({latest["date"]}) CO={latest["co"]:,}')
        except Exception as e:
            print(f'  ERROR fetching latest detail: {e}')
            latest = {'round': 0}

        # Step 2: Fetch detail pages for missing rounds
        draws_to_add = []
        new_set_balls = {}

        if latest['round'] > max_round:
            for r in range(max_round + 1, latest['round'] + 1):
                try:
                    if r == latest['round']:
                        d = latest
                    else:
                        print(f'  Fetching R{r} detail...')
                        html = fetch_page(f'{detail_base}index{r}.html')
                        d = parse_detail_page(html, game_type)

                    if d['round'] == r and len(d['numbers']) == CFG[game_type]['pick']:
                        draws_to_add.append(d)
                        print(f'  R{r}: {d["numbers"]} B:{d["bonuses"]} date={d["date"]} CO={d["co"]:,}')
                    else:
                        print(f'  R{r}: Parse failed (round={d["round"]}, nums={len(d["numbers"])})')

                    if d.get('set_ball'):
                        new_set_balls[r] = d['set_ball']
                except Exception as e:
                    print(f'  R{r}: ERROR: {e}')
        else:
            print(f'  No new rounds (latest=R{latest["round"]})')

        # Step 3: List page fallback for set balls
        try:
            print(f'  Fetching list page for set balls...')
            list_html = fetch_page(LIST_URLS[game_type])
            list_data = parse_list_page(list_html, game_type)
            print(f'  List: {len(list_data)} rounds parsed')
            for ld in list_data:
                if ld['set_ball']:
                    new_set_balls.setdefault(ld['round'], ld['set_ball'])
        except Exception as e:
            print(f'  List page error: {e}')

        # Step 4: Update data.js
        if draws_to_add:
            content = append_draws_to_js(content, game_type, draws_to_add)
            total_added += len(draws_to_add)
            print(f'  Added {len(draws_to_add)} new rounds to {var_data}')

        if new_set_balls:
            content, sets_added = update_set_balls(content, var_set, new_set_balls)
            total_sets += sets_added
            print(f'  Added {sets_added} new set balls to {var_set}')

    if total_added > 0 or total_sets > 0:
        with open(DATA_JS, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'\ndata.js updated: +{total_added} rounds, +{total_sets} set balls')
        return True
    else:
        print('\nNo new data to add.')
        return False


if __name__ == '__main__':
    import sys
    changed = main()
    sys.exit(0 if not changed else 0)
