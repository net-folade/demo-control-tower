type SparkPoint = { period: string; value: number };

type KpiTileProps = {
  label: string;
  value: string;
  unit?: string;
  pctChange: number | null;
  sparkline?: SparkPoint[] | null;
};

export function KpiTile({ label, value, unit, pctChange, sparkline }: KpiTileProps) {
  const arrow = pctChange === null ? "" : pctChange > 0 ? "▲" : pctChange < 0 ? "▼" : "■";
  const trendColor =
    pctChange === null
      ? "text-neutral-500"
      : pctChange > 0
        ? "text-emerald-400"
        : pctChange < 0
          ? "text-rose-400"
          : "text-neutral-400";

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-2 min-w-[220px]">
      <p className="text-xs uppercase tracking-widest text-neutral-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {unit && <span className="text-xs text-neutral-500">{unit}</span>}
      </div>
      <div className={`flex items-center gap-2 text-xs font-mono ${trendColor}`}>
        <span>{arrow}</span>
        <span>
          {pctChange === null ? "—" : `${pctChange > 0 ? "+" : ""}${pctChange.toFixed(2)}%`}
        </span>
        <span className="text-neutral-600">vs prior</span>
      </div>
      {sparkline && sparkline.length > 1 && <Sparkline points={sparkline} />}
    </div>
  );
}

function Sparkline({ points }: { points: SparkPoint[] }) {
  const w = 200;
  const h = 32;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p.value - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      className="text-neutral-400"
    >
      <path d={path} stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
