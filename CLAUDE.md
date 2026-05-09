# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This repo builds a **demo Control Tower for West Africa / Ghana trade flows** — a centralized dashboard that gives end-to-end visibility into trade and logistics activity (vessel movements at Ghanaian ports, import/export flows, commodity prices, border activity, disruption signals like weather/strikes/congestion).

It's a portfolio-grade prototype built entirely on **publicly available data** and **free-tier services**. The goal is to demonstrate the concept end-to-end: ingestion → storage → analytics → visualization → narrative.

## Tech Stack (Fixed)

- **Data pipeline & processing**: Python with `pandas` as the standard. Use `requests` for APIs, `beautifulsoup4`/`playwright` for scraping where needed.
- **Storage**: Supabase (free tier, Postgres). All processed/canonical data lives here. Use the `supabase-py` client or direct Postgres connections via `psycopg2`/`SQLAlchemy`.
- **Frontend**: Next.js + React (App Router). Charts via Recharts, maps via Deck.gl or react-leaflet, styling via Tailwind.
- **Hosting**: Vercel free tier for the Next.js app. Supabase free tier for DB. GitHub Actions free tier for scheduled pipeline runs.

Do not introduce alternative stacks (e.g. Streamlit, DuckDB, Snowflake) without checking with me first.

## Running Tools

```bash
# Python pipeline (root or /pipeline)
pip install -r requirements.txt
python tools/<script_name>.py

# Next.js app (/app or /web)
npm install
npm run dev

# Env vars
# Python tools read from .env in repo root
# Next.js reads from .env.local in the app directory
```

Both `.env` and `.env.local` are gitignored. Supabase keys, API keys, and any service credentials live there — never inline.

---

# Agent Instructions

You're working inside the **WAT framework** (Workflows, Agents, Tools). This architecture separates concerns so that probabilistic AI handles reasoning while deterministic code handles execution. That separation is what makes this system reliable.

## The WAT Architecture

**Layer 1: Workflows (The Instructions)**
- Markdown SOPs stored in `workflows/`
- Each workflow defines the objective, required inputs, which tools to use, expected outputs, and how to handle edge cases
- Written in plain language, the same way you'd brief someone on your team
- Examples for this project: `workflows/ingest_ais_vessel_data.md`, `workflows/scrape_gpha_port_stats.md`, `workflows/refresh_commodity_prices.md`, `workflows/build_disruption_alerts.md`

**Layer 2: Agents (The Decision-Maker)**
- This is your role. You're responsible for intelligent coordination.
- Read the relevant workflow, run tools in the correct sequence, handle failures gracefully, and ask clarifying questions when needed
- You connect intent to execution without trying to do everything yourself
- Example: If you need to pull vessel data near Tema port, don't attempt it directly. Read `workflows/ingest_ais_vessel_data.md`, figure out the required inputs, then execute `tools/fetch_ais_vessels.py`

**Layer 3: Tools (The Execution)**
- Python scripts in `tools/` that do the actual work: API calls, scraping, pandas transformations, writes to Supabase
- Next.js route handlers and server components in `app/` that read from Supabase and render the UI
- Credentials and API keys are stored in `.env` (Python) or `.env.local` (Next.js)
- These scripts/routes are consistent, testable, and fast

**Why this matters:** When AI tries to handle every step directly, accuracy drops fast. If each step is 90% accurate, you're down to 59% success after just five steps. By offloading execution to deterministic scripts, you stay focused on orchestration and decision-making where you excel.

## How to Operate

**1. Look for existing tools first**
Before building anything new, check `tools/` based on what your workflow requires. Only create new scripts when nothing exists for that task.

**2. Respect the data contract with Supabase**
Every pipeline tool should write to a clearly-named Postgres table with a stable schema. The Next.js app reads from these tables (or from views built on top of them). Never have the frontend hit external APIs directly — all external data flows through the Python pipeline into Supabase first. This keeps the UI fast, deterministic, and free-tier-friendly.

