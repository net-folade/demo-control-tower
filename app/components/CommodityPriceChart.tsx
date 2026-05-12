"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "../lib/theme";

type Point = { period: string; price_usd: number };

type Props = {
  data: Point[];
  commodity: string;
  unit: string | null;
  /** Trailing years to display. Defines either the slice (when showBrush=false) or the initial brush window. */
  defaultRangeYears?: number;
  color?: string;
  height?: number;
  /** When true, render a range slider over the full dataset (drill-down view). */
  showBrush?: boolean;
};

export function CommodityPriceChart({
  data,
  commodity,
  unit,
  defaultRangeYears = 5,
  color,
  height = 320,
  showBrush = false,
}: Props) {
  const c = useChartColors();
  const stroke = color ?? c.accent.emerald;
  const displayData = useMemo(() => {
    if (data.length === 0) return data;
    if (showBrush) return data;
    const last = new Date(data[data.length - 1].period);
    const cutoff = new Date(last);
    cutoff.setFullYear(cutoff.getFullYear() - defaultRangeYears);
    return data.filter((d) => new Date(d.period) >= cutoff);
  }, [data, defaultRangeYears, showBrush]);

  const formatted = useMemo(
    () =>
      displayData.map((d) => ({
        period: d.period,
        price: Number(d.price_usd),
        label: new Date(d.period).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        }),
      })),
    [displayData],
  );

  const { startIndex, endIndex } = useMemo(() => {
    if (!showBrush || formatted.length === 0) {
      return { startIndex: 0, endIndex: Math.max(0, formatted.length - 1) };
    }
    const endIdx = formatted.length - 1;
    const lastPeriod = new Date(formatted[endIdx].period);
    const cutoff = new Date(lastPeriod);
    cutoff.setFullYear(cutoff.getFullYear() - defaultRangeYears);
    let startIdx = formatted.findIndex((d) => new Date(d.period) >= cutoff);
    if (startIdx < 0) startIdx = 0;
    return { startIndex: startIdx, endIndex: endIdx };
  }, [formatted, defaultRangeYears, showBrush]);

  const rangeLabel = useMemo(() => {
    if (formatted.length === 0) return "";
    if (showBrush) {
      const first = formatted[startIndex]?.label;
      const last = formatted[endIndex]?.label;
      return `${first} – ${last} · drag below to change`;
    }
    const first = formatted[0].label;
    const last = formatted[formatted.length - 1].label;
    return `${first} – ${last}`;
  }, [formatted, showBrush, startIndex, endIndex]);

  const gradientId = `commodity-area-${stroke.replace("#", "")}-${showBrush ? "b" : "s"}`;
  const brushKey = `brush-${data.length}-${defaultRangeYears}`;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          {commodity} price history
        </p>
        <div className="flex items-baseline gap-3">
          <p className="text-[10px] text-neutral-600 font-mono">{rangeLabel}</p>
          {unit && <p className="text-xs text-neutral-500 font-mono">{unit}</p>}
        </div>
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <AreaChart data={formatted} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.4" />
                <stop offset="100%" stopColor={c.gradientStop} stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: c.tick, fontSize: 11 }}
              stroke={c.axis}
              minTickGap={48}
            />
            <YAxis
              tick={{ fill: c.tick, fontSize: 11 }}
              stroke={c.axis}
              width={56}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: c.tooltipBg,
                border: `1px solid ${c.tooltipBorder}`,
                fontSize: 12,
              }}
              labelStyle={{ color: c.tooltipLabel }}
              itemStyle={{ color: c.tooltipItem }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={stroke}
              strokeWidth={1.75}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
            {showBrush && formatted.length > 24 && (
              <Brush
                key={brushKey}
                dataKey="label"
                height={24}
                stroke={stroke}
                fill={c.surface}
                travellerWidth={8}
                tickFormatter={() => ""}
                startIndex={startIndex}
                endIndex={endIndex}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
