"""Fetches a public web page and keeps only its readable main content, for building the knowledge base.

Usage: python fetch_page.py <url> [<url> ...]
Each page is printed with a header, and saved as text under research/pages/.
"""
import gzip
import html
import os
import re
import sys
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), "pages")
os.makedirs(OUT, exist_ok=True)
HEADERS = {"User-Agent": "Mozilla/5.0 (research for a demo knowledge base)", "Accept-Encoding": "gzip"}


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=40) as response:
        raw = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
        charset = response.headers.get_content_charset() or "utf-8"
    return raw.decode(charset, errors="replace")


def main_text(page: str) -> str:
    page = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", page)
    # Budget Saudi keeps the page body in <div class="main-content">; fall back to <main> or <body>.
    for pattern in (r'(?is)<div[^>]+class="main-content"[^>]*>(.*)', r"(?is)<main[^>]*>(.*?)</main>", r"(?is)<body[^>]*>(.*)</body>"):
        found = re.search(pattern, page)
        if found:
            page = found.group(1)
            break
    page = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h\d|tr)>", "\n", page)
    page = re.sub(r"(?i)</t[dh]>", " | ", page)
    text = html.unescape(re.sub(r"(?s)<[^>]+>", " ", page))
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in text.splitlines()]
    kept = [line for line in lines if len(line) > 1]
    # cut the shared footer
    for marker in ("Follow us", "تابعنا", "©20"):
        for i, line in enumerate(kept):
            if line.startswith(marker) and i > 5:
                kept = kept[:i]
                break
    return "\n".join(kept)


if __name__ == "__main__":
    for url in sys.argv[1:]:
        try:
            text = main_text(fetch(url))
        except Exception as error:  # noqa: BLE001 - a research helper: report and move on
            print(f"===== {url}\n!! {error}\n")
            continue
        name = re.sub(r"[^A-Za-z0-9]+", "_", url.split("://", 1)[-1]).strip("_")[:120]
        with open(os.path.join(OUT, name + ".txt"), "w", encoding="utf-8") as file:
            file.write(url + "\n\n" + text)
        print(f"===== {url} ({len(text)} chars)\n{text[:4000]}\n")
