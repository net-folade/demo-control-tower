# Refresh port weather

## Objective
Keep `weather_obs` populated with current conditions at Tema and Takoradi, and emit a `disruption_events` row whenever wind/precipitation/storm thresholds are breached. Drives the weather-side of `<AlertsPanel>`, the "Active disruptions" KPI tile, and the disruption badges on `<PortLocationsMap>`.

## Inputs
- Open-Meteo Forecast API current endpoint (`https://api.open-meteo.com/v1/forecast`). No auth required; 10k calls/day per IP on the free tier.
- Supabase service-role key in `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).
- Port coordinates are hardcoded in `tools/fetch_weather_ports.py`:
  - Tema: 5.6314, -0.0166
  - Takoradi: 4.8845, -1.7554

## Tool
`tools/fetch_weather_ports.py`

```bash
python tools/fetch_weather_ports.py
```

Behavior:
1. Calls Open-Meteo once per port for `temperature_2m, wind_speed_10m, precipitation, weather_code` in UTC, km/h.
2. Upserts the raw observation into `weather_obs` keyed on `(location, ts)`.
3. Maps the WMO weather code to a human-readable `conditions` string.
4. Classifies disruption via thresholds (first match wins):
   - thunderstorm code (95/96/99) → `thunderstorm`, severity 4
   - wind ≥ 70 kph → `high_wind`, severity 4
   - precipitation ≥ 30 mm → `heavy_rain`, severity 4
   - wind ≥ 50 kph → `high_wind`, severity 3
   - precipitation ≥ 15 mm → `heavy_rain`, severity 3
   - code 65 (heavy rain) or 82 (violent showers) → `heavy_rain`, severity 3
5. Upserts qualifying rows into `disruption_events` keyed on `event_key = weather:<LOCATION>:<HOUR_ISO>:<event_type>`.

## Expected outputs
- `weather_obs`: one row per (port, hour). Re-runs within the same Open-Meteo hour are no-ops.
- `disruption_events`: zero rows on calm days (the common case in Tema/Takoradi); one row per port when a threshold trips.
- `v_active_alerts` and `v_kpi_summary.active_disruptions` reflect any severity-≥3 rows from the last 7 days.

## Verification
1. `select location, count(*) from weather_obs group by 1;` — both ports present after first run.
2. `select * from weather_obs order by ts desc limit 4;` — recent rows, sensible temp/wind/precip.
3. Run the tool twice in a row — `weather_obs` row count unchanged on second run.
4. `select * from disruption_events where source='weather';` — empty unless a threshold tripped (expected most days).

## Edge cases & known issues
- **Calm days produce zero alerts.** Tema/Takoradi rarely exceed 50 kph sustained winds outside of tropical storm activity. The KPI tile carries GDELT events in the meantime; weather alerts are an exception signal, not a background hum.
- **WMO weather codes.** The mapping table is in `tools/fetch_weather_ports.py` (`WMO_CODES`). Open-Meteo occasionally publishes new codes — add them to the dict; missing codes render as "code N" which is benign.
- **Idempotency key rounds to the hour.** Open-Meteo's "current" timestamp is hour-aligned, so re-running within the same hour overwrites in place. If they ever switch to minute resolution, change the `hour_iso` in `build_rows` to keep dedup tight.

## Schedule
Daily via `.github/workflows/pipeline-daily.yml` (wire up in Slice 7). For demo purposes a single run on demand is fine; for live ops a 3-hourly cron would catch fast-moving weather without burning the free quota.
