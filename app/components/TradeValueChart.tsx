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
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#737373", fontSize: 11 }}
              stroke="#404040"
              minTickGap={32}
            />
            <YAxis
              tick={{ fill: "#737373", fontSize: 11 }}
              stroke="#404040"
              width={56}
              tickFormatter={(v: number) => compact.format(v)}
            />
            <Tooltip
              contentStyle={{
                background: "#0a0a0a",
                border: "1px solid #262626",
                fontSize: 12,
              }}
              labelStyle={{ color: "#a3a3a3" }}
              itemStyle={{ color: "#e5e5e5" }}
              formatter={(value: number) => `$${compact.format(value)}`}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#a3a3a3" }} />
            <Bar dataKey="export" stackId="flow" fill="#34d399" />
            <Bar dataKey="import" stackId="flow" fill="#60a5fa" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
