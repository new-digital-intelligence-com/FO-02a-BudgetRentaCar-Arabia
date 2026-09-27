"""Builds the Budget Rent a Car (Arab region) knowledge base PDFs for the voice agent.

Facts come from Budget's public websites (saved under ../research/pages) and the branch data
collected from budget.com (../research/budgetcom_<CC>.json). English only: Arabic text does not
survive PDF text extraction cleanly, and the agent answers in the caller's dialect anyway.

Usage: python build_knowledge_base.py   -> writes the PDFs next to this file
"""
import json
import os
import re
from collections import defaultdict

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

HERE = os.path.dirname(os.path.abspath(__file__))
RESEARCH = os.path.join(HERE, "..", "research")
CHECKED = "25 September 2026"

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold", italic="Arial", boldItalic="Arial-Bold")

BLUE = colors.HexColor("#02285f")
ORANGE = colors.HexColor("#f26522")
GREY = colors.HexColor("#5b6470")

S = {
    "title": ParagraphStyle("title", fontName="Arial-Bold", fontSize=20, leading=24, textColor=BLUE, spaceAfter=4),
    "subtitle": ParagraphStyle("subtitle", fontName="Arial", fontSize=10.5, leading=14, textColor=GREY, spaceAfter=10),
    "h1": ParagraphStyle("h1", fontName="Arial-Bold", fontSize=14, leading=18, textColor=BLUE, spaceBefore=12, spaceAfter=5),
    "h2": ParagraphStyle("h2", fontName="Arial-Bold", fontSize=11.5, leading=15, textColor=ORANGE, spaceBefore=8, spaceAfter=3),
    "body": ParagraphStyle("body", fontName="Arial", fontSize=10, leading=13.5, alignment=TA_LEFT, spaceAfter=4),
    "note": ParagraphStyle("note", fontName="Arial", fontSize=9, leading=12, textColor=GREY, spaceAfter=4),
    "cell": ParagraphStyle("cell", fontName="Arial", fontSize=8.6, leading=11),
    "cellb": ParagraphStyle("cellb", fontName="Arial-Bold", fontSize=8.6, leading=11, textColor=colors.white),
    "q": ParagraphStyle("q", fontName="Arial-Bold", fontSize=10, leading=13.5, textColor=BLUE, spaceBefore=6, spaceAfter=1),
}


def esc(text: str) -> str:
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def P(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def bullets(items: list[str]) -> ListFlowable:
    return ListFlowable([ListItem(P(i), leftIndent=12, value="•") for i in items], bulletType="bullet", start="•", leftIndent=12, bulletFontSize=9)


def table(header: list[str], rows: list[list[str]], widths: list[float]) -> Table:
    data = [[P(h, "cellb") for h in header]] + [[P(c, "cell") for c in row] for row in rows]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9d1dc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f6fa")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def qa(pairs: list[tuple[str, str]]) -> list:
    out = []
    for q, a in pairs:
        out.append(KeepTogether([P(q, "q"), P(a)]))
    return out


def header(title: str, subtitle: str) -> list:
    return [
        P(title, "title"),
        P(subtitle, "subtitle"),
        P(f"Compiled from Budget's public websites (budgetsaudi.com, budget.com and the Budget country sites), checked {CHECKED}. "
          "Points marked <b>General practice</b> are common Saudi or Gulf rental practice, not a published Budget rule: "
          "the branch or the reservations team confirms them.", "note"),
    ]


def build(filename: str, story: list, title: str) -> None:
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Arial", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(18 * mm, 10 * mm, f"Budget Rent a Car – {title}")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()

    path = os.path.join(HERE, filename)
    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"Budget Rent a Car – {title}", author="Budget knowledge base")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print("wrote", path)


# ---------------------------------------------------------------- branch data (budget.com)

COUNTRIES = {
    "SA": "Saudi Arabia", "AE": "United Arab Emirates", "KW": "Kuwait", "QA": "Qatar", "BH": "Bahrain",
    "OM": "Oman", "JO": "Jordan", "EG": "Egypt", "LB": "Lebanon",
}
# budget.com files some branches under other spellings of the same city; one name per city here.
CITY_FIX = {
    "damman": "Dammam", "albaha": "Al Baha", "al-baha": "Al Baha", "buraida": "Buraidah", "buraydah": "Buraidah",
    "hafar-al-batin": "Hafr Al Batin", "hafr-al-batin": "Hafr Al Batin", "mecca": "Makkah",
    "madina": "Madinah", "medinah": "Madinah", "madina-munawarah": "Madinah", "medinah-munawarah": "Madinah", "medina": "Madinah",
    "jazan": "Jizan", "al-khober": "Al Khobar", "khobar": "Al Khobar", "hofuf": "Al Hasa", "al-ahsa": "Al Hasa",
    "al-ula": "AlUla", "alula": "AlUla", "kharj": "Al Kharj", "jubail": "Al Jubail", "yanbuh": "Yanbu",
    "khamis-musyet": "Khamis Mushait", "qaisumah": "Al Qaisumah", "kaec": "King Abdullah Economic City",
    "safat": "Kuwait City", "kuwait": "Kuwait City",
}
# Word-level spelling fixes inside branch names (only one-word misspellings, so "Al Jubail" never becomes "Al Al Jubail").
WORD_FIX = {"damman": "Dammam", "medinah": "Madinah", "buraida": "Buraidah", "yanbuh": "Yanbu", "albaha": "Al Baha",
            "musyet": "Mushait", "hafar": "Hafr", "banimalik": "Bani Malik"}
# Saudi cities where Budget Saudi says it has an office (About page), to spot any missing from budget.com.
BUDGET_SAUDI_CITIES = [
    "Jeddah", "Riyadh", "Dammam", "Rabigh", "Makkah", "Al Baha", "Baljurashi", "Taif", "Yanbu", "Umluj", "Abha", "Muhayil Aseer",
    "Qunfudah", "Bisha", "Jizan", "Bayesh", "Najran", "Tabuk", "AlUla", "Al Jouf", "Madinah", "Al Wajh", "Al Kharj", "Buraidah",
    "Hail", "Al Hasa", "Al Jubail", "Arar", "Turaif", "Hafr Al Batin", "Al Qaisumah",
]


