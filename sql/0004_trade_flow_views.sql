-- 0004_trade_flow_views.sql
-- Slice 2: trade flows from UN Comtrade.
--
-- The trade_flows table now holds two kinds of rows:
--   1. cmdCode='TOTAL' — all-commodity totals per partner (drives partner aggregates).
--   2. specific HS codes (1801, 7108, 2709, 1006) with partner='W00' (World) —
--      drive the per-commodity drill-down.
--
-- Without filtering, summing value_usd would double-count chapter rows on top of
-- TOTAL rows. Both partner-aggregate views below filter to hs_code='TOTAL'.
--
-- Window semantics: Ghana stopped reporting to Comtrade after 2023-12. To keep
-- the dashboard populated, both views use a "trailing 12 months ending at the
-- latest available period in the data" window instead of literal YTD from
-- current_date. View names are kept (`_ytd`, `trade_value_ytd`) to avoid churn
-- in callers; UI labels say "last 12 mo" with a data-window footnote.

create or replace view v_top_trade_partners_ytd as
with latest as (
  select max(period) as max_period
  from trade_flows
  where hs_code = 'TOTAL'
),
totals as (
  select
    tf.partner,
    sum(tf.value_usd) as total_value_usd
  from trade_flows tf, latest l
  where tf.hs_code = 'TOTAL'
    and tf.period >  (l.max_period - interval '12 months')
    and tf.period <= l.max_period
  group by tf.partner
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

-- Re-create v_kpi_summary with hs_code='TOTAL' filter on the trade_ytd CTE.
create or replace view v_kpi_summary as
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
trade_12m as (
  -- Trailing 12 months ending at the latest available period in trade_flows.
  -- Comparison window is the 12 months prior to that.
  select
    'trade_value_ytd'::text as metric,  -- kept for callers; semantics = last 12 mo
    coalesce((
      select sum(tf.value_usd)
      from trade_flows tf,
        (select max(period) as p from trade_flows where hs_code = 'TOTAL') l
      where tf.hs_code = 'TOTAL'
        and tf.period >  (l.p - interval '12 months')
        and tf.period <= l.p
    ), 0)::numeric as current_value,
    coalesce((
      select sum(tf.value_usd)
      from trade_flows tf,
        (select max(period) as p from trade_flows where hs_code = 'TOTAL') l
      where tf.hs_code = 'TOTAL'
        and tf.period >  (l.p - interval '24 months')
        and tf.period <= (l.p - interval '12 months')
    ), 0)::numeric as prior_value,
    (select jsonb_agg(jsonb_build_object('period', period, 'value', total) order by period)
     from (
       select date_trunc('month', tf.period)::date as period, sum(tf.value_usd) as total
       from trade_flows tf,
         (select max(period) as p from trade_flows where hs_code = 'TOTAL') l
       where tf.hs_code = 'TOTAL'
         and tf.period >  (l.p - interval '12 months')
         and tf.period <= l.p
       group by 1
     ) m) as sparkline
),
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
  select metric, current_value, prior_value, sparkline from trade_12m
  union all
  select metric, current_value, prior_value, sparkline from disruptions_metric
  union all
  select metric, current_value, prior_value, sparkline from cocoa_metric
) u;
