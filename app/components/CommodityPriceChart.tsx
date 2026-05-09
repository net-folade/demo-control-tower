"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { period: string; price_usd: number };

type Props = {
  data: Point[];
  commodity: string;
  unit: string | null;
};

export function CommodityPriceChart({ data, commodity, unit }: Props) {
  const formatted = data.map((d) => ({
    period: d.period,
    price: Number(d.price_usd),
    label: new Date(d.period).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
    }),
  }));

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          {commodity} price
        </p>
        {unit && <p className="text-xs text-neutral-500 font-mono">{unit}</p>}
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={formatted} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#737373", fontSize: 11 }}
              stroke="#404040"
              minTickGap={48}
            />
            <YAxis
              tick={{ fill: "#737373", fontSize: 11 }}
              stroke="#404040"
              width={56}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#0a0a0a",
                border: "1px solid #262626",
                fontSize: 12,
              }}
              labelStyle={{ color: "#a3a3a3" }}
              itemStyle={{ color: "#e5e5e5" }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#34d399"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