def branch_label(b: dict) -> str:
    """budget.com's schema name is generic ("Budget Saudi Arabia Abha"); the street field is the branch's own name.
    Short forms are written out so the voice reads them as words."""
    street = (b.get("street") or "").strip()
    name, brand = (b.get("name") or "").strip(), (b.get("brand") or "").strip()
    place = name[len(brand):].strip() if brand and name.startswith(brand) else name
    doubled = re.fullmatch(r"(?i)(.+?)\s*\1", place)  # "AL HASAAl Hasa"
    place = doubled.group(1) if doubled else place
    place, street = (place.title() if place.isupper() else place), (street.title() if street.isupper() else street)
    # one spelling per city in both parts: "Damman Airport" -> "Dammam Airport", "Medinah Airport" -> "Madinah Airport"
    place = " ".join(WORD_FIX.get(w.lower(), w) for w in place.split())
    street = " ".join(WORD_FIX.get(w.lower(), w) for w in street.split())
    # "Shop 9 Gate 140" alone says nothing; put the area first when the street does not already name it
    squash = lambda s: re.sub(r"[\s-]", "", s.lower())  # noqa: E731
    label = f"{place} – {street}" if place and street and squash(place) not in squash(street) else (street or place or name)
    label = re.sub(r"(?<=\w)\s*[-–]\s*(?=\w)", " – ", label)
    for short, full in [(r"\bRd\b\.?", "Road"), (r"\bSt\b\.?", "Street"), (r"\bInt\b\.?", "International"), (r"\bIntl\b\.?", "International"),
                        (r"\bApt\b\.?", "Airport"), (r"\bAve\b\.?", "Avenue"), (r"\bN\. ", "North ")]:
        label = re.sub(short, full, label)
    label = re.sub(r"(\d)(St|Nd|Rd|Th)\b", lambda m: m.group(1) + m.group(2).lower(), label)  # "2Nd Ring Road"
    return re.sub(r"\s+", " ", label).strip(" –")


def branch_kind(name: str) -> str:
    n = re.sub(r"airport (road|rd)", "", name.lower())  # "Jizan Airport Road" is a street, not an airport
    if re.search(r"airport|\bapt\b|int\.|international a|terminal", n):
        return "Airport"
    if re.search(r"train|railway|haramain|rail", n):
        return "Train station"
    if "at your door" in n or "door service" in n:
        return "Delivery service"
    if "hotel" in n or "hilton" in n or "plaza" in n:
        return "Hotel desk"
    return "City branch"


def load_branches(cc: str) -> list[dict]:
    path = os.path.join(RESEARCH, f"budgetcom_{cc}.json")
    if not os.path.exists(path):
        return []
    data = json.load(open(path, encoding="utf-8"))
    out = []
    cities = {CITY_FIX.get(p.split("/")[4]) or p.split("/")[4].replace("-", " ").title() for p in data["branches"]}
    for url_path, b in data["branches"].items():
        if not b or not (b.get("street") or b.get("phone")):
            continue  # missing page, or a page with no details at all
        slug = url_path.split("/")[4]
        # the slug is cleaner than the page's own locality ("AL HASAAl Hasa", "RIYADH")
        city = CITY_FIX.get(slug) or slug.replace("-", " ").title()
        label = branch_label(b)
        # budget.com sometimes files a branch under the wrong city: trust the city its own name starts with
        first = label.split(" – ", 1)[0]
        if first in cities and first != city:
            city = first
        out.append({**b, "city_name": city, "label": label, "codes": [url_path.rstrip("/").split("/")[-1].upper()],
                    "kind": branch_kind(f"{b.get('name') or ''} {label}")})
    # one entry per real branch: budget.com lists some desks several times under different codes
    merged: dict[tuple, dict] = {}
    for b in out:
        key = (b["city_name"], b["label"].lower(), b.get("phone"), hours_text(b.get("opening_hours")))
        if key in merged:
            merged[key]["codes"] += b["codes"]
        else:
            merged[key] = b
    return sorted(merged.values(), key=lambda b: (b["city_name"], b["kind"] != "Airport", b["label"]))


DIAL = {"SA": "966", "AE": "971", "KW": "965", "QA": "974", "BH": "973", "OM": "968", "JO": "962", "EG": "20", "LB": "961"}
# local numbers whose shape is unambiguous: fixed 8-digit plans, Jordan and Egypt mobiles
LOCAL_OK = {"KW": r"\d{8}", "QA": r"\d{8}", "BH": r"\d{8}", "OM": r"\d{8}", "JO": r"7\d{8}", "EG": r"1\d{9}|2 \d{8}", "LB": r"1\d{6}|[3-9]\d{6,7}"}


def phone_text(phone: str | None, cc: str = "SA", siblings: list[str] | None = None, city: str = "") -> str:
    """Written in international form (+CC number) when the local number is unambiguous; otherwise exactly as budget.com has it.
    Saudi 920 numbers stay as they are: they are dialled that way inside the Kingdom."""
    if not phone:
        return "–"
    phone = re.sub(r"X(\d+)$", r" ext. \1", phone.strip())
    if cc == "SA":
        return phone
    main, _, alt = phone.partition("/")
    digits = re.sub(r"\D", "", main.split(" ext.")[0])
    code = DIAL[cc]
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith(code) and len(digits) > len(code) + 6:
        local = digits[len(code):]
    else:
        local = digits.lstrip("0")
    if cc == "EG" and len(local) == 8:
        if city in ("Cairo", "Giza") and local.startswith("2"):
            local = f"2 {local}"  # a Cairo landline: area code 2 plus 8 digits
        else:
            # elsewhere budget.com cuts Egyptian mobiles short: use the full number another branch lists with the same ending
            local = next((s for s in (siblings or []) if len(s) > 8 and s.endswith(local)), local)
    if not re.fullmatch(LOCAL_OK[cc], local):
        return phone
    return f"+{code} {local}" + (f" / {alt.strip()}" if alt.strip() else "")


def sibling_numbers(branches: list[dict], cc: str) -> list[str]:
    out = []
    for b in branches:
        digits = re.sub(r"\D", "", (b.get("phone") or "").split("/")[0])
        digits = digits[2:] if digits.startswith("00") else digits
        digits = digits[len(DIAL[cc]):] if digits.startswith(DIAL[cc]) and len(digits) > 10 else digits.lstrip("0")
        out.append(digits)
    return out


def hours_text(hours) -> str:
    if not hours:
        return "–"
    if isinstance(hours, list):
        hours = "; ".join(hours)
    return hours.replace("open 24 hrs", "open 24 hours")


def where_text(b: dict) -> str:
    """The postal code, when there is a real one (budget.com's locality fields repeat the city, sometimes garbled)."""
    postal = (b.get("postal_code") or "").strip()
    return f"postal code {postal}" if re.fullmatch(r"\d{4,6}(-\d{4})?", postal) else ""


