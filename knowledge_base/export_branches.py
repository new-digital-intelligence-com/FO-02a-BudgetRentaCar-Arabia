"""Writes the branches that demo bookings can use to ../web/src/data/branches.json.

Same cleaned names, cities and hours as the knowledge-base PDFs (it reuses build_knowledge_base.py), so what Noura reads in
her documents matches what the booking tools accept. The UAE is not on budget.com: its 12 locations come from budget-uae.com
(no opening hours published there). "At Your Door" delivery services are left out: they are not a place to pick up a car.

Opening hours become a weekly schedule the website can check: for each day (0 = Sunday … 6 = Saturday) a list of
[open, close] in minutes after midnight; a close above 1440 runs past midnight. null = hours not published (never checked).

Usage: python export_branches.py   (run it after the research data changes, like build_knowledge_base.py)
"""
import json
import os
import re

from build_knowledge_base import COUNTRIES, hours_text, load_branches, phone_text, sibling_numbers

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "web", "src", "data", "branches.json")

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

# budget-uae.com/en/our-locations (checked 25 September 2026), in the order the page lists them.
UAE = [
    ("AE-GARHOUD", "Dubai", "Al Garhoud – Head Office, Garhoud Tower 2", "City branch"),
    ("AE-ALQUOZ", "Dubai", "Sheikh Zayed Road – AGMC BMW Showroom, Al Quoz 1", "City branch"),
    ("AE-AUH-GEELY", "Abu Dhabi", "Abu Dhabi Airport Road – AGMC Geely Showroom, Al Muntazah", "City branch"),
    ("AE-MOTORCITY", "Dubai", "Motor City – AGMC BMW Showroom", "City branch"),
    ("AE-SHJ-BMW", "Sharjah", "Sheikh Mohammed Bin Zayed Road – AGMC BMW Showroom, Al Ruqa Al Hamra", "City branch"),
    ("AE-RASHIDIYA", "Dubai", "Al Rashidiya – Umm Ramool, 23rd Street", "City branch"),
    ("AE-DXB-T2", "Dubai", "Dubai Airport – Terminal 2 Arrivals", "Airport"),
    ("AE-DXB-T1", "Dubai", "Dubai Airport – Terminal 1 Arrivals", "Airport"),
    ("AE-SHJ-AIRPORT", "Sharjah", "Sharjah Airport – Arrivals", "Airport"),
    ("AE-AUH-AIRPORT", "Abu Dhabi", "Zayed International Airport – Mezzanine above Arrivals", "Airport"),
    ("AE-MUSAFFAH", "Abu Dhabi", "Musaffah – M-20, near ADNOC station", "City branch"),
    ("AE-RAK", "Ras Al Khaimah", "Ras Al Khaimah – AGMC BMW, Sheikh Mohamed Bin Salem Road, Al Dhait", "City branch"),
]
UAE_PHONE = "800 283438"


def minutes(text: str) -> int:
    match = re.fullmatch(r"(\d{1,2}):(\d{2}) ([AP]M)", text.strip())
    if not match:
        raise ValueError(f"not a time: {text!r}")
    hour, minute, half = int(match.group(1)), int(match.group(2)), match.group(3)
    return (hour % 12 + (12 if half == "PM" else 0)) * 60 + minute


def schedule(hours: str) -> list[list[list[int]]] | None:
    """"Sun - Thu 8:30 AM - 11:00 PM; Fri 4:30 PM - 11:00 PM" -> per day [[510, 1380]], … Days not named are closed."""
    if not hours or hours == "–":
        return None
    week: list[list[list[int]]] = [[] for _ in DAYS]
    for part in hours.split(";"):
        match = re.fullmatch(r"(\w{3})(?: - (\w{3}))? (.+)", part.strip())
        if not match:
            raise ValueError(f"cannot read opening hours {hours!r}")
        first, last, times = DAYS.index(match.group(1)), DAYS.index(match.group(2) or match.group(1)), match.group(3)
        if times == "open 24 hours":
            spans = [[0, 1440]]
        else:
            spans = []
            for span in times.split(" and "):
                start, end = (minutes(t) for t in span.split(" - "))
                spans.append([start, end if end > start else end + 1440])  # "12:00 AM" closes at midnight
        day = first
        while True:
            week[day] += spans
            if day == last:
                break
            day = (day + 1) % 7
    return week


def main() -> None:
    out = []
    for cc in COUNTRIES:
        branches = load_branches(cc)
        siblings = sibling_numbers(branches, cc)
        for b in branches:
            if b["kind"] == "Delivery service":
                continue
            hours = hours_text(b.get("opening_hours"))
            out.append({"code": b["codes"][0], "codes": b["codes"], "country": cc, "city": b["city_name"], "name": b["label"],
                        "kind": b["kind"], "hours": hours, "schedule": schedule(hours),
                        "phone": phone_text(b.get("phone"), cc, siblings, b["city_name"])})
    for code, city, name, kind in UAE:
        out.append({"code": code, "codes": [code], "country": "AE", "city": city, "name": name, "kind": kind,
                    "hours": "not published", "schedule": None, "phone": UAE_PHONE})
    codes = [c for b in out for c in b["codes"]]
    assert len(codes) == len(set(codes)), "a location code is used twice"
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    source = json.dumps("budget.com and budget-uae.com, checked 25 September 2026 (knowledge_base/export_branches.py)")
    lines = ",\n".join("  " + json.dumps(b, ensure_ascii=False, separators=(",", ":")) for b in out)  # one branch per line
    with open(OUT, "w", encoding="utf-8") as file:
        file.write(f'{{\n "source": {source},\n "branches": [\n{lines}\n ]\n}}\n')
    per_country = {cc: sum(1 for b in out if b["country"] == cc) for cc in COUNTRIES}
    print("wrote", os.path.normpath(OUT), len(out), "branches", per_country)
    print("no published hours:", [b["code"] for b in out if b["schedule"] is None])


if __name__ == "__main__":
    main()
