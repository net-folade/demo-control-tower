"""Fetch the World Bank Pink Sheet (Monthly Prices) and upsert into commodity_prices.

Pulls cocoa, gold, Brent crude, and Thai rice (5%) — the four series most relevant
to Ghana's trade portfolio. Idempotent: re-running rewrites the same rows.

Run:
    python tools/fetch_pink_sheet.py

The Pink Sheet URL is stable but is occasionally rotated by the World Bank.
Override via PINK_SHEET_URL env var if the default 404s.
"""
from __future__ import annotations

import io
import os
import re
import sys
from pathlib import Path

import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import upsert  # noqa: E402

DEFAULT_URL = (
    "https://thedocs.worldbank.org/en/doc/"
    "74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/"
    "CMO-Historical-Data-Monthly.xlsx"
)
SHEET_NAME = "Monthly Prices"

# Maps our canonical commodity key → list of substrings that match the Pink Sheet header.
# Order matters: first match wins, so put the most specific candidate first.
COMMODITY_HEADERS: dict[str, list[str]] = {
    "cocoa": ["Cocoa"],
    "gold": ["Gold"],
    "crude_brent": ["Crude oil, Brent", "Crude oil, brent"],
    "rice": ["Rice, Thai 5%", "Rice, Thai, 5%"],
}

PERIOD_RE = re.compile(r"^\s*(\d{4})M(\d{2})\s*$")


def download_workbook(url: str) -> bytes:
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content


def find_header_row(df: pd.DataFrame) -> int:
    """Locate the row that contains commodity names (e.g., 'Cocoa')."""
    for i in range(min(20, len(df))):
        row = df.iloc[i].astype(str).tolist()
        if any("Cocoa" in cell for cell in row):
            return i
    raise RuntimeError("Could not locate header row (no 'Cocoa' in first 20 rows).")


def find_data_start(df: pd.DataFrame, after: int) -> int:
    """First row whose column 0 looks like 'YYYYMNN'."""
    for i in range(after + 1, len(df)):
        cell = str(df.iloc[i, 0])
        if PERIOD_RE.match(cell):
            return i
    raise RuntimeError("Could not locate first data row (no 'YYYYMNN' period label).")


def match_column(headers: list[str], candidates: list[str]) -> int | None:
    for cand in candidates:
        for j, h in enumerate(headers):
            if cand.lower() in str(h).lower():
                return j
    return None


def parse_period(label: str) -> str | None:
    m = PERIOD_RE.match(label)
    if not m:
        return None
    year, month = m.group(1), m.group(2)
    return f"{year}-{month}-01"


def extract_rows(workbook_bytes: bytes) -> list[dict]:
    df = pd.read_excel(
        io.BytesIO(workbook_bytes), sheet_name=SHEET_NAME, header=None
    )

    header_idx = find_header_row(df)
    units_idx = header_idx + 1
    data_idx = find_data_start(df, header_idx)

    headers = df.iloc[header_idx].tolist()
    units = df.iloc[units_idx].tolist()

    column_map: dict[str, tuple[int, str]] = {}
    for key, candidates in COMMODITY_HEADERS.items():
        col = match_column(headers, candidates)
        if col is None:
            print(f"warn: no column found for {key} (candidates: {candidates})")
            continue
        unit = str(units[col]).strip().strip("()") if col < len(units) else ""
        column_map[key] = (col, unit)

    if not column_map:
        raise RuntimeError("No target commodities matched any column.")

    rows: list[dict] = []
    for i in range(data_idx, len(df)):
        period = parse_period(str(df.iloc[i, 0]))
        if not period:
            continue
        for key, (col, unit) in column_map.items():
            value = df.iloc[i, col]
            if pd.isna(value):
                continue
            try:
                price = float(value)
            except (TypeError, ValueError):
                continue
            rows.append(
                {
                    "commodity": key,
                    "period": period,
                    "price_usd": price,
                    "unit": unit,
                }
            )
    return rows


def main() -> int:
    url = os.environ.get("PINK_SHEET_URL", DEFAULT_URL)
    print(f"Downloading Pink Sheet: {url}")
    blob = download_workbook(url)

    rows = extract_rows(blob)
    print(f"Parsed {len(rows)} commodity_prices rows across {len({r['commodity'] for r in rows})} commodities")

    written = upsert("commodity_prices", rows, on_conflict="commodity,period")
    print(f"Upserted {written} rows into commodity_prices")
    return 0


if __name__ == "__main__":
    sys.exit(main())
