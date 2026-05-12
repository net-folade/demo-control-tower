"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "../lib/theme";

export type PortActivityRow = {
  port_code: "TEMA" | "TAKORADI";
  year: number;
  metric: string;
  value: number;
  unit: string | null;
};

type MetricOption = {
  key: string;
  label: string;
  unit: string;
};

const METRICS: MetricOption[] = [
  { key: "vessel_calls", label: "Vessel calls", unit: "calls" },
  { key: "cargo_tonnes", label: "Cargo throughput", unit: "tonnes" },
  { key: "import_tonnes", label: "Imports", unit: "tonnes" },
  { key: "export_tonnes", label: "Exports", unit: "tonnes" },
  { key: "container_teus", label: "Container TEUs", unit: "TEUs" },
  { key: "transhipment_tonnes", label: "Transhipment", unit: "tonnes" },
  { key: "transit_tonnes", label: "Transit", unit: "tonnes" },
];

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

const DEFAULT_YEAR_MIN = 2018;

export function PortActivityChart({ rows }: { rows: PortActivityRow[] }) {
  const [metric, setMetric] = useState("vessel_calls");
  const c = useChartColors();

  const data = useMemo(() => {
    const byYear = new Map<number, { year: number; TEMA?: number; TAKORADI?: number }>();
    for (const r of rows) {
      if (r.metric !== metric) continue;
      if (r.year < DEFAULT_YEAR_MIN) continue;
      const entry = byYear.get(r.year) ?? { year: r.year };
      entry[r.port_code] = Number(r.value);
      byYear.set(r.year, entry);
    }
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  }, [rows, metric]);

  const active = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Port activity — Tema vs Takoradi
          </p>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Tema carries the container and general-cargo flow; Takoradi is the
            bulk-commodity port. Switch metric to see the split.
          </p>
          <p className="text-[10px] text-neutral-600 font-mono">
            2018–2024 · source: GPHA Annual Statistics
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => {
            const selected = m.key === metric;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`px-2 py-1 rounded text-[11px] border transition ${
                  selected
                    ? "border-emerald-500 text-emerald-300 bg-emerald-500/10"
                    : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              tick={{ fill: c.tick, fontSize: 11 }}
              stroke={c.axis}
            />
            <YAxis
              tick={{ fill: c.tick, fontSize: 11 }}
              stroke={c.axis}
              tickFormatter={(v: number) => compact.format(v)}
              width={56}
            />
            <Tooltip
              cursor={{ stroke: c.cursor }}
              contentStyle={{
                background: c.tooltipBg,
                border: `1px solid ${c.tooltipBorder}`,
                fontSize: 12,
              }}
              labelStyle={{ color: c.tooltipLabel }}
              itemStyle={{ color: c.tooltipItem }}
              formatter={(value: number) => [
                `${compact.format(value)} ${active.unit}`,
                "",
              ]}
            />
            <Line
              type="monotone"
              dataKey="TEMA"
              stroke={c.accent.emerald}
              strokeWidth={2}
              dot={{ r: 2, fill: c.accent.emerald }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="TAKORADI"
              stroke={c.accent.amber}
              strokeWidth={2}
              dot={{ r: 2, fill: c.accent.amber }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 text-[11px] text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] bg-emerald-400" /> Tema
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] bg-amber-500" /> Takoradi
        </span>
      </div>
    </section>
  );
}
