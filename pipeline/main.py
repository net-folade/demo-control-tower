"""Optional pipeline orchestrator.

GitHub Actions invokes individual tools directly via cron schedules; this
module exists for local testing where you want to run multiple tools in one
shot. Add tool entry points to `JOBS` as they come online.
"""
from __future__ import annotations

import argparse
import importlib
import sys
from typing import Callable

# Map of job-name -> "module:function" reference.
# Populated as tools are built. Slice 0 ships with no jobs registered.
JOBS: dict[str, str] = {
    # "commodity_prices": "tools.fetch_pink_sheet:run",
    # "trade_flows":      "tools.fetch_comtrade_monthly:run",
    # "ais_snapshot":     "tools.snapshot_ais_vessels:run",
}


def _resolve(spec: str) -> Callable:
    module_name, func_name = spec.split(":")
    module = importlib.import_module(module_name)
    return getattr(module, func_name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one or more pipeline jobs.")
    parser.add_argument(
        "jobs",
        nargs="*",
        help=f"Job names to run. Available: {', '.join(JOBS) or '(none registered yet)'}",
    )
    parser.add_argument("--all", action="store_true", help="Run every registered job in order.")
    args = parser.parse_args()

    selected = list(JOBS) if args.all else args.jobs
    if not selected:
        parser.print_help()
        return 0

    for name in selected:
        if name not in JOBS:
            print(f"unknown job: {name}", file=sys.stderr)
            return 2
        print(f"--- running {name} ---")
        _resolve(JOBS[name])()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
