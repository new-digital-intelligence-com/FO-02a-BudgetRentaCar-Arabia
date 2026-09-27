"""Collects Budget branches for one country from budget.com's public location pages (Budget's global
site): country page -> city pages -> each branch page, whose schema.org data gives the address,
phone, opening hours and map position. Gentle: one request every PAUSE seconds, saved after every
branch, resumes where it stopped, and stops at the first refusal.

Usage: python collect_budgetcom.py sa   -> research/budgetcom_SA.json
"""
import gzip
import json
import os
import re
import sys
import time
import urllib.request

BASE = "https://www.budget.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
PAUSE = 1.5
HERE = os.path.dirname(__file__)


class Refused(Exception):
    pass


def get(path: str) -> str:
    request = urllib.request.Request(BASE + path, headers={"User-Agent": UA, "Accept-Encoding": "gzip", "Accept-Language": "en"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            if response.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
    except urllib.error.HTTPError as error:
        if error.code in (403, 429):
            raise Refused(str(error.code)) from error
        raise
    time.sleep(PAUSE)
    return raw.decode("utf-8", errors="replace")


def branch(path: str) -> dict | None:
    try:
        page = get(path)
    except urllib.error.HTTPError as error:
        if error.code == 404:  # a city page can list a branch that no longer has a page
            time.sleep(PAUSE)
            return None
        raise
    for block in re.findall(r"(?s)<script[^>]+application/ld\+json[^>]*>(.*?)</script>", page):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if data.get("@type") != "AutoRental":
            continue
        address = data.get("address") or {}
        coords = re.search(r"q=(-?[\d.]+),(-?[\d.]+)", data.get("map") or "")
        return {
            "url": BASE + path,
            "name": data.get("name"),
            "brand": data.get("brand"),
            "street": address.get("streetAddress"),
            "city": address.get("addressLocality"),
            "region": address.get("addressRegion"),
            "postal_code": address.get("postalCode"),
            "phone": address.get("telephone"),
            "opening_hours": data.get("openingHours"),
            "lat": float(coords.group(1)) if coords else None,
            "lng": float(coords.group(2)) if coords else None,
        }
    return None


def main(country: str) -> None:
    cc = country.lower()
    out = os.path.join(HERE, f"budgetcom_{cc.upper()}.json")
    saved = json.load(open(out, encoding="utf-8")) if os.path.exists(out) else {"cities": [], "branches": {}}
    try:
        if not saved["cities"]:
            page = get(f"/en/locations/{cc}")
            saved["cities"] = sorted(set(re.findall(rf'href="(/en/locations/{cc}/[a-z0-9-]+)"', page)))
        for city_path in saved["cities"]:
            if saved.get(f"scanned:{city_path}"):
                continue
            page = get(city_path)
            # Every branch link on the page, whatever city it is filed under: alternative city names
            # ("madina", "hofuf") list branches that live under the main spelling ("madinah", "al-hasa").
            links = sorted(set(re.findall(rf'href="(/en/locations/{cc}/[a-z0-9-]+/[a-z0-9-]+)"', page)))
            for path in links:
                if path in saved["branches"]:
                    continue
                saved["branches"][path] = branch(path)
                with open(out, "w", encoding="utf-8") as file:
                    json.dump(saved, file, ensure_ascii=False, indent=1)
                b = saved["branches"][path] or {}
                print(f"{path} | {b.get('street')} | {b.get('phone')} | {b.get('opening_hours')}", flush=True)
            saved[f"scanned:{city_path}"] = True
            with open(out, "w", encoding="utf-8") as file:
                json.dump(saved, file, ensure_ascii=False, indent=1)
    except Refused as refusal:
        print(f"refused ({refusal}), stopping; run again later to resume", flush=True)
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        print(f"{cc.upper()}: page not found ({error.url}), skipping", flush=True)
    print(f"{cc.upper()}: {len(saved['branches'])} branches in {out}", flush=True)


if __name__ == "__main__":
    for country in sys.argv[1:] or ["sa"]:
        main(country)
