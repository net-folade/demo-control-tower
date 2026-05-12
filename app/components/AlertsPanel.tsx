type Alert = {
  id: number;
  source: string;
  event_type: string;
  ts: string;
  location: string | null;
  headline: string;
  url: string | null;
  severity: number;
};

const SEVERITY_STYLES: Record<number, { dot: string; label: string }> = {
  3: { dot: "bg-amber-400", label: "elevated" },
  4: { dot: "bg-rose-400", label: "severe" },
  5: { dot: "bg-rose-500", label: "critical" },
};

const SOURCE_LABEL: Record<string, string> = {
  weather: "Open-Meteo",
  gdelt: "GDELT",
  manual: "manual",
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.max(1, Math.round((now - then) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Active disruptions — last 7 days
        </p>
        <p className="text-[10px] text-neutral-600 font-mono">
          severity ≥ 3 · auto-classified
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="text-xs text-neutral-500 font-mono py-6 text-center">
          no active alerts — re-run pipeline tools to refresh
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-800">
          {alerts.slice(0, 8).map((a) => {
            const style = SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES[3];
            const body = (
              <div className="flex items-start gap-3 py-2">
                <span
                  className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${style.dot}`}
                  aria-label={style.label}
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm leading-snug text-neutral-100 truncate">
                    {a.headline}
                  </p>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    {a.event_type}
                    {a.location && a.location !== "GHANA" && (
                      <> · {a.location.toLowerCase()}</>
                    )}
                    {" · "}
                    {SOURCE_LABEL[a.source] ?? a.source}
                    {" · "}
                    {timeAgo(a.ts)}
                  </p>
                </div>
              </div>
            );

            return a.url ? (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block hover:bg-neutral-900/70 transition-colors -mx-2 px-2 rounded"
                >
                  {body}
                </a>
              </li>
            ) : (
              <li key={a.id} className="-mx-2 px-2">
                {body}
              </li>
            );
          })}
        </ul>
      )}

      {alerts.length > 8 && (
        <a
          href="/disruptions"
          className="text-xs font-mono text-neutral-400 hover:text-neutral-200 self-end"
        >
          view all {alerts.length} alerts →
        </a>
      )}
    </section>
  );
}
