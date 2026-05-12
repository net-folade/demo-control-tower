import Link from "next/link";

import { DisruptionsTable, type DisruptionRow } from "@/components/DisruptionsTable";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

export default async function DisruptionsPage() {
  const client = supabase();

  const { data, error } = await client
    .from("disruption_events")
    .select("id, source, event_type, ts, location, headline, url, severity")
    .order("ts", { ascending: false })
    .limit(1000);

  const rows = (data ?? []) as DisruptionRow[];

  return (
    <main className="flex flex-1 flex-col px-6 py-12 gap-6 max-w-6xl mx-auto w-full">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-xs font-mono text-neutral-500 hover:text-neutral-300 self-start"
        >
          ← back to overview
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Disruptions</h1>
        <p className="text-neutral-400 max-w-2xl">
          News + weather signals classified by severity. Sources:{" "}
          <span className="font-mono text-neutral-300">Open-Meteo</span> for
          port-local weather thresholds,{" "}
          <span className="font-mono text-neutral-300">GDELT 2.0</span> for
          English-language news mentioning Tema, Takoradi, or Ghana port
          activity. Severity is rule-based on title keywords (strike/closure/fire
          → 4; congestion/delay/protest → 3; otherwise 2).
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-900 bg-rose-950/30 px-5 py-4">
          <p className="text-rose-300 font-mono text-sm">
            failed to load disruption_events: {error.message}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4">
          <p className="text-amber-400 font-mono text-sm">
            no disruption_events rows yet — run tools/fetch_weather_ports.py and
            tools/fetch_gdelt_disruptions.py to seed.
          </p>
        </div>
      ) : (
        <DisruptionsTable rows={rows} />
      )}
    </main>
  );
}
