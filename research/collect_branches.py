"""Collects Budget rental branches for one country from Budget's public location finder
(the same requests the "Rental locations" page makes in a browser), politely, one at a time.

Usage: python collect_branches.py SA   -> research/branches_SA.json
"""
import gzip
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import uuid

SHOP = "https://secure.budgetsaudi.com"
PAGE = "https://www.budgetsaudi.com/en/rental-locations"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
PAUSE = 0.8  # seconds between requests
HERE = os.path.dirname(__file__)


def get(url: str, data: bytes | None = None, content_type: str | None = None) -> str:
    headers = {"User-Agent": UA, "Referer": PAGE, "Accept-Encoding": "gzip", "Accept": "*/*"}
    if content_type:
        headers["Content-Type"] = content_type
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
    time.sleep(PAUSE)
    return raw.decode("utf-8", errors="replace")


def options(jsonp: str) -> list[tuple[str, str]]:
    body = html.unescape(jsonp)
    return [(v, html.unescape(t).strip()) for v, t in re.findall(r'<option value="([^"]*)">([^<]*)</option>', body) if v and v != "none"]


def text_lines(page: str) -> list[str]:
    page = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", page)
    found = re.search(r'(?is)<div[^>]+class="main-content"[^>]*>(.*)', page)
    page = found.group(1) if found else page
    page = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h\d|dd|dt|tr)>", "\n", page)
    text = html.unescape(re.sub(r"(?s)<[^>]+>", " ", page))
    return [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]


def station(code: str, country: str) -> dict:
    lines = text_lines(get(f"{SHOP}/en/rental-locations/rental-locations-station-details?location={code}&country={country}"))
    info: dict = {"tel": None, "hours": {}, "equipment": []}
    for i, line in enumerate(lines):
        if line.lower().startswith("tel") and i + 1 < len(lines):
            info["tel"] = (line.split(":", 1)[1].strip() or lines[i + 1]).strip()
        day = re.match(r"^(sunday|monday|tuesday|wednesday|thursday|friday|saturday):?$", line, re.I)
        if day and i + 1 < len(lines):
            info["hours"][day.group(1).lower()] = lines[i + 1].replace(" Hrs", "")
    if "Special Equipment at station (subject to availability)" in lines:
        start = lines.index("Special Equipment at station (subject to availability)") + 1
        for line in lines[start:]:
            if line in ("PRINT THIS PAGE", "Back", "Let's go"):
                break
            info["equipment"].append(line)
    return info


def addresses(country: str, city: str) -> dict[str, str]:
    """The city's results page lists each branch with its address, in the order of the links."""
    boundary = "----b" + uuid.uuid4().hex
    fields = {"mgnlModelExecutionUUID": str(uuid.uuid4()), "field": "", "country": country, "city": city, "location": ""}
    body = "".join(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n' for k, v in fields.items())
    body += f"--{boundary}--\r\n"
    page = get(f"{SHOP}/en/rental-locations/rental-locations-results", body.encode(), f"multipart/form-data; boundary={boundary}")
    codes = re.findall(r"rental-locations-station-details\?location=([A-Z0-9_]+)&amp;country=", page) or re.findall(
        r"rental-locations-station-details\?location=([A-Z0-9_]+)&country=", page
    )
    lines = text_lines(page)
    blocks, current = [], None
    for line in lines:
        if re.match(r"^\d+\. ", line):
            current = [line]
            blocks.append(current)
        elif current is not None:
            if line in ("Rental options", "Station information"):
                current = None
            else:
                current.append(line)
    found = {}
    for code, block in zip(dict.fromkeys(codes), blocks):
        found[code] = " ".join(part.rstrip(",") for part in block[1:]).strip()
    return found


def main(country: str) -> None:
    cities = [value for value, _ in options(get(f"{SHOP}/locationService/?country={country}&language=en&requestType=city&callback=cb"))]
    cities = list(dict.fromkeys(c.strip() for c in cities))
    print(f"{country}: {len(cities)} cities")
    branches = []
    for city in cities:
        city_q = urllib.parse.quote(city)
        listed = options(get(f"{SHOP}/locationService/?country={country}&language=en&city={city_q}&requestType=cityLocations&callback=cb"))
        try:
            where = addresses(country, city)
        except Exception as error:  # noqa: BLE001
            print("  address lookup failed for", city, error)
            where = {}
        for code, name in listed:
            try:
                details = station(code, country)
            except Exception as error:  # noqa: BLE001
                print("  station failed", code, error)
                details = {"tel": None, "hours": {}, "equipment": []}
            branch = {
                "country": country,
                "city": city,
                "code": code,
                "name": name.split(";", 1)[-1].strip(),
                "type": "airport" if code.startswith("AIR_") else "city",
                "address": where.get(code),
                **details,
            }
            branches.append(branch)
            print(f"  {city} | {branch['name']} | tel {branch['tel']} | {len(branch['hours'])} days")
    out = os.path.join(HERE, f"branches_{country}.json")
    with open(out, "w", encoding="utf-8") as file:
        json.dump(branches, file, ensure_ascii=False, indent=1)
    print(f"saved {len(branches)} branches to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "SA")
