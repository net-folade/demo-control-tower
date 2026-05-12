import { DisruptionsTable, type DisruptionRow } from "@/components/DisruptionsTable";
import { EmptyState } from "@/components/EmptyState";
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
    <main className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 pt-2">
        <h1 className="text-3xl font-semibold tracking-tight">Disruptions</h1>
        <p className="text-neutral-400 max-w-2xl leading-relaxed">
          News + weather signals classified by severity. Sources:{" "}
          <span className="font-mono text-neutral-300">Open-Meteo</span> for
          port-local weather thresholds,{" "}
          <span className="font-mono text-neutral-300">GDELT 2.0</span> for
          news mentioning Tema, Takoradi, or Ghana port
          activity. 
          Severity is rule-based on title keywords (strike / closure /
          fire → 4; congestion / delay / protest → 3; otherwise 2).
        </p>
      </header>

      {error ? (
        <EmptyState
          title="Disruptions"
          message="Failed to load disruption_events."
          error={error.message}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Disruptions"
          message="No disruption_events rows yet."
          hint="run tools/fetch_weather_ports.py and tools/fetch_gdelt_disruptions.py to seed."
        />
      ) : (
        <DisruptionsTable rows={rows} />
      )}
    </main>
  );
}
