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
import ssl
import sys
import json
import socket
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

# Every run log since 2026-07-06 (older logs expired) fails with
# CERTIFICATE_VERIFY_FAILED: Hostname mismatch. On 2026-10-02 both sougaku.com
# and www.sougaku.com answered with the hosting company's default certificate
# (*.xserver.jp) and its "無効なURLです" page: the site is no longer served.
# Fetches keep failing (and the workflow turns red) until a new source is chosen.
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


def describe_cert(host):
    """Diagnostics only: whose certificate does this host present?

    The chain is still verified; only the name check is skipped so the
    certificate can be read and printed. Nothing fetched here is used as data.
    """
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    with socket.create_connection((host, 443), timeout=15) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            cert = ssock.getpeercert()
    subject = dict(item[0] for item in cert.get('subject', ()))
    issuer = dict(item[0] for item in cert.get('issuer', ()))
    sans = [v for k, v in cert.get('subjectAltName', ()) if k == 'DNS']
    return (f"CN={subject.get('commonName')} SAN={sans[:6]} "
            f"issuer={issuer.get('organizationName')} "
            f"valid={cert.get('notBefore')} -> {cert.get('notAfter')}")


_diagnosed_hosts = set()


def fetch_page(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except urllib.error.URLError as e:
        host = urllib.parse.urlsplit(url).hostname
        if isinstance(e.reason, ssl.SSLCertVerificationError) and host not in _diagnosed_hosts:
            _diagnosed_hosts.add(host)
            try:
                print(f'  TLS check {host}: {describe_cert(host)}')
            except Exception as diag_err:
                print(f'  TLS check {host}: unavailable ({diag_err})')
        raise


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

    # Set ball
    sbm = re.search(r'(?:セット球|ｾｯﾄ球?)[：:\s]*([A-J])', text)
    if sbm:
        result['set_ball'] = sbm.group(1)

    # Strategy 1: text-based extraction using 本数字/ボーナス markers
    main_match = re.search(r'本数字(.*?)(?:ボーナス|Ｂ数字|B数字)', text)
    if main_match:
        nums = [int(n) for n in re.findall(r'\d{1,2}', main_match.group(1))
                if 1 <= int(n) <= cfg['max']]
        if len(nums) >= cfg['pick']:
            result['numbers'] = sorted(nums[:cfg['pick']])

    bonus_match = re.search(r'(?:ボーナス|Ｂ数字|B数字).*?数?字?(.*?)(?:セット|ｾｯﾄ|1等|等級|当選)', text)
    if bonus_match:
        nums = [int(n) for n in re.findall(r'\d{1,2}', bonus_match.group(1))
                if 1 <= int(n) <= cfg['max']]
        if len(nums) >= cfg['bonus']:
            result['bonuses'] = nums[:cfg['bonus']]

    # Strategy 2: table cell extraction fallback
    if len(result['numbers']) < cfg['pick']:
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
    """Get the highest round number inside one JS array variable.

    Scanning the whole file made Loto7 inherit Loto6's round (R2094), so Loto7
    never looked out of date and was never updated.
    """
    m = re.search(rf'const\s+{var_name}\s*=\s*\[(.*?)\];', content, re.DOTALL)
    if not m:
        return 0
    rounds = [int(r.group(1)) for r in re.finditer(r'\[(\d+),\s*"', m.group(1))]
    return max(rounds) if rounds else 0


def append_draws_to_js(content, game_type, draws_to_add):
    """Append new draws to the data array in data.js."""
    var_name = 'LOTO6_DATA' if game_type == 'loto6' else 'LOTO7_DATA'
    cfg = CFG[game_type]

    entries = []
    for d in sorted(draws_to_add, key=lambda x: x['round']):
        sb = d.get('set_ball', '')
        sb_part = f', "{sb}"' if sb else ''
        if game_type == 'loto6':
            bonus = d['bonuses'][0] if d['bonuses'] else 0
            entry = f"[{d['round']}, \"{d.get('date','')}\", {json.dumps(d['numbers'])}, {bonus}, {d.get('co',0)}{sb_part}]"
        else:
            entry = f"[{d['round']}, \"{d.get('date','')}\", {json.dumps(d['numbers'])}, {json.dumps(d['bonuses'])}, {d.get('co',0)}{sb_part}]"
        entries.append(entry)

    if not entries:
        return content

    # Find end of array and append
    pattern = rf'(const\s+{var_name}\s*=\s*\[.*?)\];'
    m = re.search(pattern, content, re.DOTALL)
    if m:
        additions = ',\n'.join(entries)
        content = content[:m.end()-2] + ',\n' + additions + '\n];' + content[m.end():]

    return content


def main():
    """Bring data.js up to date. Returns (changed, failed)."""
    content = read_data_js()
    total_added = 0
    failed = False

    for game_type in ['loto6', 'loto7']:
        var_data = 'LOTO6_DATA' if game_type == 'loto6' else 'LOTO7_DATA'
        detail_base = DETAIL_URLS[game_type]
        max_round = get_max_round(content, var_data)
        print(f'\n{game_type.upper()}: Current max round = R{max_round}')

        # Step 1: List page (set ball fallback + cross-check of the numbers)
        list_by_round = {}
        try:
            print(f'  Fetching list page...')
            list_html = fetch_page(LIST_URLS[game_type])
            list_by_round = {ld['round']: ld for ld in parse_list_page(list_html, game_type)}
            print(f'  List: {len(list_by_round)} rounds parsed')
        except Exception as e:
            print(f'  WARNING list page error (no cross-check / set ball fallback): {e}')

        # Step 2: Get latest round from detail page
        print(f'  Fetching latest detail page...')
        try:
            latest_html = fetch_page(detail_base + 'index.html')
            latest = parse_detail_page(latest_html, game_type)
            print(f'  Latest: R{latest["round"]} ({latest["date"]}) CO={latest["co"]:,}')
        except Exception as e:
            print(f'  ERROR fetching latest detail: {e}')
            failed = True
            continue

        if latest['round'] <= max_round:
            print(f'  No new rounds (latest=R{latest["round"]})')
            continue

        # Step 3: Fetch detail pages for the missing rounds, oldest first.
        # Stop at the first round that cannot be fetched or verified, so data.js
        # never gets a gap; the next run resumes from that round.
        draws_to_add = []
        for r in range(max_round + 1, latest['round'] + 1):
            try:
                if r == latest['round']:
                    d = latest
                else:
                    html = fetch_page(f'{detail_base}index{r}.html')
                    d = parse_detail_page(html, game_type)
            except Exception as e:
                print(f'  R{r}: ERROR: {e}')
                failed = True
                break

            ld = list_by_round.get(r)
            if len(d['bonuses']) != CFG[game_type]['bonus'] and ld \
                    and len(ld['bonuses']) == CFG[game_type]['bonus']:
                d['bonuses'] = ld['bonuses']

            if d['round'] != r or len(d['numbers']) != CFG[game_type]['pick'] \
                    or len(d['bonuses']) != CFG[game_type]['bonus'] or not d['date']:
                print(f'  R{r}: Parse failed (round={d["round"]}, nums={len(d["numbers"])}, '
                      f'bonus={len(d["bonuses"])}, date={d["date"]!r})')
                failed = True
                break

            if ld and (ld['numbers'] != d['numbers'] or ld['bonuses'] != d['bonuses']):
                print(f'  R{r}: MISMATCH detail={d["numbers"]} B:{d["bonuses"]} '
                      f'list={ld["numbers"]} B:{ld["bonuses"]}')
                failed = True
                break
            if not d.get('set_ball') and ld and ld['set_ball']:
                d['set_ball'] = ld['set_ball']

            draws_to_add.append(d)
            print(f'  R{r}: {d["numbers"]} B:{d["bonuses"]} date={d["date"]} CO={d["co"]:,} '
                  f'set={d.get("set_ball") or "-"}{" (list ok)" if ld else ""}')

        if draws_to_add:
            content = append_draws_to_js(content, game_type, draws_to_add)
            total_added += len(draws_to_add)
            print(f'  Added {len(draws_to_add)} new rounds to {var_data}')

    if total_added > 0:
        with open(DATA_JS, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'\ndata.js updated: +{total_added} rounds')
    else:
        print('\nNo new data to add.')
    if failed:
        print('FAILED: data.js could not be brought fully up to date (see errors above).')
    return total_added > 0, failed


if __name__ == '__main__':
    changed, failed = main()
    sys.exit(1 if failed else 0)