def branch_story(branches: list[dict], cc: str) -> list:
    """One self-contained line per branch, so each knowledge chunk carries the branch's name, city, phone and hours together."""
    country = COUNTRIES[cc]
    siblings = sibling_numbers(branches, cc)
    story = []
    by_city = defaultdict(list)
    for b in branches:
        by_city[b["city_name"]].append(b)
    for city in sorted(by_city):
        rows = by_city[city]
        airports = sum(1 for b in rows if b["kind"] == "Airport")
        story.append(P(f"{esc(city)}, {country}: {len(rows)} Budget location{'s' if len(rows) != 1 else ''}"
                       + (f", {airports} at the airport" if airports else ""), "h2"))
        for b in rows:
            where = where_text(b)
            codes = ", ".join(b["codes"])
            story.append(P(
                f"<b>{esc(b['label'])}</b> ({b['kind'].lower()}, {esc(city)}{', ' + esc(where) if where else ''}). "
                f"Phone {esc(phone_text(b.get('phone'), cc, siblings, city))}. Opening hours: {esc(hours_text(b.get('opening_hours')))}. "
                f"<font color='#5b6470'>Budget location code {esc(codes)}.</font>"))
    return story


# ---------------------------------------------------------------- 01 overview

def doc_overview(all_branches: dict[str, list[dict]]) -> None:
    counts = {cc: len(b) for cc, b in all_branches.items()}
    story = header("Budget Rent a Car in the Arab region", "Overview of the 9 countries, who runs Budget in each, and how to reach them")
    story += [
        P("Budget in the Middle East", "h1"),
        P("Budget Rent a Car is one of the world's largest car rental brands and is part of Avis Budget Group. "
          "Budget's Middle East portal (budget-arabia.com) lists nine Arab countries: <b>Saudi Arabia, United Arab Emirates, Kuwait, "
          "Qatar, Bahrain, Oman, Jordan, Egypt and Lebanon</b>. In each country Budget is run by a local licensee (a local company that "
          "operates the Budget brand), with its own website, phone numbers, prices and rental rules."),
        P("A rental is always handled by the Budget company of the country where the car is picked up. "
          "Budget Saudi Arabia offers free international reservations to any Budget location worldwide, so a customer in Saudi Arabia "
          "can book a Budget car abroad through Budget Saudi. Budget Saudi loyalty points are not earned on rentals outside Saudi Arabia."),
        P("The nine countries at a glance", "h1"),
        table(
            ["Country", "Budget operator / website", "Main contact", "Locations listed on budget.com"],
            [
                ["Saudi Arabia", "United International Transportation Company (Budget Saudi), listed on the Saudi Exchange (symbol 4260). www.budgetsaudi.com",
                 "Reservations 920004124 (+966 92000 4124). Roadside assistance 800 244 3399 (24/7). bccc@budgetsaudi.com",
                 f"{counts.get('SA', '–')} (Budget Saudi has 120+ offices in total)"],
                ["United Arab Emirates", "Budget Rent A Car LLC. www.budget-uae.com",
                 "800 283438 (\"800 BUDGET\"), +971 4 873 5666, care@budget-uae.com", "12 (listed on budget-uae.com, not on budget.com)"],
                ["Kuwait", "Budget Kuwait. kw.budgetinternational.com", "See the Kuwait section of the other-countries document", str(counts.get("KW", "–"))],
                ["Qatar", "Budget Qatar, established 1982, owned by Fakhro Group. www.budgetqatar.com", "See the Qatar section of the other-countries document", str(counts.get("QA", "–"))],
                ["Bahrain", "Budget Bahrain. www.budgetbahrain.com", "See the Bahrain section of the other-countries document", str(counts.get("BH", "–"))],
                ["Oman", "Budget Car Rental (Travel &amp; Allied Services LLC). www.budgetoman.com", "See the Oman section of the other-countries document", str(counts.get("OM", "–"))],
                ["Jordan", "Budget Rent a Car Jordan. www.budgetjordan.com", "24-hour line +962 79 899 7090, info@budgetjordan.jo", str(counts.get("JO", "–"))],
                ["Egypt", "Budget Egypt. www.budget-egypt.com", "See the Egypt section of the other-countries document", str(counts.get("EG", "–"))],
                ["Lebanon", "Budget Lebanon, head office Army Street, Beirut. www.budget.com.lb", "+961 1 762662, info@budget.com.lb. 24/7 emergency and road assistance +961 3 022680", str(counts.get("LB", "–"))],
            ],
            [26, 58, 64, 26],
        ),
        P("Which documents cover what", "h1"),
        bullets([
            "<b>Budget Saudi Arabia – company, contacts and services</b>: who Budget Saudi is, phone numbers, loyalty programme, Quick Pass, chauffeur service, leasing, used cars, promotions.",
            "<b>Budget Saudi Arabia – rental requirements and policies</b>: documents, licences, credit card and deposit, fuel, damage, fines, extensions, early returns, cancellations, accidents, breakdowns and emergency numbers.",
            "<b>Budget Saudi Arabia – branches and opening hours</b>: every Saudi location by city, with address, phone and hours.",
            "<b>Budget in the other 8 Arab countries</b>: contacts, rules and locations for the UAE, Kuwait, Qatar, Bahrain, Oman, Jordan, Egypt and Lebanon.",
            "<b>Budget – frequently asked questions</b>: short answers to the most common customer questions.",
        ]),
        P("Emergency and roadside numbers by country", "h1"),
        table(
            ["Country", "Budget roadside / emergency line", "Public emergency numbers"],
            [
                ["Saudi Arabia", "800 244 3399 (24/7, breakdowns and help on the road)", "911 unified emergency number; 999 police, 997 ambulance, 998 civil defence (fire), 993 traffic accidents. Najm 920000560 or the Najm app for accidents without injuries"],
                ["United Arab Emirates", "800 283438 (800 BUDGET)", "999 police, 998 ambulance, 997 fire"],
                ["Lebanon", "+961 3 022680 (24/7 emergency and road assistance)", "112 police, 140 Red Cross ambulance, 175 civil defence"],
                ["Jordan", "+962 79 899 7090 (24-hour line)", "911 unified emergency number"],
                ["Qatar", "24-hour free roadside assistance with vehicle replacement (Budget Qatar)", "999 emergency"],
                ["Kuwait, Bahrain, Oman, Egypt", "Use the branch phone in the other-countries document", "Kuwait 112, Bahrain 999, Oman 9999, Egypt 122 police / 123 ambulance"],
            ],
            [30, 62, 82],
        ),
        P("If anyone is hurt or in danger, the public emergency number always comes first.", "note"),
    ]
    build("01_Budget_Arab_Region_Overview.pdf", story, "Arab region overview")


# ---------------------------------------------------------------- 02 Saudi company and services

