"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Partner = {
  partner: string;
  total_value_usd: number;
  share_pct: number;
};

type Props = {
  partners: Partner[];
  dataWindow?: string;
};

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function TradePartnersChart({ partners, dataWindow }: Props) {
  const data = partners.map((p) => ({
    partner: p.partner,
    value: Number(p.total_value_usd),
    share: Number(p.share_pct),
  }));

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Top trade partners — last 12 mo
          </p>
          {dataWindow && (
            <p className="text-[10px] text-neutral-600 font-mono">{dataWindow}</p>
          )}
        </div>
        <p className="text-xs text-neutral-500 font-mono">USD</p>
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
