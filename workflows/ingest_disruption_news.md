# Ingest disruption news (GDELT)

## Objective
Populate `disruption_events` with port/logistics news for Ghana from GDELT 2.0. Drives `<AlertsPanel>` on `/`, the `/disruptions` page, and (in combination with weather) the "Active disruptions" KPI tile.

## Inputs
- GDELT 2.0 DOC API (`https://api.gdeltproject.org/api/v2/doc/doc`). Public, no auth, no documented rate limit (treat as ~1 req/sec to be polite).
- Supabase service-role key in `.env`.

## Tool
`tools/fetch_gdelt_disruptions.py`

```bash
python tools/fetch_gdelt_disruptions.py
```

Behavior:
1. Issues one ArtList query for English-language articles in a 30-day window mentioning Tema/Takoradi ports, Ghana ports, or Ghana-trade keywords. `maxrecords=250`, `sort=DateDesc`.
2. For each article, classifies severity by keywords in the title:
   - severity 4: strike, shutdown, closure, fire, explosion, accident, killed, blockade, halted, suspended, riot
   - severity 3: congestion, delay, backlog, disruption, gridlock, protest, stranded, shortage
   - severity 2 otherwise (below the `v_active_alerts` threshold; still visible on `/disruptions`)
3. Maps the title to an `event_type` (strike / closure / accident / congestion / protest / policy / weather / logistics) — first match wins.
4. Detects `location` from the title: "Tema" → `TEMA`, "Takoradi" → `TAKORADI`, else `GHANA`.
5. Upserts into `disruption_events` keyed on `event_key = gdelt:<url>`.

## Expected outputs
- `disruption_events` populated with up to ~250 rows per run. Reruns are no-ops because the key is the canonical URL.
- `v_active_alerts` returns severity ≥3 rows from the last 7 days.
- `v_kpi_summary.active_disruptions` counts the same window.

## Verification
1. `select source, count(*) from disruption_events group by 1;` — `gdelt` non-zero after first run.
2. `select severity, count(*) from disruption_events where source='gdelt' group by 1 order by 1;` — distribution across severities.
3. `select * from v_active_alerts limit 10;` — most-recent severity-≥3 rows from the last 7 days.
4. Re-run the tool — row counts unchanged (URLs already present).

## Edge cases & known issues
- **Sparse signal for Ghana ports.** Some 30-day windows return only a handful of relevant articles. That's accurate, not a bug. If the dashboard feels empty, broaden `QUERY` in the tool or widen the timespan — but don't drop the language filter or you'll start getting false-positive matches from unrelated countries (Tema, Mali exists).
- **GDELT empty response.** GDELT occasionally returns an empty body or an HTML error page instead of JSON. The tool retries once after a 2-second pause.
- **Headline-only classification is approximate.** No NLP, no full-body fetch. A headline saying "Tema port reopens after strike" gets event_type=closure, severity=4 even though it's good news. Acceptable for a demo; flag as future work if surfacing direction (positive/negative) matters.
- **Title truncation.** `headline` is truncated to 500 chars to fit clean Postgres TEXT use; full URL retained in `url`.

## Schedule
Daily via `.github/workflows/pipeline-daily.yml` (wire up in Slice 7). GDELT updates every 15 minutes upstream, but daily polling is plenty for a demo and stays comfortably under any free-tier ceiling.
