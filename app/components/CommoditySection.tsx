"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CommodityPriceChart } from "./CommodityPriceChart";
import { KpiTile } from "./KpiTile";
import { useChartColors } from "../lib/theme";

export type CommodityKey = "cocoa" | "gold" | "crude_brent" | "rice";

export type CommodityBundle = {
  key: CommodityKey;
  label: string;
  unit: string | null;
  latestPrice: number | null;
  pctChangeMom: number | null;
  sparkline12m: { period: string; value: number }[] | null;
  history: { period: string; price_usd: number; unit: string | null }[];
};

type Props = {
  commodities: CommodityBundle[];
  defaultKey?: CommodityKey;
};

const ACCENT_BY_KEY: Record<CommodityKey, "emerald" | "amber" | "cyan" | "violet"> = {
  cocoa: "emerald",
  gold: "amber",
  crude_brent: "cyan",
  rice: "violet",
};

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return value.toFixed(2);
}

export function CommoditySection({ commodities, defaultKey = "cocoa" }: Props) {
  const [activeKey, setActiveKey] = useState<CommodityKey>(defaultKey);
  const colors = useChartColors();

  const active = useMemo(
    () => commodities.find((c) => c.key === activeKey) ?? commodities[0],
    [commodities, activeKey],
  );

  if (!active) return null;
  const accent = ACCENT_BY_KEY[active.key];
  const accentHex = colors.accent[accent];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Commodities
          </p>
          <Link
            href={`/commodities/${active.key}`}
            className="text-[11px] font-mono text-neutral-500 hover:text-neutral-200"
          >
            full {active.label.toLowerCase()} drill-down →
          </Link>
        </div>
        <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
          Cocoa, gold, crude, and rice — the four world prices that move
          Ghana&apos;s export receipts and import bill the most. Click a chip
          to switch the chart.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {commodities.map((c) => {
          const selected = c.key === activeKey;
          const ringHex = colors.accent[ACCENT_BY_KEY[c.key]];
          const pct = c.pctChangeMom;
          const pctColor =
            pct === null
              ? "text-neutral-500"
              : pct > 0
                ? "text-emerald-400"
                : pct < 0
                  ? "text-rose-400"
                  : "text-neutral-400";
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveKey(c.key)}
              className={`text-left rounded-lg border px-3 py-3 transition flex flex-col gap-1 ${
                selected
                  ? "bg-neutral-900"
                  : "bg-neutral-900/40 hover:bg-neutral-900/70"
              }`}
              style={{
                borderColor: selected ? ringHex : colors.borderSubtle,
                boxShadow: selected ? `0 0 0 1px ${ringHex}33` : "none",
              }}
            >
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                {c.label}
              </span>
              <span className="text-lg font-semibold tabular-nums text-neutral-100">
                {formatPrice(c.latestPrice)}
              </span>
              <span className={`text-[11px] font-mono ${pctColor}`}>
                {pct === null
                  ? "—"
                  : `${pct > 0 ? "▲" : pct < 0 ? "▼" : "■"} ${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
        <KpiTile
          label={`${active.label} price`}
          value={formatPrice(active.latestPrice)}
          unit={active.unit ?? undefined}
          pctChange={active.pctChangeMom}
          sparkline={active.sparkline12m}
          accent={accent}
          size="large"
          footnote="World Bank Pink Sheet · monthly"
        />
        {active.history.length > 0 ? (
          <CommodityPriceChart
            data={active.history}
            commodity={active.label}
            unit={active.history.at(-1)?.unit ?? active.unit}
            defaultRangeYears={2}
            color={accentHex}
            height={300}
          />
        ) : (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 text-amber-400 font-mono text-sm">
            no history rows for {active.label.toLowerCase()} yet
          </div>
        )}
      </div>
    </section>
  );
}
