"""Fetch UN Comtrade monthly trade flows for Ghana and upsert into trade_flows.

Two passes:
1. All partners, all-commodity TOTAL — populates the partners chart + YTD KPI tile.
2. Per-HS-code World totals (cocoa 1801, gold 7108, crude petroleum 2709, rice 1006) —
   populates the /commodities/[commodity] drill-down.

Idempotent: re-running rewrites the same rows (UNIQUE on period, partner, flow, hs_code).

Run:
    python tools/fetch_comtrade_monthly.py

Uses Comtrade's public preview endpoint (no API key, 500 calls/day, 500 rows/call).
"""
from __future__ import annotations

import sys
import time
from datetime import date
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import upsert  # noqa: E402

BASE = "https://comtradeapi.un.org/public/v1/preview/C/M/HS"
PARTNER_REF = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json"
GHANA_M49 = "288"
WORLD_M49 = "0"
MONTHS_BACK = 24
# Ghana's last published month on Comtrade is 2023-12 (no reporting since).
# Anchor the window to this end period; bump when newer data lands.
END_YEAR = 2023
END_MONTH = 12
# Comtrade preview accepts at most 12 comma-separated periods per call.
MAX_PERIODS_PER_CALL = 12

COMMODITY_HS = {
    "1801": "Cocoa beans, whole or broken, raw or roasted",
    "7108": "Gold (incl. gold plated with platinum), unwrought, semi-mfd, powder",
    "2709": "Petroleum oils and oils from bituminous minerals, crude",
    "1006": "Rice",
}


def load_partner_iso_map() -> dict[int, str]:
    """Fetch Comtrade's partnerAreas reference; map M49 code -> ISO3.

    Preview API returns partnerISO=null, so we resolve it client-side.
    Skips groups (EU, ASEAN, etc.) — we only want country-level partners.
    """
    resp = requests.get(PARTNER_REF, timeout=60)
    resp.raise_for_status()
    out: dict[int, str] = {}
    for row in resp.json().get("results", []):
        if row.get("isGroup"):
            continue
        iso3 = row.get("PartnerCodeIsoAlpha3")
        code = row.get("PartnerCode")
        if iso3 and code is not None:
            out[int(code)] = iso3
    out[0] = "W00"  # World
    return out


PARTNER_ISO: dict[int, str] = {}


def month_periods(months_back: int) -> list[str]:
    """Return YYYYMM strings for `months_back` months ending at END_YEAR/END_MONTH inclusive."""
    year, month = END_YEAR, END_MONTH
    periods: list[str] = [f"{year:04d}{month:02d}"]
    for _ in range(months_back - 1):
        month -= 1
        if month == 0:
            month = 12
            year -= 1
        periods.append(f"{year:04d}{month:02d}")
    return list(reversed(periods))


