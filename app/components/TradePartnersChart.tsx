"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PartnerYearRow = {
  year: number;
  partner: string;
  total_value_usd: number;
  share_pct: number;
};

type Props = {
  /** All annual aggregates across the available year range. */
  rows: PartnerYearRow[];
  /** Fallback caption when there is only one year. */
  dataWindow?: string;
  /** How many top partners to show per year. */
  topN?: number;
};

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function TradePartnersChart({ rows, dataWindow, topN = 10 }: Props) {
  const years = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a),
    [rows],
  );

  const [year, setYear] = useState<number | null>(years[0] ?? null);
  const [open, setOpen] = useState(false);

  const data = useMemo(() => {
    if (year === null) return [];
    return rows
      .filter((r) => r.year === year)
      .sort((a, b) => Number(b.total_value_usd) - Number(a.total_value_usd))
      .slice(0, topN)
      .map((p) => ({
        partner: p.partner,
        value: Number(p.total_value_usd),
        share: Number(p.share_pct),
      }));
  }, [rows, year, topN]);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Top trade partners
          </p>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Where Ghana&apos;s trade dollars actually flow. Switch the year to
            see how the mix has shifted.
          </p>
          <p className="text-[10px] text-neutral-600 font-mono">
            {year ? `top ${topN} · partner share of Ghana total` : "no data"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {years.length > 1 ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="px-2.5 py-1 rounded border border-neutral-700 bg-neutral-900 text-[11px] font-mono text-neutral-300 hover:border-emerald-500 hover:text-emerald-300 transition"
              >
                Data as of {year} ▾
              </button>
              {open && (
                <div className="absolute right-0 mt-1 z-10 rounded border border-neutral-800 bg-neutral-950 shadow-lg min-w-[110px]">
                  <ul className="py-1 max-h-64 overflow-y-auto">
                    {years.map((y) => (
                      <li key={y}>
                        <button
                          type="button"
                          onClick={() => {
                            setYear(y);
                            setOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] font-mono transition ${
                            y === year
                              ? "text-emerald-300 bg-emerald-500/10"
                              : "text-neutral-300 hover:bg-neutral-900"
                          }`}
                        >
                          {y}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : dataWindow ? (
            <p className="text-[10px] text-neutral-600 font-mono">{dataWindow}</p>
          ) : null}
          <p className="text-xs text-neutral-500 font-mono">USD</p>
        </div>
      </div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
          >
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "#737373", fontSize: 11 }}
              stroke="#404040"
              tickFormatter={(v: number) => compact.format(v)}
            />
            <YAxis
              type="category"
              dataKey="partner"
              tick={{ fill: "#a3a3a3", fontSize: 11 }}
              stroke="#404040"
              width={48}
            />
            <Tooltip
              cursor={{ fill: "#171717" }}
              contentStyle={{
                background: "#0a0a0a",
                border: "1px solid #262626",
                fontSize: 12,
              }}
              labelStyle={{ color: "#a3a3a3" }}
              itemStyle={{ color: "#e5e5e5" }}
              formatter={(value: number, _name, item) => {
                const share = item?.payload?.share;
                return [
                  `$${compact.format(value)}${share != null ? `  (${share}%)` : ""}`,
                  "value",
                ];
              }}
            />
            <Bar dataKey="value" fill="#34d399" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
