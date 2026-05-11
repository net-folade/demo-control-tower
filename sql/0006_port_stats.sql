-- 0006_port_stats.sql
-- Slice 3: annual GPHA port statistics for Tema and Takoradi (2014-2024).
-- Source: "Tema and Takoradi Port Statistics 2014-2024", GPHA, June 2025.
-- Loaded from data/gpha_port_stats_2014_2024.csv via tools/load_gpha_port_stats.py.

create table if not exists port_stats (
  id          bigserial primary key,
  port_code   text not null,                -- 'TEMA' | 'TAKORADI'
  year        int  not null,
  metric      text not null,                -- 'vessel_calls' | 'cargo_tonnes' |
                                            -- 'import_tonnes' | 'export_tonnes' |
                                            -- 'transhipment_tonnes' | 'transit_tonnes' |
                                            -- 'container_teus'
  value       numeric not null,
  unit        text,                         -- 'calls' | 'tonnes' | 'TEUs'
  unique (port_code, year, metric)
);

create index if not exists idx_port_stats_port_metric_year
  on port_stats (port_code, metric, year desc);

-- Latest year per (port_code, metric), with prior-year value, YoY %,
-- and a 10-year sparkline payload. Powers the port KPI tiles.
create or replace view v_port_stats_latest as
with ranked as (
  select
    port_code, metric, year, value, unit,
    lag(value) over (partition by port_code, metric order by year) as prior_year_value,
    row_number() over (partition by port_code, metric order by year desc) as rn
  from port_stats
),
spark as (
  select
    port_code, metric,
    jsonb_agg(jsonb_build_object('period', year, 'value', value) order by year) as sparkline_10y
  from port_stats
  group by port_code, metric
)
select
  r.port_code,
  r.metric,
  r.year,
  r.value,
  r.unit,
  r.prior_year_value,
  case
    when r.prior_year_value is not null and r.prior_year_value <> 0
      then round(((r.value - r.prior_year_value) / r.prior_year_value) * 100, 2)
    else null
  end as pct_change_yoy,
  s.sparkline_10y
from ranked r
left join spark s
  on s.port_code = r.port_code and s.metric = r.metric
where r.rn = 1;

-- Flat per-year rows for the activity chart. Frontend filters by port/metric.
create or replace view v_port_activity as
select port_code, year, metric, value, unit
from port_stats
order by metric, port_code, year;
