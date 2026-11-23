# -*- coding: utf-8 -*-
"""
KRX(한국거래소) KIND 상장법인 목록을 받아 public/krx.json 을 갱신합니다.
GitHub Actions에서 매주 자동 실행되며, 직접 실행해도 됩니다: python scripts/update_krx.py
출력 형식: {"updated": "YYYY-MM-DD", "source": "KRX KIND", "items": [["005930","삼성전자","KS"], ...]}
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from html import unescape

URL = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13&marketType={}"
MARKETS = {"stockMkt": "KS", "kosdaqMkt": "KQ"}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "krx.json")


def fetch(market):
    req = urllib.request.Request(URL.format(market), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    for enc in ("euc-kr", "cp949", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("cp949", errors="ignore")


def parse(html):
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", html, re.S | re.I):
        tds = [unescape(re.sub(r"<[^>]+>", "", td)).strip() for td in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S | re.I)]
        if len(tds) < 3:
            continue
        name = tds[0]
        # 컬럼: 회사명, 시장구분, 종목코드, ... (KIND 형식). 종목코드 칸을 6자리 패턴으로 찾음
        code = next((t for t in tds[1:4] if re.fullmatch(r"[0-9A-Z]{6}", t)), None)
        if name and code:
            rows.append((code, name))
    return rows


def main():
    items = []
    for mkt, suffix in MARKETS.items():
        rows = parse(fetch(mkt))
        print(mkt, len(rows))
        if len(rows) < 500:
            sys.exit("too few rows for %s (%d) - KIND format changed?" % (mkt, len(rows)))
        items += [[c, n, suffix] for c, n in rows]
    items.sort(key=lambda r: r[0])
    try:
        with open(OUT, encoding="utf-8") as f:
            if json.load(f).get("items") == items:
                print("no change")
                return
    except Exception:
        pass
    kst = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"updated": kst, "source": "KRX KIND", "items": items}, f, ensure_ascii=False, separators=(",", ":"))
    print("wrote", len(items), "items")


if __name__ == "__main__":
    main()
