# Ghana Control Tower

A demo Control Tower for West Africa / Ghana trade flows — a centralized dashboard that gives end-to-end visibility into trade and logistics activity: vessel movements at Ghanaian ports, import/export flows, commodity prices, and disruption signals (weather, news, congestion).

Portfolio-grade prototype built entirely on **publicly available data** and **free-tier services**.

**Live demo:** _(Vercel URL — pending)_

---

## Stack

- **Pipeline**: Python + pandas, scheduled via GitHub Actions
- **Storage**: Supabase (Postgres, free tier)
- **Frontend**: Next.js (App Router) + React + Tailwind, deployed on Vercel
- **Charts**: Recharts · **Maps**: react-leaflet

---

## Setup

### 1. Supabase
1. Create a project at [app.supabase.com](https://app.supabase.com) named `gh-control-tower`.
2. Open the SQL editor and run, in order: `sql/0001_init.sql`, `sql/0002_views.sql`, `sql/0003_indexes.sql`, `sql/0004_trade_flow_views.sql`, `sql/0005_drop_vessels.sql`, `sql/0006_port_stats.sql`, `sql/0007_disruption_keys.sql`.
3. From **Settings → API**, copy the project URL, the `anon` public key, and the `service_role` key.

### 2. Local environment
```bash
# Python pipeline
cp .env.example .env
# edit .env with SUPABASE_URL, SUPABASE_SERVICE_KEY, and source API keys
pip install -r requirements.txt

# Frontend
cd app
cp .env.example .env.local
# edit .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 3. Vercel
1. Connect this GitHub repo to Vercel; set the project root to `app/`.
2. Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 4. GitHub Actions
Add repo secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Comtrade is optional (free without a key); Open-Meteo and GDELT require no auth.

---

## Architecture (WAT)

This project follows a **Workflows → Agents → Tools** separation:

- `workflows/` — markdown SOPs describing each ingestion or refresh job
- `tools/` — Python scripts that do the deterministic execution (API calls, parsing, writes to Supabase)
- `app/` — the Next.js frontend reading exclusively from Supabase

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture brief and [`PLAN.md`](./PLAN.md) for the build plan and slice sequence.

---

## Repo layout

```
app/                  Next.js App Router project (frontend)
tools/                Python ingestion / transformation scripts
pipeline/             Optional orchestration glue
workflows/            Markdown SOPs (one per ingestion job)
sql/                  Supabase migrations and views
data/                 Hand-curated source data (e.g. GPHA stats CSV)
.github/workflows/    Scheduled pipeline runs (hourly / daily / monthly)
deliverables/         Exports, screenshots, walkthroughs
.tmp/                 Disposable intermediate scratch
```

---

## Constraints

Real-world limits shaped the build. Documenting them is part of the demo.

- **No live AIS coverage for Ghana on free tiers.** PLAN.md originally specified `aisstream.io` for live vessel positions in the Ghana coastal bbox. Verification showed AISStream's terrestrial-AIS network has effectively zero coverage of West African waters — a 30-second probe over the entire West African Atlantic yielded 2 messages, vs. 170 over the English Channel in the same window. AISStream and its peers depend on volunteer terrestrial receivers, and there are almost none in the region. Satellite-AIS would solve this but is paid only (Spire, Orbcomm, etc.). **Pivot:** Slice 3 dropped the live vessel map and replaced it with annual port statistics published by the Ghana Ports & Harbours Authority (GPHA). See Recommendations below for the future-work item.
- **Ghana stopped reporting to UN Comtrade after December 2023.** The trade-flows slice surfaces real partner totals, but the latest available period anywhere on the dashboard is Dec 2023. Charts and tiles label this gap explicitly.
- **GPHA publishes annually, not monthly.** Public GPHA bulletins are once-yearly (the 2014–2024 report dropped in June 2025). Anything time-sensitive in the original plan that needed monthly cadence (e.g. weekly arrivals KPI, MoM throughput) was either dropped or adjusted to annual + YoY trend. Monthly bulletins exist internally at GPHA but are not publicly posted.
- **Supabase free tier: 500 MB / 5 GB egress.** Volume-heavy time series (vessel pings) would have blown this; the pivot to annual stats removes the risk entirely.
- **GitHub Actions free tier: 2,000 min/mo** (public repos: unlimited). Pipelines are scheduled on the coarsest cadence that still makes sense per source (monthly for GPHA + Pink Sheet + Comtrade, daily for Open-Meteo weather + GDELT news).
- **OpenWeather killed its free signup; pivoted to Open-Meteo.** PLAN.md originally specified OpenWeather's Current Weather Data API for port-local conditions. As of May 2026, OpenWeather requires a credit card on file even for free-tier signup, which would have created a real-money dependency in a portfolio demo. Swapped to **Open-Meteo** (no key, no signup, 10k calls/day per IP). Field set is equivalent (`temperature_2m`, `wind_speed_10m`, `precipitation`, WMO `weather_code`); Tema/Takoradi remain at the same coordinates. Documented in `workflows/refresh_weather.md`.
- **GDELT signal for Ghana ports is sparse.** GDELT 2.0 returns ~50 English-language articles per 30-day window for Tema/Takoradi/Ghana-ports queries, of which only ~10–15% breach the "elevated severity" threshold once classified by title keywords. The dashboard reflects that honestly — the `Active disruptions (7d)` tile is often single-digit. Broadening the query risks false positives (the phrase "Tema" also matches "Tema, Mali"); the demo prefers correctness over fullness.
- **Free Vercel cold starts.** Heavy server-side compute is offloaded to the pipeline; the app reads pre-aggregated views from Supabase.

---

## Recommendations / future work

Things a maintainer (or a hiring manager reading this) should see as natural next steps if this were a real product, not a portfolio piece.

- **Replace GPHA annual stats with monthly bulletins.** GPHA's internal monthly performance reports exist; sourcing them (FOI request, partnership, or scraped from operational dashboards) would restore monthly granularity to the port KPIs and re-enable the original "Weekly arrivals (Tema)" hero metric.
- **Add satellite-AIS for live Ghana vessel coverage.** Spire Maritime, Orbcomm, or MarineTraffic's paid tier would unblock the live `<PortMap>` originally specified in PLAN.md (`vessels` + `vessel_positions` tables were dropped in `sql/0005_drop_vessels.sql` but the schema is easy to reintroduce). The `websockets` Python dep is kept in `requirements.txt` as a hint for whoever picks this up.
- **Resolve the GPHA 2022–2023 transhipment/transit duplication.** The source PDF lists identical values across both metrics for Tema and Takoradi in those two years — almost certainly a copy-paste error in the source. Flag noted in `workflows/load_gpha_port_stats.md`; a follow-up should reconcile against an alternative source if one becomes available.
- **Backfill Ghana trade flows post-Dec 2023** by complementing UN Comtrade with the Ghana Statistical Service or Ghana Revenue Authority (Customs) once those publish, so the dashboard isn't bounded by Ghana's Comtrade reporting cadence.
- **Cache layer in front of Supabase.** As the dashboard grows, swap raw view reads for an edge-cached API route (Vercel Edge + ISR) so anonymous viewers don't hammer the DB.
- **RLS hardening.** Current setup is read-only public via `anon` key; before connecting any user-write surfaces, lock down row-level security per table.
- **Authenticated mode + scenario persistence.** The Slice 6 scenario toggle is client-side only. A logged-in mode could persist scenarios as named views to share with stakeholders.
- **Smarter disruption classification.** Title-keyword severity scoring is a baseline — a future pass could use the article body, sentiment, GDELT GKG themes, or a small LLM classifier to distinguish "Tema port reopens after strike" (good news) from "Tema port shut by strike" (bad news), since both currently land at severity 4 / event_type=closure.
