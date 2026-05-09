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
2. Open the SQL editor and run, in order: `sql/0001_init.sql`, `sql/0002_views.sql`, `sql/0003_indexes.sql`.
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
Add repo secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, plus source API keys (`AISSTREAM_KEY`, `OPENWEATHER_KEY`, `COMTRADE_KEY`) as they come into scope.

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
.github/workflows/    Scheduled pipeline runs (hourly / daily / monthly)
deliverables/         Exports, screenshots, walkthroughs
.tmp/                 Disposable intermediate scratch
```
