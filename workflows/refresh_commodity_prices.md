# Refresh commodity prices

## Objective
Keep `commodity_prices` populated with the latest monthly Pink Sheet figures for cocoa, gold, Brent crude, and Thai rice (5%). These power the `<CommodityPriceChart>` and the cocoa KPI tile on `/`.

## Inputs
- World Bank Pink Sheet "Monthly Prices" workbook (XLSX). Default URL is hardcoded in `tools/fetch_pink_sheet.py` and can be overridden via `PINK_SHEET_URL`.
- Supabase service-role key in `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).

## Tool
`tools/fetch_pink_sheet.py`

```bash
python tools/fetch_pink_sheet.py
```

Behavior:
1. Downloads the workbook.
2. Locates the header row by searching for "Cocoa" in the first 20 rows of the `Monthly Prices` sheet.
3. Locates the first data row by matching `YYYYMNN` in column A.
4. Maps each target series to its column via case-insensitive substring matching (so the World Bank's small naming tweaks don't break it).
5. Upserts every monthly observation, keyed by `(commodity, period)`. Period is the first day of the month.

## Expected outputs
- `commodity_prices` populated for the four series. Re-runs are no-ops on rows that haven't changed.
- `v_commodity_price_latest` returns one row per commodity with `prior_period_price`, `pct_change_mom`, and `sparkline_12m` populated.

## Verification
1. `select commodity, count(*) from commodity_prices group by 1;` — expect 4 rows, each with hundreds of monthly entries.
2. `select * from v_commodity_price_latest;` — expect 4 rows, latest period, non-null prior price for any commodity with ≥2 months of data.
3. Run the tool a second time — row counts unchanged, no duplicates.

## Edge cases & known issues
- **URL rotates.** The World Bank publishes the file at a stable-looking URL but rotates the slug occasionally (the `0050012025` segment encodes the year). If the script 404s, find the new link on https://www.worldbank.org/en/research/commodity-markets and set `PINK_SHEET_URL`.
- **Sheet name change.** If the "Monthly Prices" tab is renamed, update `SHEET_NAME` in the tool.
- **Series renamed.** Add new candidate strings to `COMMODITY_HEADERS` rather than removing the old ones, so the matcher stays backward-compatible.
- **Cocoa unit.** Pink Sheet historically reports cocoa in $/kg. If a future revision switches to cents/kg, the values will look 100× off — check the `unit` column before panicking.
- **Cell-dtype coercion.** `find_header_row` wraps each cell with `str()` inside the search comprehension rather than relying on `Series.astype(str)`. The latter has bitten us on CI with newer pandas where a NaN cell slips through as a float and trips `"Cocoa" in cell` with `TypeError: argument of type 'float' is not iterable`. Keep the per-cell `str()`.

## Schedule
Monthly via `.github/workflows/pipeline-monthly.yml`. The Pink Sheet is published around the 2nd of each month, so the cron is set to mid-month to be safe.
