-- 0001_init.sql
-- Tables for the Ghana Control Tower demo. Run this first in the Supabase SQL editor.

-- Connectivity / health-check table (Slice 0)
create table if not exists _health (
  id          int primary key,
  status      text not null,
  checked_at  timestamptz not null default now()
);

insert into _health (id, status) values (1, 'ok')
on conflict (id) do update set status = excluded.status, checked_at = now();

-- Port events: derived arrivals/departures (future: from GPHA daily bulletins)
create table if not exists port_events (
  id          bigserial primary key,
  port_code   text not null,                 -- 'TEMA' | 'TAKORADI'
  mmsi        bigint,
  event_type  text not null,                 -- 'arrival' | 'departure' | 'anchored'
  ts          timestamptz not null
);

-- Trade flows: monthly aggregates from UN Comtrade
create table if not exists trade_flows (
  id              bigserial primary key,
  period          date not null,             -- first of month
  reporter        text not null,             -- 'GHA'
  partner         text not null,             -- ISO3
  flow            text not null,             -- 'import' | 'export'
  hs_code         text not null,
  commodity_name  text,
  value_usd       numeric,
  qty             numeric,
  qty_unit        text,
  unique (period, partner, flow, hs_code)
);

-- Commodity prices: monthly from World Bank Pink Sheet
create table if not exists commodity_prices (
  id          bigserial primary key,
  commodity   text not null,                 -- 'cocoa' | 'gold' | 'crude_brent' | 'rice'
  period      date not null,
  price_usd   numeric not null,
  unit        text,
  unique (commodity, period)
);

-- Weather observations at port locations
create table if not exists weather_obs (
  id          bigserial primary key,
  location    text not null,                 -- 'TEMA' | 'TAKORADI'
  ts          timestamptz not null,
  temp_c      real,
  wind_kph    real,
  precip_mm   real,
  conditions  text
);

-- Disruption events: news, weather alerts, manual entries
create table if not exists disruption_events (
  id          bigserial primary key,
  source      text not null,                 -- 'gdelt' | 'weather' | 'manual'
  event_type  text not null,                 -- 'strike' | 'storm' | 'congestion' | 'policy'
  ts          timestamptz not null,
  location    text,
  headline    text,
  url         text,
  severity    smallint check (severity between 1 and 5)
);

-- FX rates: Bank of Ghana daily
create table if not exists fx_rates (
  id          bigserial primary key,
  pair        text not null,                 -- 'USDGHS' | 'EURGHS'
  ts          date not null,
  rate        numeric not null,
  unique (pair, ts)
);
