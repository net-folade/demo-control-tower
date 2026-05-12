"""Fetch port/logistics disruption news from GDELT 2.0 and upsert into disruption_events.

GDELT's DOC API is free and unauthenticated. We query for articles mentioning
the Ghanaian ports, classify each by keywords in the headline (severity +
event_type), and upsert keyed by URL.

Run:
    python tools/fetch_gdelt_disruptions.py
"""
from __future__ import annotations

import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import upsert  # noqa: E402

API_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

# GDELT DOC API only allows parentheses around OR'd statements (no nested AND
# groups). Quoted phrases avoid false positives like "Tema, Mali".
QUERY = (
    '("Tema port" OR "Takoradi port" OR "Port of Tema" OR "Port of Takoradi" '
    'OR "Ghana ports" OR "Ghana port" OR "Tema harbour" OR "Takoradi harbour") '
    "sourcelang:english"
)
TIMESPAN = "30d"      # last 30 days
MAX_RECORDS = 250     # API hard cap
SORT = "DateDesc"

# Severity keywords. Higher tier wins.
SEVERITY_4_TERMS = {
    "strike", "shutdown", "closure", "closed", "shut down",
    "fire", "explosion", "accident", "killed", "deaths", "fatal",
    "blockade", "blocked", "halted", "suspended", "riot",
}
SEVERITY_3_TERMS = {
    "congestion", "delay", "delays", "backlog", "disruption",
    "gridlock", "protest", "demonstration", "stranded", "shortage",
}

# Event-type mapping. First match wins.
EVENT_TYPE_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("strike",     ("strike", "walkout", "industrial action")),
    ("closure",    ("shutdown", "closure", "closed", "shut down", "halted", "suspended")),
    ("accident",   ("fire", "explosion", "accident", "collision", "spill", "killed")),
    ("congestion", ("congestion", "delay", "delays", "backlog", "gridlock", "queue")),
    ("protest",    ("protest", "demonstration", "riot", "blockade", "blocked")),
    ("policy",     ("tariff", "ban", "regulation", "policy", "customs", "duty")),
    ("weather",    ("storm", "flood", "rain", "harmattan", "swell")),
]


def fetch_articles() -> list[dict]:
    params = {
        "query": QUERY,
        "mode": "ArtList",
        "format": "json",
        "timespan": TIMESPAN,
        "maxrecords": MAX_RECORDS,
        "sort": SORT,
    }
    # GDELT throttles unidentified clients hard. Set a real UA + back off on 429.
    headers = {
        "User-Agent": "gh-control-tower/0.1 (demo; portfolio project)",
        "Accept": "application/json,text/plain;q=0.9,*/*;q=0.1",
    }
    backoffs = [5, 15, 30]  # seconds
    last_exc: Exception | None = None
    for attempt, sleep_s in enumerate(backoffs + [0], start=1):
        try:
            resp = requests.get(API_URL, params=params, headers=headers, timeout=60)
            if resp.status_code == 429:
                raise RuntimeError(f"429 throttled (attempt {attempt})")
            resp.raise_for_status()
            text = resp.text.strip()
            if not text:
                raise RuntimeError("empty body")
            # GDELT sometimes returns an HTML error page with 200; guard against it.
            if not text.startswith("{"):
                raise RuntimeError(f"non-JSON body: {text[:120]!r}")
            data = resp.json()
            return data.get("articles", [])
        except (requests.RequestException, ValueError, RuntimeError) as exc:
            last_exc = exc
            if sleep_s == 0:
                break
            print(f"warn: GDELT attempt {attempt} failed ({exc}); sleeping {sleep_s}s…")
            time.sleep(sleep_s)
    if last_exc is not None:
        raise last_exc
    return []


def parse_seendate(s: str) -> datetime:
    # GDELT 2.0 ArtList returns seendate as "YYYYMMDDTHHMMSSZ"; older docs say
    # "YYYYMMDDHHMMSS". Accept both.
    for fmt in ("%Y%m%dT%H%M%SZ", "%Y%m%d%H%M%S"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValueError(f"unrecognized seendate format: {s!r}")


def classify(title: str) -> tuple[str, int]:
    lower = (title or "").lower()
    severity = 2
    if any(term in lower for term in SEVERITY_4_TERMS):
        severity = 4
    elif any(term in lower for term in SEVERITY_3_TERMS):
        severity = 3
    for event_type, terms in EVENT_TYPE_RULES:
        if any(term in lower for term in terms):
            return event_type, severity
    return "logistics", severity


def detect_location(title: str) -> str:
    lower = (title or "").lower()
    if "tema" in lower:
        return "TEMA"
    if "takoradi" in lower:
        return "TAKORADI"
    return "GHANA"


def to_row(article: dict) -> dict | None:
    url = (article.get("url") or "").strip()
    title = (article.get("title") or "").strip()
    seendate = article.get("seendate")
    if not url or not title or not seendate:
        return None
    try:
        ts = parse_seendate(seendate)
    except ValueError:
        return None

    event_type, severity = classify(title)
    location = detect_location(title)

    return {
        "event_key": f"gdelt:{url}",
        "source": "gdelt",
        "event_type": event_type,
        "ts": ts.isoformat(),
        "location": location,
        "headline": title[:500],
        "url": url,
        "severity": severity,
    }


def main() -> int:
    articles = fetch_articles()
    print(f"GDELT returned {len(articles)} articles for query window {TIMESPAN}")

    rows: list[dict] = []
    seen_keys: set[str] = set()
    dropped = 0
    for art in articles:
        row = to_row(art)
        if row is None:
            dropped += 1
            continue
        if row["event_key"] in seen_keys:
            continue
        seen_keys.add(row["event_key"])
        rows.append(row)
    if dropped:
        print(f"dropped {dropped} articles (missing url/title/seendate or unparseable date)")

    if not rows:
        print("No usable rows after parsing.")
        return 0

    by_sev = {3: 0, 4: 0, 2: 0}
    for r in rows:
        by_sev[r["severity"]] = by_sev.get(r["severity"], 0) + 1
    print(f"Classified: severity ≥3 = {by_sev.get(4,0)+by_sev.get(3,0)}, severity 2 = {by_sev.get(2,0)}")

    n = upsert("disruption_events", rows, on_conflict="event_key")
    print(f"Upserted {n} disruption_events rows (gdelt)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