def doc_saudi_company() -> None:
    story = header("Budget Saudi Arabia – company, contacts and services", "Budget Rent a Car in the Kingdom of Saudi Arabia (Budget Saudi)")
    story += [
        P("Who Budget Saudi is", "h1"),
        P("Budget Saudi is the Budget Rent a Car licensee in Saudi Arabia. The company is <b>United International Transportation Company</b> "
          "(also known as Unitrans), listed on the Saudi Exchange (Tadawul) under the symbol <b>4260</b>. Its slogan is <b>\"Keep Moving\"</b>."),
        bullets([
            "Founded in <b>1978</b> with one rental office, 20 cars and 15 employees.",
            "Today the Unitrans group, known through its flagship brand Budget Saudi, runs a combined fleet of about <b>54,000 cars</b>, "
            "<b>120+ rental offices</b> and over <b>1,700 employees</b>. budget.com gives the address and opening hours of about 90 of them "
            "(see the branches document).",
            "<b>Head office in Jeddah</b>, regional offices in <b>Riyadh</b> and <b>Dammam</b>.",
            "Branch offices in: Rabigh, Makkah, Al Baha, Baljurashi, Taif, Yanbu, Umluj, Abha, Muhayil Aseer, Qunfudah, Bisha, Jizan, Bayesh, Najran, "
            "Tabuk, AlUla, Al Jouf, Madinah, Al Wajh, Al Kharj, Buraidah, Hail, Al Hasa, Jubail, Arar, Turaif and Hafr Al Batin.",
            "<b>20+ airport rental offices</b>: Jeddah, Dammam, Riyadh, Madinah, Taif, Jizan, Buraidah, Hail, Turaif, Al Baha, AlUla, Tabuk, Al Jouf, "
            "Al Qaisumah, Bisha, Arar and Najran.",
            "Present at <b>4 railway stations</b>: Jeddah, Makkah, Madinah and King Abdullah Economic City (KAEC) – the Haramain high-speed railway.",
            "<b>20+ workshops</b> across the Kingdom and <b>80+ mobile workshops</b>.",
            "Growth: acquired <b>AutoWorld</b> and a major stake in <b>GES Logistics</b>.",
        ]),
        P("Vision: to be the leading and first-choice vehicle leasing and mobility provider in Saudi Arabia. "
          "Mission: customer excitement and confidence through quality, reliability and cost efficiency, and new product innovations."),
        P("Budget Saudi contact numbers", "h1"),
        table(
            ["What for", "Number / email", "Hours"],
            [
                ["Reservations and questions before renting (quotes, new bookings)", "<b>920004124</b> (+966 92000 4124)", "Saturday to Thursday 09:00–22:00, Friday 17:00–22:00"],
                ["Reservations – alternative line", "+966 12 692 7070 extension 1463", "Sunday to Thursday 08:30–16:30"],
                ["Customer services after a rental (invoices, charges, complaints)", "+966 12 692 7070 extension 1463, email <b>bccc@budgetsaudi.com</b> (Budget Customer Care Centre)", "Sunday to Thursday 08:30–16:30. Budget aims to resolve queries within 5 to 30 days"],
                ["<b>24-hour roadside assistance</b> (breakdown or help on the road in Saudi Arabia)", "<b>800 244 3399</b>", "24 hours a day, 7 days a week"],
                ["Corporate sales and leasing", "+966 12 692 7070 extension 1444, <b>sales@budgetsaudi.com</b>", "Office hours"],
                ["Quick Pass – Riyadh airport", "057 388 0459", "Airport desk"],
                ["Quick Pass – Jeddah airport", "057 389 1972", "Airport desk"],
                ["Quick Pass – Dammam airport", "054 030 9790", "Airport desk"],
            ],
            [60, 62, 52],
        ),
        P("Writing to Budget Saudi: United International Transportation Company, Building No. 6695, King Abdul Aziz Road, Al Basatin District, "
          "Unit 92, Jeddah 23719-4327, Kingdom of Saudi Arabia. Older postal address: PO Box 18106, Jeddah 21415. "
          "Online: the contact form on www.budgetsaudi.com, and the Budget Saudi mobile app. Social media: @budgetsaudi on Instagram and X, "
          "Facebook page Budget.SaudiArabia, YouTube @budgetsaudi7316, LinkedIn \"Budget Rent a Car Saudi Arabia\"."),
        P("Services", "h1"),
        P("Budget Saudi offers short-term local and international rental, long-term rental, corporate leasing, chauffeur drive and limousine "
          "services, cross-border rentals, international and domestic reservations, pre-owned car sales and a loyalty programme."),
        P("Short-term rental (daily, weekly, monthly)", "h2"),
        P("Self-drive car rental from Budget branches, airports, railway stations and hotel desks across the Kingdom. Bookings by phone (920004124), "
          "on www.budgetsaudi.com, in the Budget Saudi app or at a branch. Some cities also have an <b>\"At Your Door\" service</b>, where the car is "
          "delivered to and collected from the customer."),
        P("Chauffeur Drive (car with driver)", "h2"),
        P("Chauffeur-driven cars for business, special occasions or a drive through the city, at special rates at almost all Budget locations in "
          "the Kingdom. Terms of the Budget Dedicated Chauffeur Service:"),
        bullets([
            "Rates include fuel and driver charges only, and are subject to 15% VAT.",
            "Outside Jeddah an extra driver charge of SAR 250 applies (excluding VAT), covering the driver's accommodation and meals.",
            "A full-day service is limited to 10 hours; extra hours or trips are charged separately.",
            "Point-to-point transfers are priced by location and route (different rates inside and outside Jeddah).",
            "Waiting time and parking are charged separately; route or service changes may cost extra.",
            "Subject to vehicle and driver availability. Advance payment is required to confirm the booking.",
        ]),
        P("Budget Saudi Loyalty Programme", "h2"),
        P("Open to all Budget Saudi customers, even first-time customers, and effective immediately after registration (at any Saudi branch or online). "
          "The loyalty card is not a debit or credit card."),
        bullets([
            "Earn <b>1 point for every SAR 100</b> spent, however you pay. Points are valid for life.",
            "Redeem points in blocks of 50, 100, 200 and 500 at any Budget location in Saudi Arabia (redemption only inside Saudi Arabia).",
            "<b>Silver</b>: free 250 km per day / 7,000 km per month, and an extra 3% off the walk-in rate.",
            "<b>Gold</b>: free 300 km per day / 8,000 km per month, and an extra 7% off the walk-in rate.",
            "<b>Platinum</b>: free 350 km per day / 9,000 km per month, and an extra 12% off the walk-in rate.",
            "Tier upgrades are based on points collected within 24 months. Members may get vehicle upgrades, subject to availability.",
            "Conditions: member at least 21 years old with a valid Saudi driving licence; one membership per person; not transferable; "
            "points cannot be exchanged for cash. Points are not earned when the card is used with Budget franchisees outside Saudi Arabia.",
            "Lost or stolen card: email bccc@budgetsaudi.com; a replacement costs SAR 50.",
        ]),
        P("Quick Pass at the airport", "h2"),
        P("A free fast-track airport lane at <b>Riyadh, Jeddah and Dammam airports</b>, only for <b>Corporate, Gold and Platinum</b> customers. "
          "Subject to airport authority rules and vehicle and operational availability; processing time is not guaranteed. "
          "Airport contacts: Riyadh 057 388 0459, Jeddah 057 389 1972, Dammam 054 030 9790."),
        P("Corporate leasing", "h2"),
        P("Custom lease plans for companies: sedans, SUVs, MUVs, light and heavy commercial vehicles, vans, cooling units and industrial equipment. "
          "Included: unlimited mileage, full comprehensive insurance (third-party cover up to SAR 10 million, minimum deductible SAR 2,500), "
          "periodic maintenance, 24/7 roadside assistance on 800 244 3399 (breakdowns, fuel, wheel change, battery boost), free towing within "
          "350 km of the nearest Budget office, immediate replacement cars, 24/7 mobile van service, free first delivery anywhere in the Kingdom, "
          "30-day credit facility, no down payment option, and a buy-back offer for employees at the end of the lease. New vehicles are delivered in "
          "about 15 working days (plus up to 9 for registration), subject to dealer availability. Enquiries: +966 12 692 7070 ext. 1444, sales@budgetsaudi.com."),
        P("Pre-owned car sales", "h2"),
        P("Budget Saudi sells quality used cars from its fleet, maintained in its own workshops and inspected before sale, and helps with the "
          "ownership transfer. Cars for sale and auctions: <b>mazad.budgetsaudi.com</b>."),
        P("Budget Saudi mobile app", "h2"),
        P("The Budget Saudi app lets customers book and manage rentals from their phone. It is available on the app stores."),
        P("Current promotions (published on budgetsaudi.com)", "h1"),
        bullets([
            "<b>Unlimited Miles</b>: unlimited kilometres on daily rentals, at all rental locations in Saudi Arabia. Cannot be combined with other offers "
            "or corporate discounts. Information: 920004124.",
            "<b>AlUla Visitors Offer</b> (account code 1374): an extra 12% off walk-in rates plus 300 km per day, at all Saudi locations. "
            "Not combinable with other offers or corporate discounts. VAT and other charges apply.",
            "<b>Car with Driver</b>: the chauffeur service described above.",
            "<b>Royal Commission for AlUla employees and contractors</b> (account code 1010733): an extra 20% off walk-in rates plus 350 km per day, "
            "on daily and monthly rentals, at all Saudi locations. The AlUla employee or contractor ID card must be shown at the desk. "
            "Not combinable with other offers or corporate discounts.",
            "<b>Explore the UAE with Budget</b> (for rentals in the UAE, BCD code B066900): an extra 5% off prepaid and pay-on-arrival prebooked rates, "
            "unlimited mileage, all vehicles, daily and weekly rentals, one-way fee and airport parking fee included. Bookings: 800 283438 (800 Budget) "
            "or +971 4 873 5666.",
            "There is also an offer for employees of Al Rajhi (details at the branch or on 920004124).",
        ]),
        P("Promotions change often: the agent should check budgetsaudi.com (web search) for the latest offers before promising one.", "note"),
    ]
    build("02_Budget_Saudi_Company_Contacts_Services.pdf", story, "Saudi Arabia: company, contacts, services")