**3. Stay within free tiers**
- Supabase free tier: 500MB DB, 5GB bandwidth/month. Be deliberate about row volume — aggregate or window data where possible, don't store every AIS ping forever.
- Vercel free tier: avoid heavy server-side compute on every request. Pre-compute in the pipeline, serve from Supabase.
- GitHub Actions free tier: 2,000 minutes/month for private repos. Schedule pipelines thoughtfully (e.g. hourly for vessels, daily for prices, not every minute).
- If a workflow risks pushing past a free tier, flag it before running.

**4. Learn and adapt when things fail**
When you hit an error:
- Read the full error message and trace
- Fix the script and retest (if it uses paid API calls or rate-limited credits, check with me before re-running)
- Document what you learned in the workflow (rate limits, timing quirks, unexpected schema changes from a source)
- Example: You get rate-limited on an AIS API, so you dig into the docs, discover a bounding-box batch endpoint, refactor the tool to use it, verify it works, then update the workflow so this never happens again

**5. Keep workflows current**
Workflows should evolve as you learn. When you find better methods, discover constraints, or encounter recurring issues, update the workflow. That said, don't create or overwrite workflows without asking unless I explicitly tell you to. These are your instructions and need to be preserved and refined, not tossed after one use.

## The Self-Improvement Loop

Every failure is a chance to make the system stronger:
1. Identify what broke
2. Fix the tool
3. Verify the fix works
4. Update the workflow with the new approach
5. Move on with a more robust system

This loop is how the framework improves over time.

## File Structure

**What goes where:**
- **Canonical data**: Lives in Supabase. This is the single source of truth for the dashboard.
- **Deliverables**: The Next.js app deployed on Vercel is the primary deliverable. Any supporting exports (CSVs for sharing, screenshots, Loom walkthroughs) go in `deliverables/` or are linked from the README.
- **Intermediates**: Temporary processing files that can be regenerated.

**Directory layout:**
```
app/ or web/          # Next.js App Router project (frontend)
  app/                # Routes, layouts, server components
  components/         # React components (charts, maps, KPI tiles, alert panel)
  lib/                # Supabase client, data fetching helpers
  .env.local          # Frontend env vars (Supabase URL, anon key)

tools/                # Python scripts for ingestion, transformation, loading
pipeline/             # Optional: orchestration glue (e.g. main.py that runs tools in order)
workflows/            # Markdown SOPs defining what to do and how
sql/                  # Supabase migrations, table definitions, views
.tmp/                 # Temporary files (raw scrapes, intermediate parquet/csv). Disposable.
.env                  # Python env vars (Supabase service key, source API keys)
requirements.txt      # Python deps
```

**Core principle:** Local files in `.tmp/` are just for processing. The dashboard reads exclusively from Supabase. The Next.js app on Vercel is what I (and anyone I'm demoing to) actually see and interact with.

## Domain Notes: West Africa / Ghana Trade Flows

Useful public data sources to consider when building workflows (verify availability and ToS before scraping):
- **Vessel/port activity**: AIS data via AISHub, MarineTraffic (limited free), or aisstream.io for live streams. Ghana Ports & Harbours Authority (GPHA) publishes some operational stats.
- **Trade flows**: UN Comtrade API (free tier), World Bank WITS, ECOWAS trade portals.
- **Commodities**: World Bank Pink Sheet (cocoa, gold, oil are big for Ghana), FRED, Yahoo Finance.
- **Disruption signals**: NOAA/OpenWeather for weather, GDELT for news-based event detection, USGS for seismic.
- **Macro context**: Bank of Ghana exchange rates, Ghana Statistical Service.

When in doubt about a source's licensing or rate limits, surface it to me before building a tool around it.

## Bottom Line

You sit between what I want (workflows) and what actually gets done (tools + Next.js app). Your job is to read instructions, make smart decisions, call the right tools, write clean data into Supabase, surface it through a polished Next.js UI, recover from errors, and keep improving the system as you go.

Stay pragmatic. Stay reliable. Keep learning.
