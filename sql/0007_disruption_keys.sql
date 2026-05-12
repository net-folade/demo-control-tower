-- 0007_disruption_keys.sql
-- Slice 5: idempotency for disruption_events.
--
-- Both ingestion tools (fetch_weather_ports, fetch_gdelt_disruptions) compute
-- a deterministic `event_key` per row so re-runs upsert in place instead of
-- duplicating. Format:
--   weather: 'weather:<LOCATION>:<ISO8601_HOUR>:<event_type>'
--   gdelt:   'gdelt:<url>'

alter table disruption_events
  add column if not exists event_key text;

create unique index if not exists ux_disruption_events_event_key
  on disruption_events (event_key);

create index if not exists idx_disruption_events_ts_severity
  on disruption_events (ts desc, severity desc);

-- weather_obs needs a unique key so the hourly poll is idempotent.
create unique index if not exists ux_weather_obs_location_ts
  on weather_obs (location, ts);