def fetch(params: dict, max_retries: int = 5) -> list[dict]:
    """GET with retry-on-429. Public preview tier is ~1 req/sec; bursts get throttled."""
    backoff = 2.0
    for attempt in range(max_retries):
        resp = requests.get(BASE, params=params, timeout=60)
        if resp.status_code == 429:
            wait = backoff * (2 ** attempt)
            print(f"  429 rate-limited, sleeping {wait:.1f}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)
            continue
        if not resp.ok:
            raise RuntimeError(
                f"Comtrade {resp.status_code} for {resp.url}\n{resp.text[:500]}"
            )
        payload = resp.json()
        return payload.get("data") or []
    raise RuntimeError(f"Comtrade 429 after {max_retries} retries for {resp.url}")


def normalize(raw: dict, hs_default: str | None = None, allow_world: bool = False) -> dict | None:
    # Keep only the canonical aggregate row per (period, partner, flow, hs_code).
    # Comtrade emits separate rows per partner2Code / customsCode / motCode;
    # the "all sub-categories" aggregate is the one with all of them at their
    # zero/all-values code. Without this filter, multiple rows collide on our
    # UNIQUE key and the upsert errors with "cannot affect row a second time."
    if raw.get("partner2Code") not in (0, None):
        return None
    if raw.get("customsCode") not in ("C00", None):
        return None
    if raw.get("motCode") not in (0, None):
        return None

    partner_iso = raw.get("partnerISO")
    if not partner_iso:
        # Preview API returns partnerISO=null; resolve via M49 code lookup.
        code = raw.get("partnerCode")
        if code is None:
            return None
        partner_iso = PARTNER_ISO.get(int(code))
        if not partner_iso:
            return None
    if partner_iso == "W00" and not allow_world:
        return None
    if partner_iso == "_X":
        return None

    period_int = raw.get("period")
    if not period_int:
        return None
    period = f"{int(period_int) // 100:04d}-{int(period_int) % 100:02d}-01"

    flow_code = raw.get("flowCode")
    if flow_code == "M":
        flow = "import"
    elif flow_code == "X":
        flow = "export"
    else:
        return None

    hs_code = str(raw.get("cmdCode") or hs_default or "").strip()
    if not hs_code:
        return None

    value = raw.get("primaryValue")
    if value is None:
        return None

    return {
        "period": period,
        "reporter": "GHA",
        "partner": partner_iso,
        "flow": flow,
        "hs_code": hs_code,
        "commodity_name": raw.get("cmdDesc") or COMMODITY_HS.get(hs_code),
        "value_usd": float(value),
        "qty": raw.get("qty"),
        "qty_unit": raw.get("qtyUnitAbbr"),
    }


def fetch_partner_totals(periods: list[str]) -> list[dict]:
    rows: list[dict] = []
    for p in periods:
        # Omit partnerCode entirely — Comtrade preview rejects "all" with 400.
        # No partnerCode returns rows for every partner.
        params = {
            "reporterCode": GHANA_M49,
            "period": p,
            "cmdCode": "TOTAL",
            "flowCode": "M,X",
        }
        data = fetch(params)
        for raw in data:
            row = normalize(raw)
            if row:
                rows.append(row)
        time.sleep(1.5)
    return rows


def fetch_commodity_world(periods: list[str]) -> list[dict]:
    """Comtrade caps periods at 12 per call, so chunk."""
    rows: list[dict] = []
    chunks = [
        periods[i : i + MAX_PERIODS_PER_CALL]
        for i in range(0, len(periods), MAX_PERIODS_PER_CALL)
    ]
    for hs_code in COMMODITY_HS:
        for chunk in chunks:
            params = {
                "reporterCode": GHANA_M49,
                "period": ",".join(chunk),
                "partnerCode": WORLD_M49,
                "cmdCode": hs_code,
                "flowCode": "M,X",
            }
            data = fetch(params)
            for raw in data:
                row = normalize(raw, hs_default=hs_code, allow_world=True)
                if row:
                    rows.append(row)
            time.sleep(1.5)
    return rows


def main() -> int:
    periods = month_periods(MONTHS_BACK)
    print(f"Fetching {len(periods)} periods: {periods[0]}..{periods[-1]}")

    print("Loading partner M49 -> ISO3 reference")
    PARTNER_ISO.update(load_partner_iso_map())
    print(f"  {len(PARTNER_ISO)} partner codes")

    print("Pass 1/2: partner totals (cmdCode=TOTAL)")
    partner_rows = fetch_partner_totals(periods)
    print(f"  {len(partner_rows)} rows")

    print("Pass 2/2: per-commodity World totals")
    commodity_rows = fetch_commodity_world(periods)
    print(f"  {len(commodity_rows)} rows")

    all_rows = partner_rows + commodity_rows
    if not all_rows:
        print("No rows fetched.")
        return 1

    # Safety net: dedupe on the upsert key. Last write wins.
    by_key: dict[tuple, dict] = {}
    for r in all_rows:
        by_key[(r["period"], r["partner"], r["flow"], r["hs_code"])] = r
    deduped = list(by_key.values())
    dropped = len(all_rows) - len(deduped)
    if dropped:
        print(f"Deduped {dropped} duplicate-key rows ({len(all_rows)} -> {len(deduped)})")

    written = upsert(
        "trade_flows", deduped, on_conflict="period,partner,flow,hs_code"
    )
    print(f"Upserted {written} rows into trade_flows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