# ---------------------------------------------------------------- 03 Saudi rules and policies

def doc_saudi_rules() -> None:
    story = header("Budget Saudi Arabia – rental requirements and policies", "What a customer needs, and the rules before, during and after a rental")
    story += [
        P("Documents needed to collect a car", "h1"),
        P("Budget Saudi asks customers to bring all of the following when collecting a vehicle:"),
        bullets([
            "<b>Driving licence.</b> Saudi citizens, Saudi residents (iqama holders) and GCC nationals show their <b>local driving licence</b>. "
            "All other nationals show an <b>international driving licence</b> (international driving permit) together with their national licence.",
            "<b>A major credit card in the renter's own name</b>, for the deposit. Even with a prepaid voucher, a deposit is taken on the credit card. "
            "Cash, cheques and debit cards are usually not accepted.",
            "<b>The reservation confirmation</b> (reservation number).",
            "<b>Passport plus one other form of identification</b>. Saudi citizens show their national ID and residents their iqama. "
            "Visitors show their passport with a valid visa.",
            "Any discount, coupon, loyalty card or corporate identification, shown on arrival.",
        ]),
        P("Every driver must be present at the counter with a valid licence. Budget screens for high-risk drivers and may ask about a renter's "
          "driving record; a rental can be refused if the record does not meet Budget's criteria."),
        P("Age and licence", "h2"),
        bullets([
            "Budget Saudi's loyalty programme requires members to be <b>at least 21</b>. <b>General practice</b> in Saudi Arabia: a renter must be at least "
            "21, and at least 25 for luxury cars; the licence should have been held for at least one year.",
            "<b>General practice</b>: visitors may drive in Saudi Arabia on a valid foreign licence with an international driving permit for a limited "
            "time after entry; the reservations team confirms which licences are accepted for the customer's nationality.",
        ]),
        P("The electronic rental contract (Tajeer)", "h2"),
        P("Since 2021 every car rental contract in Saudi Arabia is a unified electronic contract issued on the <b>Tajeer</b> platform of the "
          "Transport General Authority (TGA). The renter needs a valid ID, a driving licence valid for the whole rental, and must confirm the contract "
          "with a verification code sent to the mobile number registered on <b>Absher</b> (citizens and residents). Extensions and closing the "
          "contract are also recorded electronically."),
        P("Booking, changing and cancelling a reservation", "h1"),
        bullets([
            "Book by phone on <b>920004124</b>, on www.budgetsaudi.com, in the Budget Saudi app or at a branch.",
            "Existing bookings can be viewed, changed or cancelled under <b>Manage booking</b> on budgetsaudi.com, or through reservations on 920004124. "
            "The reservation number and the renter's name are needed.",
            "A reservation (confirmed or not) is not yet a rental contract. The contract is made at the time of rental and follows Saudi law.",
            "Budget's online booking system states: cancelling a <b>pay-on-arrival</b> booking is free; for a <b>prepaid</b> booking, the refund "
            "(less administration charges) goes back to the card used, and a cancellation email is sent. Cancelling in advance avoids a no-show fee.",
            "A car category is reserved, not an exact make and model; Budget cannot always guarantee a particular model.",
            "Things to check when booking: whether the rate includes unlimited mileage, the damage excess, VAT (15% in Saudi Arabia), airport "
            "location surcharges, one-way fees (different pick-up and return locations), cross-border fees, and extras such as child seats or GPS.",
        ]),
        P("Extending a rental", "h2"),
        P("<b>General practice</b>: to keep the car longer, the customer contacts Budget <b>before the agreed return time</b> (920004124 or the branch). "
          "The extension depends on the car being available, the rate may change for the new length of rental, and the Tajeer contract is extended "
          "electronically. Returning late without an agreed extension leads to extra charges, as the rental agreement says."),
        P("Returning a car early", "h2"),
        P("<b>General practice</b>: a car can be returned before the agreed date. The rental is then recalculated on the days actually used, so a "
          "weekly or monthly rate may no longer apply, and prepaid days are not always refunded. The customer should tell Budget before returning "
          "early and return the car at the agreed branch unless Budget agrees otherwise."),
        P("Collecting the car", "h1"),
        bullets([
            "The car should be ready on arrival, clean and mechanically sound. Tell a member of staff before leaving if it is not.",
            "The customer signs a <b>pre-rental inspection form</b> showing existing scratches and dents. Walk around the car and have any extra damage "
            "added before accepting it: new damage found at return is charged to the customer.",
            "Check the tyres, wipers, washer fluid, lights, horn, the spare wheel and tools, and the fuel level against the paperwork.",
            "Check the fuel type: the wrong fuel damages the engine, and the customer pays for cleaning the engine and the loss of use.",
        ]),
        P("Fuel options", "h2"),
        P("The car normally comes with a <b>full tank</b>. Some locations offer three fuel options:"),
        bullets([
            "<b>Option 1 – prepay the fuel</b> and bring the car back empty. The tank is charged at, or sometimes below, the current pump price. "
            "No credit is given for unused fuel.",
            "<b>Option 2 – full to full</b>: take it full and bring it back full, to avoid refuelling service charges. Recommended when you plan to stop for fuel.",
            "<b>Option 3 – pay for what you use</b>: Budget refuels after return at the location's per-litre refuelling service charge.",
        ]),
        P("During the rental", "h1"),
        bullets([
            "<b>Only the drivers named on the rental agreement</b> may drive the car. Additional drivers are added at the counter (they must be present with their licence).",
            "<b>Damage cover</b>: the renter is responsible for loss and damage until the car is returned and inspected. Collision/Loss Damage Waiver "
            "(CDW/LDW) and Theft Waiver reduce the renter's liability to the <b>excess</b> shown on the agreement. Check exclusions (for example windscreen, "
            "tyres or roof damage).",
            "<b>Traffic fines</b> (speeding, parking, Saher cameras) during the rental are the renter's responsibility; Budget may add an administration fee.",
            "<b>Cross-border travel</b>: Budget Saudi offers cross-border rentals, but the car may only leave Saudi Arabia with Budget's prior permission and "
            "the insurance required by the other country. Ask when booking.",
            "Off-road driving breaches the standard terms and damages tyres.",
        ]),
        P("Breakdowns, accidents and emergencies", "h1"),
        P("<b>Budget Saudi 24-hour roadside assistance: 800 244 3399</b> – for a breakdown or any help on the road in Saudi Arabia, 24 hours a day, 7 days a week."),
        bullets([
            "<b>If anyone is injured or in danger</b>: call <b>911</b> (unified emergency number) or 997 ambulance, 999 police, 998 civil defence (fire), "
            "993 traffic accidents.",
            "<b>Accident without injuries</b>: report it to <b>Najm</b> (920000560 or the Najm app); Najm handles minor accidents where no one is hurt.",
            "After an accident: do not admit responsibility to anyone involved; take the names and addresses of everyone involved and any witnesses; "
            "call Budget straight away; complete an accident report form when returning the car.",
            "Breakdown: call 800 244 3399. Budget arranges help, towing or a replacement car.",
        ]),
        P("Returning the car", "h1"),
        bullets([
            "Return the car at the agreed time and place, in the same condition, with the agreed fuel level. Late or different-place returns cost extra "
            "unless Budget agreed.",
            "Have a Budget employee inspect the car with you and sign for any damage on the agreement. Allow extra time at busy airport branches.",
            "Out-of-hours return: the renter stays responsible for the car until Budget inspects it. Park safely and legally and take photos inside and out. "
            "Budget recommends returning during opening hours.",
            "Damage may be charged using a pre-calculated repair estimate or the actual repair cost; if the car cannot be rented, a loss-of-use charge may apply.",
        ]),
        P("After the rental: charges and complaints", "h1"),
        P("Charges for damage or traffic offences can arrive after the rental. To dispute one, ask Budget for the supporting documents. Post-rental "
          "questions and complaints go to Budget Customer Care: <b>bccc@budgetsaudi.com</b> or +966 12 692 7070 ext. 1463 (Sunday to Thursday). "
          "Budget aims to resolve queries within 5 to 30 days. Billing disputes are handled by Budget staff, not by an automated assistant."),
    ]
    build("03_Budget_Saudi_Rental_Requirements_Policies.pdf", story, "Saudi Arabia: rental requirements and policies")


