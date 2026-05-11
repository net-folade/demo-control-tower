"""Load GPHA annual port statistics from the checked-in CSV into Supabase.

Source: data/gpha_port_stats_2014_2024.csv, transcribed from GPHA's
"Tema and Takoradi Port Statistics 2014-2024" (June 2025 release).

The CSV is the canonical input; this tool just validates and upserts.

Run:
    python tools/load_gpha_port_stats.py

When GPHA publishes the next year's bulletin (typically mid-year), append
14 new rows to the CSV (7 metrics x 2 ports) and re-run. Idempotent on
(port_code, year, metric).
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import upsert  # noqa: E402

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "gpha_port_stats_2014_2024.csv"

VALID_PORTS = {"TEMA", "TAKORADI"}
VALID_METRICS = {
    "vessel_calls",
    "cargo_tonnes",
    "import_tonnes",
    "export_tonnes",
    "transhipment_tonnes",
    "transit_tonnes",
    "container_teus",
}


def load_rows(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open() as f:
        for raw in csv.DictReader(f):
            port = raw["port_code"].strip()
            metric = raw["metric"].strip()
            if port not in VALID_PORTS:
                raise ValueError(f"unknown port_code {port!r} in {path}")
            if metric not in VALID_METRICS:
                raise ValueError(f"unknown metric {metric!r} in {path}")
            rows.append(
                {
                    "port_code": port,
                    "year": int(raw["year"]),
                    "metric": metric,
                    "value": float(raw["value"]),
                    "unit": raw["unit"].strip() or None,
                }
            )
    return rows


def main() -> int:
    if not CSV_PATH.exists():
        print(f"ERROR: {CSV_PATH} not found")
        return 1

    rows = load_rows(CSV_PATH)
    print(f"Loaded {len(rows)} rows from {CSV_PATH.name}")

    written = upsert("port_stats", rows, on_conflict="port_code,year,metric")
    print(f"Upserted {written} rows into port_stats")
    return 0


if __name__ == "__main__":
    sys.exit(main())
