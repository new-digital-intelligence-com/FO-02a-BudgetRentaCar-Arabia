"""Collects Budget branch names per city for one country from Budget's public location finder, gently:
waits until the service answers again, then one city every few seconds, saving after each city and
stopping at the first refusal (403), so it never keeps knocking on a door that is closed.

Usage: python collect_branch_names.py SA   -> research/branch_names_SA.json (resumes where it stopped)
"""
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

SHOP = "https://secure.budgetsaudi.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
REFERER = "https://www.budgetsaudi.com/en/rental-locations"
PAUSE = 5  # seconds between requests
WAIT_BLOCKED = 300  # seconds before asking again when refused
MAX_WAITS = 12  # give up after an hour
HERE = os.path.dirname(__file__)


class Refused(Exception):
    pass


def get(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": REFERER, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        if error.code == 403:
            raise Refused() from error
        raise
    time.sleep(PAUSE)
    return body


def options(jsonp: str) -> list[tuple[str, str]]:
    body = html.unescape(jsonp)
    return [(v, html.unescape(t).strip()) for v, t in re.findall(r'<option value="([^"]*)">([^<]*)</option>', body) if v and v != "none"]


def main(country: str) -> None:
    out = os.path.join(HERE, f"branch_names_{country}.json")
    saved = json.load(open(out, encoding="utf-8")) if os.path.exists(out) else {"cities": [], "branches": {}}

    for attempt in range(MAX_WAITS + 1):
        try:
            if not saved["cities"]:
                cities = [v for v, _ in options(get(f"{SHOP}/locationService/?country={country}&language=en&requestType=city&callback=cb"))]
                saved["cities"] = list(dict.fromkeys(c.strip() for c in cities))
            break
        except Refused:
            print(f"refused, waiting {WAIT_BLOCKED}s ({attempt + 1}/{MAX_WAITS})", flush=True)
            time.sleep(WAIT_BLOCKED)
    else:
        print("still refused after an hour, giving up")
        return

    for city in saved["cities"]:
        if city in saved["branches"]:
            continue
        try:
            listed = options(get(f"{SHOP}/locationService/?country={country}&language=en&city={urllib.parse.quote(city)}&requestType=cityLocations&callback=cb"))
        except Refused:
            print("refused again, stopping; run again later to resume", flush=True)
            break
        saved["branches"][city] = [{"code": code, "name": name.split(";", 1)[-1].strip()} for code, name in listed]
        with open(out, "w", encoding="utf-8") as file:
            json.dump(saved, file, ensure_ascii=False, indent=1)
        print(f"{city}: {len(listed)} branches", flush=True)

    done = sum(len(v) for v in saved["branches"].values())
    print(f"{country}: {len(saved['branches'])}/{len(saved['cities'])} cities, {done} branches -> {out}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "SA")
