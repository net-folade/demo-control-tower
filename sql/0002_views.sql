-- 0002_views.sql
-- Views the frontend reads. Run after 0001_init.sql.
-- Frontend should always read from views (or simple tables), never join across tables in the UI.

-- Daily port throughput from derived port_events.
create or replace view v_port_throughput_daily as
select
  port_code,
  date_trunc('day', ts)::date as day,
  count(*) filter (where event_type = 'arrival')   as arrivals,
  count(*) filter (where event_type = 'departure') as departures
from port_events
group by port_code, date_trunc('day', ts)::date;

-- Top trade partners year-to-date by total value.
create or replace view v_top_trade_partners_ytd as
with totals as (
  select
    partner,
    sum(value_usd) as total_value_usd
  from trade_flows
  where period >= date_trunc('year', current_date)
  group by partner
),
overall as (
  select sum(total_value_usd) as grand_total from totals
)
select
  t.partner,
  t.total_value_usd,
  case when o.grand_total > 0
       then round((t.total_value_usd / o.grand_total) * 100, 2)
       else 0
  end as share_pct
from totals t cross join overall o
order by t.total_value_usd desc;

-- Latest commodity price with prior period and 12-month sparkline payload.
create or replace view v_commodity_price_latest as
with ranked as (
  select
    commodity,
    period,
    price_usd,
    unit,
    lag(price_usd) over (partition by commodity order by period) as prior_period_price,
    row_number() over (partition by commodity order by period desc) as rn
  from commodity_prices
),
spark as (
  select
    commodity,
    jsonb_agg(
      jsonb_build_object('period', period, 'value', price_usd)
      order by period
    ) as sparkline_12m
  from (
    select
      commodity, period, price_usd,
      row_number() over (partition by commodity order by period desc) as rn
    from commodity_prices
  ) s
  where rn <= 12
  group by commodity
)
select
  r.commodity,
  r.period,
  r.price_usd,
  r.unit,
  r.prior_period_price,
  case when r.prior_period_price is not null and r.prior_period_price <> 0
       then round(((r.price_usd - r.prior_period_price) / r.prior_period_price) * 100, 2)
       else null
  end as pct_change_mom,
  s.sparkline_12m
from ranked r
left join spark s on s.commodity = r.commodity
where r.rn = 1;

-- Active disruptions: last 7 days, severity >= 3.
create or replace view v_active_alerts as
select
  id, source, event_type, ts, location, headline, url, severity
from disruption_events
where ts > now() - interval '7 days'
  and severity >= 3
order by ts desc;

-- KPI summary: one row per metric, with current/prior/pct_change/sparkline.
-- Powers <KpiTiles> in a single query.
create or replace view v_kpi_summary as
-- 1) Weekly arrivals at Tema (current week vs prior week, 12-week sparkline)
with weekly_arrivals as (
  select
    date_trunc('week', ts)::date as week_start,
    count(*) as arrivals
  from port_events
  where port_code = 'TEMA' and event_type = 'arrival'
  group by 1
),
weekly_arrivals_metric as (
  select
    'weekly_arrivals_tema'::text as metric,
    coalesce((select arrivals from weekly_arrivals where week_start = date_trunc('week', current_date)::date), 0)::numeric as current_value,
    coalesce((select arrivals from weekly_arrivals where week_start = (date_trunc('week', current_date) - interval '1 week')::date), 0)::numeric as prior_value,
    (select jsonb_agg(jsonb_build_object('period', week_start, 'value', arrivals) order by week_start)
     from (select * from weekly_arrivals order by week_start desc limit 12) w) as sparkline
),
-- 2) Trade value YTD vs prior YTD, monthly sparkline (last 12 months)
trade_ytd as (
  select
    'trade_value_ytd'::text as metric,
    coalesce((select sum(value_usd) from trade_flows
              where period >= date_trunc('year', current_date)), 0)::numeric as current_value,
    coalesce((select sum(value_usd) from trade_flows
              where period >= date_trunc('year', current_date - interval '1 year')
                and period <  date_trunc('year', current_date)), 0)::numeric as prior_value,
    (select jsonb_agg(jsonb_build_object('period', period, 'value', total) order by period)
     from (
       select date_trunc('month', period)::date as period, sum(value_usd) as total
       from trade_flows
       where period >= (date_trunc('month', current_date) - interval '11 months')
       group by 1
     ) m) as sparkline
),
-- 3) Active disruptions: last 7 days vs prior 7 days, daily sparkline
disruptions_metric as (
  select
    'active_disruptions'::text as metric,
    (select count(*) from disruption_events
     where ts > now() - interval '7 days' and severity >= 3)::numeric as current_value,
    (select count(*) from disruption_events
     where ts > now() - interval '14 days' and ts <= now() - interval '7 days'
       and severity >= 3)::numeric as prior_value,
    (select jsonb_agg(jsonb_build_object('period', day, 'value', cnt) order by day)
     from (
       select date_trunc('day', ts)::date as day, count(*) as cnt
       from disruption_events
       where ts > now() - interval '14 days' and severity >= 3
       group by 1
     ) d) as sparkline
),
-- 4) Top commodity price: cocoa, current vs prior month, 12-month sparkline
cocoa_metric as (
  select
    'cocoa_price'::text as metric,
    coalesce((select price_usd from v_commodity_price_latest where commodity = 'cocoa'), 0)::numeric as current_value,
    coalesce((select prior_period_price from v_commodity_price_latest where commodity = 'cocoa'), 0)::numeric as prior_value,
    (select sparkline_12m from v_commodity_price_latest where commodity = 'cocoa') as sparkline
)
select
  metric,
  current_value,
  prior_value,
  case when prior_value is not null and prior_value <> 0
       then round(((current_value - prior_value) / prior_value) * 100, 2)
       else null
  end as pct_change,
  sparkline
from (
  select metric, current_value, prior_value, sparkline from weekly_arrivals_metric
  union all
  select metric, current_value, prior_value, sparkline from trade_ytd
  union all
  select metric, current_value, prior_value, sparkline from disruptions_metric
  union all
  select metric, current_value, prior_value, sparkline from cocoa_metric
) u;
