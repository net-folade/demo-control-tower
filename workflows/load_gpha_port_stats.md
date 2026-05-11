# Load GPHA port stats

## Objective
Keep `port_stats` populated with annual vessel-call, cargo-tonnage, and TEU figures for the Port of Tema and the Port of Takoradi. These power `<PortActivityChart>`, `<PortLocationsMap>`, and the port KPI tiles on `/`.

## Inputs
- `data/gpha_port_stats_2014_2024.csv` — checked into the repo. Canonical input.
- Supabase service-role key in `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).

## Source
**"Tema and Takoradi Port Statistics 2014-2024"**, Ghana Ports & Harbours Authority, June 2025.
- Landing page: https://www.ghanaports.gov.gh/media/publications
- PDF: https://singlewindowcompany.azurewebsites.net/publications/ee8b88d3f70e4c4bb364aff767ca714a.pdf

The PDF contains seven annual line/bar charts (vessel calls, cargo tonnes, imports, exports, transhipment, transit, container TEUs) with raw data tables at the bottom of each chart. The CSV is a verbatim transcription of those tables.

## Tool
`tools/load_gpha_port_stats.py`

```bash
python tools/load_gpha_port_stats.py
```

Behavior:
1. Reads `data/gpha_port_stats_2014_2024.csv`.
2. Validates each row's `port_code` and `metric` against allow-lists; raises on unknown values rather than silently inserting bad data.
3. Upserts on `(port_code, year, metric)`. Re-running is a no-op when the CSV hasn't changed.

## Expected outputs
- `port_stats`: 154 rows (11 years × 2 ports × 7 metrics).
- `v_port_stats_latest`: 14 rows (2 ports × 7 metrics), each with `prior_year_value`, `pct_change_yoy`, and a 10-year `sparkline_10y` JSONB payload.
- `v_port_activity`: flat per-year rows for the activity chart.

## Verification
1. `select count(*) from port_stats;` — expect 154.
2. `select port_code, metric, count(*) from port_stats group by 1,2;` — expect 11 per (port, metric).
3. `select * from v_port_stats_latest where port_code='TEMA' and metric='vessel_calls';` — expect 2024, value 1736, prior 1618, pct_change ≈ 7.29.

## Updating for new years
When GPHA publishes the next bulletin (typically mid-year, with prior year's complete data):
1. Open the PDF and pull the data labels from each of the 7 charts.
2. Append 14 rows to `data/gpha_port_stats_2014_2024.csv` (7 metrics × 2 ports for the new year).
3. Rename the CSV if you want it to reflect the new range (and update `CSV_PATH` in the loader).
4. Re-run the loader. Idempotent — only new rows are inserted; existing rows stay put.

## Edge cases & known issues
- **Duplicate values across transhipment and transit in 2022-2023.** The GPHA PDF shows identical values for Tema and Takoradi in both metrics for those two years:
  - Tema transhipment 2022 = 1,598,663 t = Tema transit 2022
  - Tema transhipment 2023 = 1,284,787 t = Tema transit 2023
  - Takoradi transhipment 2022 = 21,205 t = Takoradi transit 2022
  - Takoradi transhipment 2023 = 17,550 t = Takoradi transit 2023

  This looks like a copy-paste error in the source. Values are transcribed faithfully; flag in any analysis touching those metrics for 2022-2023.

- **2024 may be revised.** GPHA occasionally restates prior years in subsequent bulletins. When a new release lands, diff existing CSV rows against the new PDF before appending; if any prior year changes, update the CSV row in place.

- **Annual cadence.** This data is *yearly*, not monthly. Anything that needs monthly granularity (e.g. seasonal trends, MoM KPIs) needs a different source. GPHA does publish monthly bulletins internally but they are not publicly posted at this URL — that's a future-work item documented in README.

## Schedule
Monthly via `.github/workflows/pipeline-monthly.yml`. The CSV rarely changes between runs; the loader is idempotent so the monthly tick is effectively a "is the new GPHA bulletin out yet?" trigger. When the team appends new rows, the next monthly run picks them up automatically.