# ---------------------------------------------------------------- 04 Saudi branches

def doc_saudi_branches(branches: list[dict]) -> None:
    cities = sorted({b["city_name"] for b in branches})
    airports = [b for b in branches if b["kind"] == "Airport"]
    story = header("Budget Saudi Arabia – branches and opening hours",
                   f"{len(branches)} Budget locations in {len(cities)} Saudi cities with address and hours (from budget.com). "
                   "Budget Saudi has 120+ rental offices in total.")
    story += [
        P("How to use this list", "h1"),
        P("The Budget Saudi reservations number <b>920004124</b> works for every branch. Airport branches are usually open 24 hours. "
          "Opening hours can change during Ramadan and public holidays; for the latest hours, check budgetsaudi.com or budget.com. "
          "Days are written Sun–Sat; in Saudi Arabia the weekend is Friday and Saturday."),
        P("Cities with Budget: " + ", ".join(esc(c) for c in cities) + "."),
    ]
    labels = "".join(b["label"].lower() for b in branches).replace(" ", "")  # "AlUla" also matches "Al Ula"
    unlisted = [c for c in BUDGET_SAUDI_CITIES if c not in cities and c.lower().replace(" ", "") not in labels]
    if unlisted:
        story.append(P("Budget Saudi also says it has offices in " + ", ".join(unlisted) + ", but budget.com gives no address for them. "
                       "For these, give the reservations number 920004124, or check budgetsaudi.com with a web search."))
    story += [
        P("Airport branches", "h2"),
        P("; ".join(f"{esc(b['city_name'])}: {esc(b['label'])} ({esc(hours_text(b.get('opening_hours')))})" for b in airports) + "."),
        P("Branches by city", "h1"),
    ]
    story += branch_story(branches, "SA")
    build("04_Budget_Saudi_Branches.pdf", story, "Saudi Arabia: branches and hours")


