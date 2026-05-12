"use client";

import { useMemo, useState } from "react";

export type DisruptionRow = {
  id: number;
  source: string;
  event_type: string;
  ts: string;
  location: string | null;
  headline: string;
  url: string | null;
  severity: number;
};

const SEVERITY_DOT: Record<number, string> = {
  2: "bg-neutral-500",
  3: "bg-amber-400",
  4: "bg-rose-400",
  5: "bg-rose-500",
};

const SOURCE_LABEL: Record<string, string> = {
  weather: "Open-Meteo",
  gdelt: "GDELT",
  manual: "manual",
};

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values)).sort();
}

export function DisruptionsTable({ rows }: { rows: DisruptionRow[] }) {
  const [source, setSource] = useState<string>("all");
  const [eventType, setEventType] = useState<string>("all");
  const [minSeverity, setMinSeverity] = useState<number>(2);
  const [search, setSearch] = useState<string>("");

  const sources = useMemo(() => unique(rows.map((r) => r.source)), [rows]);
  const eventTypes = useMemo(() => unique(rows.map((r) => r.event_type)), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (source !== "all" && r.source !== source) return false;
      if (eventType !== "all" && r.event_type !== eventType) return false;
      if (r.severity < minSeverity) return false;
      if (q && !r.headline.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, source, eventType, minSeverity, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center text-xs font-mono">
        <Select label="source" value={source} onChange={setSource}>
          <option value="all">all</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s] ?? s}
            </option>
          ))}
        </Select>
        <Select label="event_type" value={eventType} onChange={setEventType}>
          <option value="all">all</option>
          {eventTypes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          label="min severity"
          value={String(minSeverity)}
          onChange={(v) => setMinSeverity(Number(v))}
        >
          <option value="2">≥ 2 (all)</option>
          <option value="3">≥ 3 (elevated)</option>
          <option value="4">≥ 4 (severe)</option>
        </Select>
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="headline contains…"
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-100 w-48"
          />
        </label>
        <span className="ml-auto text-neutral-500">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/60 text-[11px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="text-left px-3 py-2 w-12">sev</th>
              <th className="text-left px-3 py-2 w-40">when</th>
              <th className="text-left px-3 py-2 w-28">source</th>
              <th className="text-left px-3 py-2 w-28">location</th>
              <th className="text-left px-3 py-2 w-28">type</th>
              <th className="text-left px-3 py-2">headline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500 font-mono">
                  no rows match current filters
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-900/50">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[r.severity] ?? SEVERITY_DOT[2]}`}
                    />
                    <span className="ml-2 text-neutral-500 font-mono text-xs">
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-400 font-mono text-xs">
                    {new Date(r.ts).toISOString().replace("T", " ").slice(0, 16)}
                  </td>
                  <td className="px-3 py-2 text-neutral-300 font-mono text-xs">
                    {SOURCE_LABEL[r.source] ?? r.source}
                  </td>
                  <td className="px-3 py-2 text-neutral-300 font-mono text-xs">
                    {r.location ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-neutral-300 font-mono text-xs">
                    {r.event_type}
                  </td>
                  <td className="px-3 py-2 text-neutral-100">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:text-emerald-300"
                      >
                        {r.headline}
                      </a>
                    ) : (
                      r.headline
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-100"
      >
        {children}
      </select>
    </label>
  );
}
