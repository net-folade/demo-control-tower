"use client";

import { useEffect, useMemo, useState } from "react";

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

function timeAgo(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(1, Math.round((nowMs - then) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

type Props = {
  alerts: Alert[];
  /** Reference "now" timestamp; pass from server to avoid SSR/CSR hydration drift. */
  nowMs: number;
  locationFilter?: "TEMA" | "TAKORADI" | null;
  onClearFilter?: () => void;
};

export function AlertsPanel({ alerts, nowMs, locationFilter, onClearFilter }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!locationFilter) return alerts;
    return alerts.filter((a) => a.location === locationFilter);
  }, [alerts, locationFilter]);

  const previewCount = 6;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <>
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs uppercase tracking-widest text-neutral-500">
              Active disruptions — last 7 days
            </p>
            <p className="text-[10px] text-neutral-600 font-mono">
              severity ≥ 3 · auto-classified
            </p>
          </div>
          {locationFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="text-[11px] font-mono text-rose-300 border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 rounded px-2 py-1 transition"
            >
              filtered: {locationFilter.toLowerCase()} ✕
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-xs text-neutral-500 font-mono py-6 text-center">
            {locationFilter
              ? `no alerts for ${locationFilter.toLowerCase()} in the last 7 days`
              : "no active alerts — re-run pipeline tools to refresh"}
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-800">
            {filtered.slice(0, previewCount).map((a) => (
              <AlertRow key={a.id} alert={a} nowMs={nowMs} />
            ))}
          </ul>
        )}

        {filtered.length > previewCount && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="text-xs font-mono text-emerald-300 hover:text-emerald-200 self-end transition"
          >
            view all {filtered.length} →
          </button>
        )}
      </section>

      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute right-0 top-0 h-full w-full sm:w-[460px] bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col">
            <header className="flex items-baseline justify-between px-5 py-4 border-b border-neutral-800">
              <div className="flex flex-col gap-0.5">
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  All disruptions
                </p>
                <p className="text-[10px] text-neutral-600 font-mono">
                  {filtered.length} active · last 7 days
                  {locationFilter && ` · ${locationFilter.toLowerCase()} only`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-neutral-500 hover:text-neutral-200 transition text-lg leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <ul className="flex-1 overflow-y-auto divide-y divide-neutral-800 px-5">
              {filtered.map((a) => (
                <AlertRow key={a.id} alert={a} nowMs={nowMs} />
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}

function AlertRow({ alert: a, nowMs }: { alert: Alert; nowMs: number }) {
  const style = SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES[3];
  const body = (
    <div className="flex items-start gap-3 py-2">
      <span
        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${style.dot}`}
        aria-label={style.label}
      />
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm leading-snug text-neutral-100">{a.headline}</p>
        <p className="text-[11px] text-neutral-500 font-mono">
          {a.event_type}
          {a.location && a.location !== "GHANA" && (
            <> · {a.location.toLowerCase()}</>
          )}
          {" · "}
          {SOURCE_LABEL[a.source] ?? a.source}
          {" · "}
          {timeAgo(a.ts, nowMs)}
        </p>
      </div>
    </div>
  );

  return a.url ? (
    <li>
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
    <li className="-mx-2 px-2">{body}</li>
  );
}
