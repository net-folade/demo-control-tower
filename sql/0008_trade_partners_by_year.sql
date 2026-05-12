-- 0008_trade_partners_by_year.sql
-- Slice 7: annual partner totals to back the "Data as of [year]" filter on
-- TradePartnersChart. The existing v_top_trade_partners_ytd is fixed to the
-- last-12-months window ending at max(period); this view lets the UI pivot
-- across all reporting years (Comtrade Ghana: 2014–2023).

create or replace view v_top_trade_partners_by_year as
with totals as (
  select
    extract(year from period)::int as year,
    partner,
    sum(value_usd) as total_value_usd
  from trade_flows
  where hs_code = 'TOTAL'
  group by 1, 2
),
grand as (
  select year, sum(total_value_usd) as gt from totals group by year
)
select
  t.year,
  t.partner,
  t.total_value_usd,
  case when g.gt > 0
       then round((t.total_value_usd / g.gt) * 100, 2)
       else 0
  end as share_pct
from totals t
join grand g using (year)
order by t.year desc, t.total_value_usd desc;
