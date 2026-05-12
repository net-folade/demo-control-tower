"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "../lib/theme";

type Row = {
  period: string;
  flow: "import" | "export";
  value_usd: number;
};

type Props = {
  data: Row[];
  title?: string;
};

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function TradeValueChart({ data, title = "Trade value" }: Props) {
  const c = useChartColors();
  const byPeriod = new Map<string, { period: string; import: number; export: number }>();
  for (const r of data) {
    const key = r.period;
    const existing = byPeriod.get(key) ?? { period: key, import: 0, export: 0 };
    existing[r.flow] = Number(r.value_usd);
    byPeriod.set(key, existing);
  }
  const series = Array.from(byPeriod.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((d) => ({
      ...d,
      label: new Date(d.period).toLocaleDateString(undefined, {
        year: "2-digit",
        month: "short",
      }),
    }));

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-neutral-500">{title}</p>
        <p className="text-xs text-neutral-500 font-mono">USD / month</p>
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: c.tick, fontSize: 11 }}
              stroke={c.axis}
              minTickGap={32}
            />
            <YAxis
              tick={{ fill: c.tick, fontSize: 11 }}
              stroke={c.axis}
              width={56}
              tickFormatter={(v: number) => compact.format(v)}
            />
            <Tooltip
              contentStyle={{
                background: c.tooltipBg,
                border: `1px solid ${c.tooltipBorder}`,
                fontSize: 12,
              }}
              labelStyle={{ color: c.tooltipLabel }}
              itemStyle={{ color: c.tooltipItem }}
              formatter={(value: number) => `$${compact.format(value)}`}
              cursor={{ fill: c.barCursor }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: c.tooltipLabel }} />
            <Bar dataKey="export" stackId="flow" fill={c.accent.emerald} />
            <Bar dataKey="import" stackId="flow" fill={c.accent.blue} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
