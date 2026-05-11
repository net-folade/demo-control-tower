-- 0003_indexes.sql
-- Indexes for time-series and lookup queries. Run after 0001 and 0002.

create index if not exists idx_port_events_port_ts
  on port_events (port_code, ts desc);

create index if not exists idx_trade_flows_period
  on trade_flows (period desc);

create index if not exists idx_trade_flows_partner_period
  on trade_flows (partner, period desc);

create index if not exists idx_commodity_prices_commodity_period
  on commodity_prices (commodity, period desc);

create index if not exists idx_disruption_events_ts
  on disruption_events (ts desc);

create index if not exists idx_disruption_events_severity_ts
  on disruption_events (severity, ts desc);

create index if not exists idx_weather_obs_location_ts
  on weather_obs (location, ts desc);