# ---------------------------------------------------------------- 05 other countries

OTHER = {
    "AE": {
        "intro": "Budget in the UAE is run by Budget Rent A Car LLC (www.budget-uae.com). It offers short-term rentals and personal, corporate, "
                 "commercial and bespoke leasing.",
        "contacts": [
            "Phone: <b>800 283438 (\"800 BUDGET\")</b> or +971 4 873 5666.",
            "Email: care@budget-uae.com. Assistance hours: Monday to Friday, 8 am to 8 pm Gulf Standard Time.",
            "Head office: Garhoud Tower 2, ground floor, next to Millennium Airport Hotel, near GGICO metro, Al Garhoud, Dubai.",
            "Warehouse: OP01, 23rd Street, Umm Ramool, Rashidiya, Dubai.",
        ],
        "extra": ["Locations listed on budget-uae.com: Al Garhoud (Dubai, head office); AGMC BMW showroom Sheikh Zayed Road, Al Quoz 1 (Dubai); "
                  "AGMC BMW showroom Motor City (Dubai); Al Rashidiya, Umm Ramool (Dubai); Dubai Airport Terminal 1 arrivals; Dubai Airport Terminal 2 "
                  "arrivals; Zayed International Airport, Abu Dhabi (mezzanine above arrivals); Musaffah M-20 near ADNOC station (Abu Dhabi); AGMC Geely "
                  "showroom, Airport Road (Abu Dhabi); Sharjah Airport arrivals; AGMC BMW showroom, Sheikh Mohammed Bin Zayed Road, Al Ruqa Al Hamra "
                  "(Sharjah); AGMC BMW, Sheikh Mohamed Bin Salem Road, Al Dhait (Ras Al Khaimah)."],
    },
    "KW": {
        "intro": "Budget Kuwait (kw.budgetinternational.com) offers quotes, reservations and reservation management online.",
        "contacts": ["Use the branch phone numbers below, or the website."],
        "extra": [],
    },
    "QA": {
        "intro": "Budget Qatar was established in 1982 and is owned by Fakhro Group (www.budgetqatar.com). It runs a fleet of more than 1,000 vehicles, "
                 "none older than 24 months, from economy to super luxury, SUVs, pick-ups, mini-vans and buses.",
        "contacts": ["Reservations by phone, email or on www.budgetqatar.com. See the branch phone numbers below."],
        "extra": [
            "Services: self-drive rentals (daily, weekly, monthly), chauffeur drive, Door-2-Door transfers, long-term rental and leasing, regional and "
            "international bookings, 24-hour free roadside assistance and vehicle replacement, 24-hour airport rental, baby/child seats and GPS.",
            "Rental rules published by Budget Qatar: all drivers must be <b>21 or older (25 for the luxury fleet)</b>; a valid ID or passport and visa; a "
            "driving licence held for at least 1 year; a valid form of payment (no cash rentals); full comprehensive insurance including third-party "
            "liability (conditions apply); the car comes full and must return full, otherwise fuel plus a 5% service charge; the car may "
            "<b>not cross the Qatari border</b>.",
            "Extra charges: delivery or collection QR 30 one way; QR 30 per rental starting at Doha International Airport; QR 25 surcharge per traffic violation.",
            "Payment: any major credit card; corporate customers may pay by cheque or bank transfer (subject to Budget Qatar's credit policy).",
        ],
    },
    "BH": {
        "intro": "Budget Bahrain (www.budgetbahrain.com) offers quotes, reservations, reservation management, offers and used car sales online.",
        "contacts": ["See the branch phone numbers below."],
        "extra": [],
    },
    "OM": {
        "intro": "Budget Oman is run by Travel &amp; Allied Services LLC (www.budgetoman.com).",
        "contacts": ["See the branch phone numbers below."],
        "extra": ["Locations listed on budgetoman.com: Muscat Airport, Muscat Main Office, Al Tameer Street, Salalah Airport, Salalah Crowne Plaza, "
                  "Sohar (Saniya Road), Sur Plaza Hotel, and Duqm City Hotel."],
    },
    "JO": {
        "intro": "Budget Rent a Car Jordan (www.budgetjordan.com).",
        "contacts": ["24-hour phone: <b>+962 79 899 7090</b>. Fax +962 6 586 3930. Email: info@budgetjordan.jo."],
        "extra": [],
    },
    "EG": {
        "intro": "Budget Egypt (www.budget-egypt.com) offers quotes and reservation management online.",
        "contacts": ["See the branch phone numbers below."],
        "extra": [],
    },
    "LB": {
        "intro": "Budget Lebanon, head office on Army Street, PO Box 11-3466, Beirut (www.budget.com.lb).",
        "contacts": [
            "Head office and short-term rental: <b>+961 1 762662</b>, info@budget.com.lb.",
            "Beirut International Airport (open 24/7): +961 1 762660.",
            "<b>Emergency and road assistance (24/7): +961 3 022680.</b>",
            "Long-term rental: +961 1 762650. Sales: +961 1 762634, sales@budget.com.lb.",
            "International reservations call centre: +961 1 366136, reservations@budget.com.lb.",
            "Operations: +961 1 762603 / 762604 / 762605. Accounting: +961 1 762607 to 762609.",
        ],
        "extra": [],
    },
}


def doc_other_countries(all_branches: dict[str, list[dict]]) -> None:
    story = header("Budget in the other 8 Arab countries", "UAE, Kuwait, Qatar, Bahrain, Oman, Jordan, Egypt and Lebanon: contacts, rules and locations")
    story += [P("Each country's Budget company sets its own prices and rules. The Saudi policies do not automatically apply elsewhere. "
                "For bookings in these countries, the agent can take the request and pass it on, or give the local contact below.", "body")]
    for cc in ["AE", "KW", "QA", "BH", "OM", "JO", "EG", "LB"]:
        info = OTHER[cc]
        branches = all_branches.get(cc, [])
        story.append(P(f"Budget {COUNTRIES[cc]}", "h1"))
        story.append(P(info["intro"]))
        story.append(bullets(info["contacts"] + info["extra"]))
        if branches:
            story.append(P(f"{len(branches)} Budget locations in {COUNTRIES[cc]} (from budget.com):", "body"))
            story += branch_story(branches, cc)
    build("05_Budget_Other_Arab_Countries.pdf", story, "Other Arab countries")


