 Demo Control Tower — Build Plan

 Context

 Greenfield repo; only CLAUDE.md exists. We're building a portfolio-grade demo Control Tower for West Africa / Ghana trade flows on a fixed stack (Python + pandas → Supabase → Next.js
 on Vercel) and strict free-tier budgets. The plan below is the full build blueprint: scaffold, sources, schema, tools, workflows, frontend, and a vertical-slice sequence so something
 is shippable end-to-end at every step. Defaults are chosen where reasonable; open decisions are listed at the end.

 ---
 1. Repo Scaffold

 demo-control-tower/
 ├── CLAUDE.md                     # already exists
 ├── README.md                     # quickstart + screenshots + Loom link
 ├── .gitignore                    # ignores .env, .env.local, .tmp/, node_modules, __pycache__, .next
 ├── .env.example                  # SUPABASE_URL, SUPABASE_SERVICE_KEY, AISSTREAM_KEY, OPENWEATHER_KEY, COMTRADE_KEY
 ├── requirements.txt              # pandas, requests, supabase, python-dotenv, beautifulsoup4, websockets, openpyxl
 ├── pipeline/
 │   └── main.py                   # optional orchestrator; GH Actions can also call tools directly
 ├── tools/
 │   └── db.py                     # Supabase client helpers (insert, upsert, run_sql)
 ├── workflows/                    # one markdown SOP per ingestion job
 ├── sql/
 │   ├── 0001_init.sql             # tables
 │   ├── 0002_views.sql            # views the frontend reads
 │   └── 0003_indexes.sql          # time-series indexes
 ├── app/                          # Next.js App Router project
 │   ├── package.json              # next, react, recharts, react-leaflet, @supabase/supabase-js, tailwindcss
 │   ├── tailwind.config.ts
 │   ├── .env.example              # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 │   ├── app/
 │   │   ├── layout.tsx
 │   │   ├── page.tsx              # dashboard
 │   │   ├── ports/[port_code]/page.tsx
 │   │   ├── commodities/[commodity]/page.tsx
 │   │   └── disruptions/page.tsx
 │   ├── components/               # KpiTiles, PortMap, ThroughputChart, CommodityPriceChart, TradePartnersChart, AlertsPanel
 │   └── lib/
 │       └── supabase.ts           # singleton client
 ├── .github/workflows/
 │   ├── pipeline-hourly.yml       # vessel snapshots
 │   ├── pipeline-daily.yml        # weather, GDELT, FX
 │   └── pipeline-monthly.yml      # Pink Sheet, Comtrade
 ├── deliverables/                 # CSV exports, screenshots, Loom links
 └── .tmp/                         # intermediate scrapes — gitignored

 ---
 2. Data Sources (5 to start)

 ┌────────────────────────┬────────────────────────────────────────────────────────┬───────────────────────────┬──────────────────────────┬───────────────────────────────────────┐
 │         Source         │                    What it gives us                    │     Free-tier limits      │           Auth           │                Cadence                │
 ├────────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────┼──────────────────────────┼───────────────────────────────────────┤
 │ aisstream.io           │ Live AIS vessel positions globally; subscribe by       │ Free with API key;        │ API key (free signup)    │ Hourly windowed snapshot (5-min       │
 │                        │ bounding box                                           │ WebSocket only            │                          │ capture) — runs in GH Actions         │
 ├────────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────┼──────────────────────────┼───────────────────────────────────────┤
 │ UN Comtrade API        │ Monthly trade flows: Ghana imports/exports by partner  │ 500 req/day no key, more  │ Optional                 │ Monthly                               │
 │                        │ & commodity (HS codes)                                 │ with free key             │ subscription-key header  │                                       │
 ├────────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────┼──────────────────────────┼───────────────────────────────────────┤
 │ World Bank Pink Sheet  │ Monthly commodity prices: cocoa, gold, crude oil, rice │ None — public Excel       │ None                     │ Monthly                               │
 │                        │  (Ghana-relevant)                                      │                           │                          │                                       │
 ├────────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────┼──────────────────────────┼───────────────────────────────────────┤
 │ OpenWeather Current    │ Conditions at Tema (5.62, 0.02) and Takoradi (4.88,    │ 1,000 calls/day, 60/min   │ API key (free)           │ Every 3 hours                         │
 │ Weather API            │ -1.75)                                                 │                           │                          │                                       │
 ├────────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────┼──────────────────────────┼───────────────────────────────────────┤
 │ GDELT 2.0 Events / DOC │ Near-real-time global news events; filter Ghana +      │ None — public CSV/JSON    │ None                     │ Every 6 hours                         │
 │  API                   │ port/strike/logistics keywords                         │                           │                          │                                       │
 └────────────────────────┴────────────────────────────────────────────────────────┴───────────────────────────┴──────────────────────────┴───────────────────────────────────────┘

 Notes:
 - AIS over WebSocket from a long-running process is awkward on GH Actions. The pragmatic pattern: connect, capture for 5 minutes, disconnect, write to Supabase. That fits a 6-min GH
 Actions run comfortably.
 - Pink Sheet is the easiest first ingest — small, monthly, no auth — making it the right first vertical slice.

 ---
 3. Supabase Schema

 Lean by design for the 500 MB ceiling. Time-series tables get retention windows enforced by a daily prune job.

 Tables (sql/0001_init.sql)

 vessels(
   mmsi BIGINT PRIMARY KEY,
   name TEXT, ship_type TEXT, flag TEXT,
   last_seen TIMESTAMPTZ, last_lat DOUBLE PRECISION, last_lng DOUBLE PRECISION
 )  -- ~hundreds of rows; current state only

 vessel_positions(
   id BIGSERIAL PRIMARY KEY,
   mmsi BIGINT REFERENCES vessels(mmsi),
   ts TIMESTAMPTZ NOT NULL,
   lat DOUBLE PRECISION, lng DOUBLE PRECISION,
   sog REAL, cog REAL, nav_status TEXT
 )  -- retention: 14 days; prune older

 port_events(
   id BIGSERIAL PRIMARY KEY,
   port_code TEXT,            -- 'TEMA' | 'TAKORADI'
   mmsi BIGINT,
   event_type TEXT,           -- 'arrival' | 'departure' | 'anchored'
   ts TIMESTAMPTZ
 )  -- derived from vessel_positions

 trade_flows(
   id BIGSERIAL PRIMARY KEY,
   period DATE,               -- first of month
   reporter TEXT,             -- 'GHA'
   partner TEXT,              -- ISO3
   flow TEXT,                 -- 'import' | 'export'
   hs_code TEXT,
   commodity_name TEXT,
   value_usd NUMERIC,
   qty NUMERIC, qty_unit TEXT,
   UNIQUE(period, partner, flow, hs_code)
 )

 commodity_prices(
   id BIGSERIAL PRIMARY KEY,
   commodity TEXT,            -- 'cocoa' | 'gold' | 'crude_brent' | 'rice'
   period DATE,
   price_usd NUMERIC, unit TEXT,
   UNIQUE(commodity, period)
 )

 weather_obs(
   id BIGSERIAL PRIMARY KEY,
   location TEXT,             -- 'TEMA' | 'TAKORADI'
   ts TIMESTAMPTZ,
   temp_c REAL, wind_kph REAL, precip_mm REAL, conditions TEXT
 )  -- retention: 30 days

 disruption_events(
   id BIGSERIAL PRIMARY KEY,
   source TEXT,               -- 'gdelt' | 'weather' | 'manual'
   event_type TEXT,           -- 'strike' | 'storm' | 'congestion' | 'policy'
   ts TIMESTAMPTZ,
   location TEXT,
   headline TEXT, url TEXT,
   severity SMALLINT          -- 1-5
 )

 fx_rates(
   id BIGSERIAL PRIMARY KEY,
   pair TEXT,                 -- 'USDGHS', 'EURGHS'
   ts DATE,
   rate NUMERIC,
   UNIQUE(pair, ts)
 )

 Indexes (sql/0003_indexes.sql)

 - vessel_positions(mmsi, ts DESC), vessel_positions(ts DESC)
 - port_events(port_code, ts DESC)
 - trade_flows(period DESC), trade_flows(partner, period DESC)
 - commodity_prices(commodity, period DESC)
 - disruption_events(ts DESC), weather_obs(location, ts DESC)

 Views (sql/0002_views.sql) — the frontend reads these, never raw tables when aggregation is needed

 - v_active_vessels_near_port — latest position per mmsi within Ghana bbox; powers the map. Includes ship_type, sog, cog, nav_status, derived motion ('anchored'|'underway')
 - v_port_throughput_daily(port_code, day, arrivals, departures) — daily counts
 - v_top_trade_partners_ytd(partner, total_value_usd, share_pct) — current-year totals
 - v_commodity_price_latest(commodity, period, price_usd, prior_period_price, pct_change_mom, sparkline_12m JSONB) — KPI tile inputs with trend
 - v_active_alerts — last 7 days of disruption_events with severity >= 3; includes location so the map can filter to Tema/Takoradi
 - v_kpi_summary(metric, current_value, prior_value, pct_change, sparkline JSONB) — one-row-per-KPI composite for <KpiTiles> (weekly arrivals, trade value YTD, active disruptions, top
 commodity price)

 ---
 4. Pipeline Tools (build order)

 ┌─────┬──────────────────────────────────┬────────────────────────────────────────────────────────────────────┬───────────────────────────┐
 │  #  │               Tool               │                              Purpose                               │         Writes to         │
 ├─────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────┤
 │ 1   │ tools/db.py                      │ Supabase client + upsert(table, rows, on_conflict) helper          │ —                         │
 ├─────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────┤
 │ 2   │ tools/fetch_pink_sheet.py        │ Download monthly Pink Sheet, parse cocoa/gold/Brent/rice           │ commodity_prices          │
 ├─────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────┤
 │ 3   │ tools/fetch_comtrade_monthly.py  │ Pull Ghana monthly trade by partner & HS chapter                   │ trade_flows               │
 ├─────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────┤
 │ 4   │ tools/snapshot_ais_vessels.py    │ 5-min AISStream capture over Ghana bbox                            │ vessels, vessel_positions │
 ├─────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────┤
 │ 5   │ tools/derive_port_events.py      │ Detect arrivals/departures from position deltas near port polygons │ port_events               │
 ├─────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────┤
 │ 6   │ tools/fetch_weather_ports.py     │ OpenWeather call for Tema + Takoradi                               │ weather_obs               │
 ├─────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────┤
 │ 7   │ tools/fetch_gdelt_disruptions.py │ Filter GDELT for Ghana + port/strike keywords                      │ disruption_events         │
 ├─────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────┤
 │ 8   │ tools/fetch_bog_fx.py            │ Scrape Bank of Ghana daily FX                                      │ fx_rates                  │
 ├─────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────┤
 │ 9   │ tools/prune_retention.py         │ Delete vessel_positions > 14d, weather_obs > 30d                   │ —                         │
 └─────┴──────────────────────────────────┴────────────────────────────────────────────────────────────────────┴───────────────────────────┘

 pipeline/main.py is optional; GH Actions can invoke tools directly via cron.

 ---
 5. Workflows (markdown SOPs)

 One per ingestion or maintenance job — each spells out objective, inputs, tool to call, expected outputs, and known edge cases:

 - workflows/refresh_commodity_prices.md
 - workflows/ingest_trade_flows.md
 - workflows/snapshot_ais_vessels.md
 - workflows/derive_port_events.md
 - workflows/refresh_weather.md
 - workflows/ingest_disruption_news.md
 - workflows/refresh_fx_rates.md
 - workflows/prune_retention.md

 ---
 6. Frontend (Next.js App Router)

 All routes are server components reading via the Supabase JS client (anon key, RLS read-only on the relevant tables/views). Visual style: dark theme, neutral palette, data-forward.
 Project name: gh-control-tower. Lead KPIs: port throughput, trade value, active disruptions.

 ┌──────────────────────────┬──────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────┐
 │          Route           │                              Components                              │                                     Reads                                      │
 ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
 │ / (Overview)             │ <KpiTiles>, <PortMap>, <ScenarioToggle>, <ThroughputChart>,          │ v_kpi_summary, v_active_vessels_near_port, v_port_throughput_daily,            │
 │                          │ <CommodityPriceChart>, <TradePartnersChart>, <AlertsPanel>           │ v_top_trade_partners_ytd, v_active_alerts, v_commodity_price_latest            │
 ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
 │ /ports/[port_code]       │ <VesselList>, <ThroughputChart>, <RecentEvents>                      │ vessels, port_events, v_port_throughput_daily                                  │
 ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
 │ /commodities/[commodity] │ <CommodityPriceChart> (history), <RelatedTradeFlows>                 │ commodity_prices, trade_flows                                                  │
 ├──────────────────────────┼──────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
 │ /disruptions             │ <AlertsTable> (filterable)                                           │ disruption_events                                                              │
 └──────────────────────────┴──────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────┘

 <KpiTiles> — trend-aware

 Each tile shows: current value, delta arrow (▲/▼), % change vs prior period, and a 12-point sparkline (Recharts <LineChart> minimal variant). Tiles for the hiring-portfolio lead-in:
 - Weekly port arrivals (Tema) — value, WoW Δ, 12-week sparkline
 - Trade value YTD (USD) — value, YoY Δ, monthly sparkline
 - Active disruptions — count last 7d, Δ vs prior 7d, daily sparkline
 - Top commodity (cocoa) price — value, MoM Δ, 12-month sparkline

 Backed by a single composite view v_kpi_summary(metric, current_value, prior_value, pct_change, sparkline JSONB) so the page does one query. Each metric's sparkline is a JSON array of
  {period, value} precomputed in SQL. v_commodity_price_latest gains prior_period_price, pct_change_mom, and sparkline_12m JSONB.

 <PortMap> — toggleable layers

 react-leaflet, dark OSM tile layer (CARTO dark_all). Props:
 type PortMapProps = {
   center: [number, number];     // default Tema
   vessels: VesselPosition[];    // from v_active_vessels_near_port
   disruptions: DisruptionEvent[]; // from v_active_alerts (geocoded near ports)
   layers: {
     shipType: { cargo: bool; tanker: bool; passenger: bool; fishing: bool; other: bool };
     motion: { underway: bool; anchored: bool };
     showDisruptions: bool;
   };
 };
 - Ship type layer — pins colored by vessels.ship_type; legend toggles per type
 - Motion layer — split by nav_status / sog: sog < 0.5kn → anchored (square marker), else underway (arrow marker rotated by cog). Reads v_active_vessels_near_port
 - Disruption overlay — circle markers sized by severity, colored by event_type, only shown when showDisruptions=true. Reads v_active_alerts (filtered to events with location IN
 ('TEMA','TAKORADI') or geocoded within bbox)

 A sibling <MapLayerControls> component owns the toggle UI; state is local React (no URL sync needed for v1).

 <ScenarioToggle> — the "play with it" moment

 Client component on /. Two preset scenarios:
 1. "Cocoa price shock +X%" — slider 0–50%. Recomputes Cocoa export value impact = (latest cocoa export qty × latest cocoa price × (1+shock)) using last full month from trade_flows
 (HS 1801) and commodity_prices (cocoa). Shows baseline vs scenario in a small <ScenarioImpact> panel.
 2. "Tema port closure (N days)" — slider 1–14 days. Recomputes Estimated arrivals lost = daily_avg_arrivals × N from v_port_throughput_daily, and Estimated trade value at risk =
 monthly_trade_value × (N/30) for Tema-attributed flows.

 All math runs client-side from data already fetched for the page — no new tables, no new sources, no server roundtrip. Reads existing: v_port_throughput_daily, trade_flows,
 commodity_prices.

 Component notes

 - Charts: Recharts; pre-aggregated views to keep Vercel cold starts fast
 - Tailwind dark theme (bg-neutral-950, text-neutral-100, accent on data)
 - Public demo — anon key + RLS read-only on tables/views

 ---
 7. Build Sequence — Vertical Slices

 Each slice is shippable end-to-end on Vercel with at least one new chart.

 Slice 0 — Scaffold (½ day)
 Repo skeleton, Supabase project, both .env.example files, blank Next.js app deployed to Vercel ("hello world" page reading a hardcoded row from a _health table). Proves the pipe is
 connected.

 Slice 1 — Commodity prices (easiest source first)
 fetch_pink_sheet.py → commodity_prices → v_commodity_price_latest (with prior_period_price, pct_change_mom, sparkline_12m) → <CommodityPriceChart> + first trend-aware KPI tile (cocoa
 MoM with arrow + sparkline) on /. Establishes the KPI tile pattern for later slices.

 Slice 2 — Trade flows
 fetch_comtrade_monthly.py → trade_flows → <TradePartnersChart> on / + /commodities/[commodity] drill-down. Add Trade value YTD KPI tile (YoY Δ + monthly sparkline) to v_kpi_summary.

 Slice 3 — Vessels & port map (the visual centerpiece)
 snapshot_ais_vessels.py + prune_retention.py → vessels / vessel_positions → v_active_vessels_near_port (with motion derivation) → <PortMap> with ship type and motion
 (anchored/underway) layer toggles + <MapLayerControls>. Disruption overlay stub (renders nothing yet — wired in Slice 5).

 Slice 4 — Port events & throughput
 derive_port_events.py → port_events → <ThroughputChart> + /ports/[port_code] drill-down. Add Weekly arrivals KPI tile (WoW Δ + 12-week sparkline) to v_kpi_summary — now leading the
 dashboard per hiring-portfolio framing.

 Slice 5 — Disruption signals + map overlay
 fetch_weather_ports.py + fetch_gdelt_disruptions.py → disruption_events → v_active_alerts → <AlertsPanel> + /disruptions page + activate disruption overlay layer in <PortMap>. Add
 Active disruptions KPI tile (7d count, Δ vs prior 7d) to v_kpi_summary.

 Slice 6 — Scenario toggle
 Build <ScenarioToggle> + <ScenarioImpact> on /. Cocoa price shock and Tema closure presets, all client-side math from commodity_prices, trade_flows, v_port_throughput_daily. No new
 pipeline work — pure frontend slice that turns the dashboard into a demoable interactive piece.

 Slice 7 — Polish
 FX banner via fetch_bog_fx.py, narrative copy, README with screenshots, Loom walkthrough, GH Actions schedules tightened.

 ---
 8. Verification

 End-to-end checks at each slice:
 1. Pipeline: run the new tool locally with .env; confirm rows appear in Supabase via SQL editor; rerun to confirm idempotency (upserts, not duplicates).
 2. DB: query the relevant view directly in the Supabase SQL editor; confirm row counts and shape.
 3. Frontend: npm run dev in app/; load the route; confirm the new component renders real data and handles empty/loading states.
 4. Deploy: push to main; confirm Vercel build succeeds and the public URL shows the new chart.
 5. Schedule: enable the matching GH Actions workflow; confirm one scheduled run completes green and writes new rows.
 6. Free-tier check: after Slice 3, query Supabase storage size; if vessel_positions is trending hot, tighten retention or sample frequency.

 ---
 9. Decisions (locked in)

 1. AIS provider — aisstream.io
 2. Commodities — cocoa, gold, Brent crude, rice
 3. Ports — Tema first, Takoradi second
 4. Vessel position retention — 14 days
 5. Frontend auth — fully public demo (anon key + RLS)
 6. Ownership — personal account, project name gh-control-tower
 7. Visual style — dark theme, neutral palette, data-forward
 8. Audience — hiring portfolio / pitch piece; KPIs lead with throughput, trade value, active disruptions