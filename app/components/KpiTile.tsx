"use client";

import { useChartColors } from "../lib/theme";

type SparkPoint = { period: string; value: number };

type KpiTileProps = {
  label: string;
  value: string;
  unit?: string;
  pctChange: number | null;
  sparkline?: SparkPoint[] | null;
  footnote?: string;
  accent?: "emerald" | "cyan" | "amber" | "rose" | "violet";
  size?: "default" | "large";
};

export function KpiTile({
  label,
  value,
  unit,
  pctChange,
  sparkline,
  footnote,
  accent = "emerald",
  size = "default",
}: KpiTileProps) {
  const c = useChartColors();
  const accentStroke = c.accent[accent];
  const arrow = pctChange === null ? "" : pctChange > 0 ? "▲" : pctChange < 0 ? "▼" : "■";
  const trendColor =
    pctChange === null
      ? "text-neutral-500"
      : pctChange > 0
        ? "text-emerald-400"
        : pctChange < 0
          ? "text-rose-400"
          : "text-neutral-400";

  const valueSize = size === "large" ? "text-4xl" : "text-2xl";
  const padding = size === "large" ? "px-6 py-5" : "px-5 py-4";
  const minWidth = size === "large" ? "min-w-[260px]" : "min-w-[220px]";

  return (
    <div
      className={`rounded-lg border border-neutral-800 bg-neutral-900/50 ${padding} flex flex-col gap-2 ${minWidth}`}
    >
      <p className="text-xs uppercase tracking-widest text-neutral-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`${valueSize} font-semibold tabular-nums`}>{value}</span>
        {unit && <span className="text-xs text-neutral-500">{unit}</span>}
      </div>
      <div className={`flex items-center gap-2 text-xs font-mono ${trendColor}`}>
        <span>{arrow}</span>
        <span>
          {pctChange === null ? "—" : `${pctChange > 0 ? "+" : ""}${pctChange.toFixed(2)}%`}
        </span>
        <span className="text-neutral-600">vs prior</span>
      </div>
      {sparkline && sparkline.length > 1 && (
        <Sparkline
          points={sparkline}
          color={accentStroke}
          gradientStop={c.gradientStop}
          height={size === "large" ? 56 : 32}
        />
      )}
      {footnote && (
        <p className="text-[10px] text-neutral-600 font-mono leading-tight">{footnote}</p>
      )}
    </div>
  );
}

function Sparkline({
  points,
  color,
  gradientStop,
  height = 32,
}: {
  points: SparkPoint[];
  color: string;
  gradientStop: string;
  height?: number;
}) {
  const w = 200;
  const h = height;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;

  const linePath = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p.value - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lastX = (points.length - 1) * step;
  const areaPath = `${linePath} L${lastX.toFixed(1)},${h} L0,${h} Z`;
  const gradientId = `spark-grad-${color.replace("#", "")}-${h}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={gradientStop} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path d={linePath} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
