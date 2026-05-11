# Ingest trade flows

## Objective
Populate `trade_flows` with Ghana's monthly imports and exports from UN Comtrade. Drives `<TradePartnersChart>` on `/`, the Trade Value YTD KPI tile, and the `/commodities/[commodity]` drill-down.

## Inputs
- UN Comtrade public preview endpoint (`https://comtradeapi.un.org/public/v1/preview/C/M/HS`). No auth; 500 calls/day, 500 rows/call.
- Supabase service-role key in `.env`.

## Tool
`tools/fetch_comtrade_monthly.py`

```bash
python tools/fetch_comtrade_monthly.py
```

Behavior:
1. Computes 24 month periods ending at `END_YEAR`/`END_MONTH` (currently `2023-12`, the last month Ghana reported). Bump these constants when newer data lands.
2. Loads Comtrade's `partnerAreas.json` reference to build an M49 → ISO3 lookup. The preview API returns `partnerISO=null`, so we resolve it client-side. Groups (EU, ASEAN, etc.) are skipped.
3. **Pass 1** — for each period, calls `cmdCode=TOTAL`, `flowCode=M,X` with **no `partnerCode`** (the preview endpoint rejects `partnerCode=all` with a 400; omitting it returns all partners). Yields all-commodity totals per partner.
4. **Pass 2** — for each tracked HS code (cocoa 1801, gold 7108, crude petroleum 2709, rice 1006), calls `partnerCode=0` (World) chunked into groups of ≤12 periods (Comtrade preview caps period lists at 12 per call). Yields one row per period per flow per commodity. `'W00'` is allowed because it's the canonical "all partners" total here.
5. Upserts into `trade_flows` keyed by `(period, partner, flow, hs_code)`.

Rate limiting: 1.5s between calls + automatic retry-on-429 with exponential backoff. The public preview tier throttles at ~1 req/sec. Total per run: ~32 calls (24 partner-totals + 4 commodities × 2 chunks).

## Expected outputs
- `trade_flows` populated with two distinct row shapes:
  - `hs_code='TOTAL'`, partner = ISO3 of trading partner.
  - `hs_code IN ('1801','7108','2709','1006')`, partner = `'W00'`.
- `v_top_trade_partners_ytd` returns top partners for the trailing 12 months ending at the latest period in the data (filters `hs_code='TOTAL'`). Name kept for caller stability; semantics = last 12 mo.
- `v_kpi_summary` row with `metric='trade_value_ytd'` is non-zero (filters `hs_code='TOTAL'`, same trailing-12-mo window).

## Verification
1. `select hs_code, count(*) from trade_flows group by 1 order by 2 desc;` — expect `TOTAL` to dominate, plus four chapter codes.
2. `select max(period) from trade_flows where hs_code='TOTAL';` — should be `2023-12-01` until Ghana resumes reporting.
3. `select * from v_top_trade_partners_ytd limit 10;` — expect ~top-10 partners with non-zero `share_pct`.
4. `select metric, current_value from v_kpi_summary where metric='trade_value_ytd';` — non-zero.
5. Re-run the tool — row counts unchanged.

## Edge cases & known issues
- **Ghana reporting gap.** Ghana has not submitted monthly trade data to Comtrade since 2023-12. Probing `period=202401..` returns `count=0`. The pipeline anchors at 2023-12 and walks 24 months back. Bump `END_YEAR`/`END_MONTH` in the tool when newer data lands. The views in `sql/0004_trade_flow_views.sql` and the dashboard label use "trailing 12 months ending at latest available period" rather than literal YTD, so the UI stays populated despite the gap.
- **500-row preview cap.** Pass 1 (one period at a time) is well under the cap (~100–200 partners/month). If Ghana ever exceeded this, switch to per-flow calls (`flowCode=M` and `flowCode=X` separately).
- **`partnerCode=all` is rejected.** Comtrade's preview returns `400 "The field partnerCode is invalid"` for `partnerCode=all`. Omit the param entirely to get every partner.
- **`partnerISO` is null in preview responses.** Resolve via `partnerCode` (M49) → ISO3 using the `partnerAreas.json` reference. Groups (`isGroup=true`) are skipped.
- **12-period cap on multi-period calls.** Pass 2 chunks periods into groups of 12; exceeding this returns `400 "Maximum number of periods is 12"`.
- **Rate limits.** Public preview tier throttles at ~1 req/sec; bursts get `429`. Inter-call sleep is 1.5s with retry-on-429 backoff.
- **Schema migration.** Views in `sql/0004_trade_flow_views.sql` add `hs_code='TOTAL'` filter to `v_top_trade_partners_ytd` and `v_kpi_summary.trade_12m` to prevent double-counting chapter rows. Run that migration before relying on those views.
- **Partner code special values.** `'W00'` (World) and `'_X'` (Areas, nes) are filtered out in Pass 1; only `'W00'` is allowed through in Pass 2 because it's the per-commodity total.

## Schedule
Monthly via `.github/workflows/pipeline-monthly.yml`. Comtrade publishes mid-month, so cron is set late in the month.