# ---------------------------------------------------------------- 06 FAQ

def doc_faq() -> None:
    story = header("Budget – frequently asked questions", "Short answers for customers of Budget Rent a Car, mainly in Saudi Arabia")
    story += [P("Booking and reservations", "h1")]
    story += qa([
        ("How do I book a car with Budget in Saudi Arabia?",
         "Call reservations on 920004124 (Saturday to Thursday 09:00–22:00, Friday 17:00–22:00), book on www.budgetsaudi.com or in the Budget Saudi app, "
         "or visit any Budget branch. You need the pick-up location, the pick-up and return dates and times, and the car type."),
        ("How do I change or cancel my booking?",
         "Use Manage booking on budgetsaudi.com or call 920004124 with your reservation number and the name on the booking. A pay-on-arrival booking "
         "can be cancelled free of charge; a prepaid booking is refunded to the card less administration charges. Cancel in advance to avoid a no-show fee."),
        ("Can I choose the exact car model?",
         "You reserve a car category (for example economy, compact, family sedan, SUV, van or luxury). Budget cannot always guarantee a specific make and model."),
        ("Can I pick up in one city and return in another?",
         "General practice: usually yes, between Budget branches, and a one-way fee may apply. Reservations confirms it when booking."),
        ("Can Budget deliver the car to me?",
         "In several cities Budget Saudi has an \"At Your Door\" service that delivers and collects the car. Ask reservations whether it covers your address."),
        ("Can I book a Budget car in another country?",
         "Yes. Budget Saudi offers free international reservations to any Budget location in the world."),
    ])
    story += [P("Documents and requirements", "h1")]
    story += qa([
        ("What documents do I need to rent a car?",
         "Your driving licence (Saudi citizens, residents and GCC nationals: local licence; other nationals: international driving licence), a major credit "
         "card in your own name, your reservation confirmation, and your passport or national ID / iqama. Every driver must be present with a licence."),
        ("Can I pay with cash or a debit card?",
         "A credit card in the renter's name is needed for the deposit, even with a voucher. Cash, cheques and debit cards are usually not accepted."),
        ("How old do I need to be?",
         "At least 21 in general, and 25 for luxury cars (general practice; confirm for your booking). Budget Saudi loyalty members must be 21 or older."),
        ("What is Tajeer?",
         "The Saudi unified electronic rental contract of the Transport General Authority. You confirm it with a code sent to the mobile number registered on Absher."),
        ("Can someone else drive the car?",
         "Only drivers named on the rental agreement may drive. Add extra drivers at the counter; they must be present with their licence."),
    ])
    story += [P("During and after the rental", "h1")]
    story += qa([
        ("I want to keep the car longer. What do I do?",
         "General practice: contact Budget before your return time (920004124 or the branch). The extension depends on availability and the rate may change."),
        ("Can I return the car early?",
         "General practice: yes. Tell Budget first. The price is recalculated on the days used, so a weekly or monthly rate may no longer apply."),
        ("Which fuel option should I choose?",
         "Full to full is usually cheapest if you can refuel before returning. You can also prepay a tank and return empty (no refund for unused fuel), or "
         "pay Budget for the fuel used at the location's refuelling service charge."),
        ("My car broke down. Who do I call?",
         "Budget Saudi 24-hour roadside assistance: 800 244 3399. If anyone is in danger, call 911 first."),
        ("I had an accident. What do I do?",
         "If anyone is hurt, call 911 (or 997 ambulance). If nobody is hurt, report it to Najm (920000560 or the Najm app). Do not admit responsibility, take "
         "everyone's details, call Budget straight away, and complete an accident report when you return the car."),
        ("Who pays traffic fines?",
         "The renter pays fines incurred during the rental (including Saher camera fines). Budget may add an administration fee."),
        ("I don't agree with a charge on my invoice.",
         "Billing disputes are handled by Budget Customer Care: bccc@budgetsaudi.com or +966 12 692 7070 ext. 1463 (Sunday to Thursday). Ask for the "
         "supporting documents. Budget aims to resolve queries within 5 to 30 days."),
        ("Can I return the car when the branch is closed?",
         "Budget recommends returning during opening hours. If you return out of hours you stay responsible for the car until Budget inspects it; park "
         "safely and take photos inside and out."),
        ("Can I drive the rental car to another country?",
         "Only with Budget's permission and the insurance required by that country. Ask when you book. In Qatar, Budget cars may not cross the border."),
    ])
    story += [P("Services and loyalty", "h1")]
    story += qa([
        ("How does the Budget Saudi loyalty programme work?",
         "Free to join, even on your first rental. Earn 1 point per SAR 100. Silver, Gold and Platinum tiers give 250, 300 or 350 free km a day and an "
         "extra 3%, 7% or 12% off the walk-in rate. Points never expire and are redeemed at Saudi branches."),
        ("What is Quick Pass?",
         "A free fast-track airport lane at Riyadh, Jeddah and Dammam airports for Corporate, Gold and Platinum customers."),
        ("Do you have cars with a driver?",
         "Yes, Budget Chauffeur Drive, at almost all Saudi locations. Rates include fuel and driver, plus 15% VAT; outside Jeddah an extra SAR 250 driver "
         "charge applies; a full day is up to 10 hours; advance payment confirms the booking."),
        ("Does Budget sell used cars?",
         "Yes. Budget Saudi sells inspected pre-owned cars from its fleet: mazad.budgetsaudi.com."),
        ("Do you offer long-term leasing for companies?",
         "Yes, Budget corporate leasing: +966 12 692 7070 ext. 1444 or sales@budgetsaudi.com."),
        ("Are there any offers now?",
         "Published offers include Unlimited Miles on daily rentals, the AlUla Visitors offer (code 1374: 12% off walk-in rates plus 300 km a day), "
         "a Royal Commission for AlUla staff and contractors offer (code 1010733: 20% off plus 350 km a day, with ID card) and, for the UAE, "
         "\"Explore the UAE with Budget\" (code B066900: 5% off prebooked rates with unlimited mileage). Offers change often; check budgetsaudi.com."),
    ])
    build("06_Budget_FAQ.pdf", story, "Frequently asked questions")


def main() -> None:
    all_branches = {cc: load_branches(cc) for cc in COUNTRIES}
    for cc, branches in all_branches.items():
        print(cc, len(branches), "branches")
    doc_overview(all_branches)
    doc_saudi_company()
    doc_saudi_rules()
    doc_saudi_branches(all_branches["SA"])
    doc_other_countries(all_branches)
    doc_faq()


if __name__ == "__main__":
    main()
