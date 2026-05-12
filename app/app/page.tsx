import {
  CommoditySection,
  type CommodityBundle,
  type CommodityKey,
} from "@/components/CommoditySection";
import { EmptyState } from "@/components/EmptyState";
import { KpiTile } from "@/components/KpiTile";
import { MapAndAlerts } from "@/components/MapAndAlerts";
import { PortActivityChart, type PortActivityRow } from "@/components/PortActivityChart";
import type { PortBadge } from "@/components/PortLocationsMap";
import { TradePartnersChart, type PartnerYearRow } from "@/components/TradePartnersChart";
import { supabase } from "@/lib/supabase";

type SparkPoint = { period: string; value: number };

type LatestPriceRow = {
  commodity: string;
  period: string;
  price_usd: number;
  unit: string | null;
  prior_period_price: number | null;
  pct_change_mom: number | null;
  sparkline_12m: SparkPoint[] | null;
};

type PriceHistoryRow = {
  commodity: string;
  period: string;
  price_usd: number;
  unit: string | null;
};

type KpiRow = {
  metric: string;
  current_value: number;
  prior_value: number | null;
  pct_change: number | null;
  sparkline: SparkPoint[] | null;
};

type AlertRow = {
  id: number;
  source: string;
  event_type: string;
  ts: string;
  location: string | null;
  headline: string;
  url: string | null;
  severity: number;
};

type PortStatsLatestRow = {
  port_code: "TEMA" | "TAKORADI";
  metric: string;
  year: number;
  value: number;
  unit: string | null;
  prior_year_value: number | null;
  pct_change_yoy: number | null;
  sparkline_10y: SparkPoint[] | null;
};

const COMMODITY_META: { key: CommodityKey; label: string }[] = [
  { key: "cocoa", label: "Cocoa" },
  { key: "gold", label: "Gold" },
  { key: "crude_brent", label: "Crude (Brent)" },
  { key: "rice", label: "Rice" },
];

export const revalidate = 0;

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default async function Home() {
  const client = supabase();

  const historyFetches = COMMODITY_META.map((meta) =>
    client
      .from("commodity_prices")
      .select("commodity, period, price_usd, unit")
      .eq("commodity", meta.key)
      .order("period", { ascending: true }),
  );

  const [
    latestRes,
    kpiRes,
    partnersByYearRes,
    tradeLatestRes,
    portStatsLatestRes,
    portActivityRes,
    alertsRes,
    ...historyResults
  ] = await Promise.all([
    client
      .from("v_commodity_price_latest")
      .select(
        "commodity, period, price_usd, unit, prior_period_price, pct_change_mom, sparkline_12m",
      ),
    client
      .from("v_kpi_summary")
      .select("metric, current_value, prior_value, pct_change, sparkline"),
    client
      .from("v_top_trade_partners_by_year")
      .select("year, partner, total_value_usd, share_pct")
      .limit(5000),
    client
      .from("trade_flows")
      .select("period")
      .eq("hs_code", "TOTAL")
      .order("period", { ascending: false })
      .limit(1),
    client
      .from("v_port_stats_latest")
      .select(
        "port_code, metric, year, value, unit, prior_year_value, pct_change_yoy, sparkline_10y",
      ),
    client
      .from("v_port_activity")
      .select("port_code, year, metric, value, unit"),
    client
      .from("v_active_alerts")
      .select("id, source, event_type, ts, location, headline, url, severity")
      .order("ts", { ascending: false }),
    ...historyFetches,
  ]);

  const history: PriceHistoryRow[] = historyResults.flatMap(
    (r) => (r.data ?? []) as PriceHistoryRow[],
  );

  const latest = (latestRes.data ?? []) as LatestPriceRow[];
  const kpis = (kpiRes.data ?? []) as KpiRow[];
  const tradeYtd = kpis.find((k) => k.metric === "trade_value_ytd") ?? null;
  const partnersByYear = (partnersByYearRes.data ?? []) as PartnerYearRow[];
  const portStatsLatest = (portStatsLatestRes.data ?? []) as PortStatsLatestRow[];
  const portActivity = (portActivityRes.data ?? []) as PortActivityRow[];
  const alerts = (alertsRes.data ?? []) as AlertRow[];
  const activeDisruptions = kpis.find((k) => k.metric === "active_disruptions") ?? null;

  const commodityBundles: CommodityBundle[] = COMMODITY_META.map((meta) => {
    const l = latest.find((r) => r.commodity === meta.key) ?? null;
    const hist = history.filter((r) => r.commodity === meta.key);
    return {
      key: meta.key,
      label: meta.label,
      unit: l?.unit ?? hist.at(-1)?.unit ?? null,
      latestPrice: l?.price_usd ?? null,
      pctChangeMom: l?.pct_change_mom ?? null,
      sparkline12m: l?.sparkline_12m ?? null,
      history: hist.map((h) => ({
        period: h.period,
        price_usd: h.price_usd,
        unit: h.unit,
      })),
    };
  });

  const findStat = (port: "TEMA" | "TAKORADI", metric: string) =>
    portStatsLatest.find((s) => s.port_code === port && s.metric === metric) ?? null;
  const temaVesselCalls = findStat("TEMA", "vessel_calls");
  const temaCargo = findStat("TEMA", "cargo_tonnes");

  const alertsByPort: Record<"TEMA" | "TAKORADI", AlertRow[]> = {
    TEMA: alerts.filter((a) => a.location === "TEMA"),
    TAKORADI: alerts.filter((a) => a.location === "TAKORADI"),
  };

  const portBadges: PortBadge[] = (["TEMA", "TAKORADI"] as const).map((p) => {
    const vc = findStat(p, "vessel_calls");
    const cg = findStat(p, "cargo_tonnes");
    const portAlerts = alertsByPort[p];
    return {
      port_code: p,
      name: p,
      lat: 0,
      lng: 0,
      vessel_calls_latest: vc?.value ?? null,
      cargo_tonnes_latest: cg?.value ?? null,
      year: vc?.year ?? cg?.year ?? null,
      alert_count: portAlerts.length,
      alert_headlines: portAlerts.slice(0, 3).map((a) => a.headline),
    };
  });

  const tradeLatestPeriod = (tradeLatestRes.data?.[0]?.period as string | undefined) ?? null;
  const tradeWindow = tradeLatestPeriod
    ? (() => {
        const end = new Date(tradeLatestPeriod);
        const start = new Date(end);
        start.setMonth(start.getMonth() - 11);
        const fmt = (d: Date) =>
          d.toLocaleString(undefined, { month: "short", year: "numeric" });
        return `${fmt(start)} – ${fmt(end)} (Ghana reporting gap after Dec 2023)`;
      })()
    : undefined;

  return (
    <main className="flex flex-col gap-12">
      <header className="flex flex-col gap-3 pt-2">
        <h1 className="text-4xl font-semibold tracking-tight">
          Ghana Control Tower
        </h1>
        <p className="text-neutral-400 max-w-2xl leading-relaxed">
          End-to-end visibility into West Africa / Ghana trade flows — vessel
          activity at Tema and Takoradi, import/export value with Ghana&apos;s
          top partners, commodity prices for the country&apos;s big four, and
          live disruption signals from weather + news.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            At a glance
          </p>
          <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
            Four anchor signals: how much moves through Tema, what 2023 trade
            was worth, and what&apos;s disrupting operations right now.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile
            label={`Tema vessel calls · ${temaVesselCalls?.year ?? "—"}`}
            value={temaVesselCalls ? compact.format(Number(temaVesselCalls.value)) : "—"}
            unit="calls"
            pctChange={temaVesselCalls?.pct_change_yoy ?? null}
            sparkline={temaVesselCalls?.sparkline_10y ?? null}
            accent="emerald"
            footnote={`GPHA Annual · last published ${temaVesselCalls?.year ?? "—"}`}
          />
          <KpiTile
            label={`Tema cargo throughput · ${temaCargo?.year ?? "—"}`}
            value={temaCargo ? compact.format(Number(temaCargo.value)) : "—"}
            unit="tonnes"
            pctChange={temaCargo?.pct_change_yoy ?? null}
            sparkline={temaCargo?.sparkline_10y ?? null}
            accent="cyan"
            footnote={`GPHA Annual · last published ${temaCargo?.year ?? "—"}`}
          />
          <KpiTile
            label="Ghana trade value · 2023"
            value={
              tradeYtd && tradeYtd.current_value
                ? `$${compact.format(Number(tradeYtd.current_value))}`
                : "—"
            }
            pctChange={tradeYtd?.pct_change ?? null}
            sparkline={tradeYtd?.sparkline ?? null}
            accent="violet"
            footnote="Jan–Dec 2023 · UN Comtrade (Ghana reporting paused)"
          />
          <KpiTile
            label="Active disruptions"
            value={
              activeDisruptions
                ? compact.format(Number(activeDisruptions.current_value))
                : "0"
            }
            pctChange={activeDisruptions?.pct_change ?? null}
            sparkline={activeDisruptions?.sparkline ?? null}
            accent="rose"
            footnote="live · last 7 days · severity ≥ 3 · Open-Meteo + GDELT"
          />
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-[12px] text-neutral-300 leading-relaxed">
          <ul className="flex flex-col gap-1">
            <li>
              <span className="text-neutral-100 font-medium">Commodity prices:</span>{" "}
              fully up to date.
            </li>
            <li>
              <span className="text-neutral-100 font-medium">Port activity:</span>{" "}
              current data stops at the end of 2024.
            </li>
            <li>
              <span className="text-neutral-100 font-medium">Trade activity:</span>{" "}
              reflects the January 2023 – December 2023 window.
            </li>
          </ul>
          <p className="text-[11px] text-neutral-500 mt-2">
            These timelines reflect the most recent information currently
            available from each source.
          </p>
        </div>
      </section>

      <CommoditySection commodities={commodityBundles} />

      {portActivity.length > 0 ? (
        <PortActivityChart rows={portActivity} />
      ) : (
        <EmptyState
          title="Port activity"
          message="No port_stats rows yet."
          hint="run tools/load_gpha_port_stats.py to load data."
          error={portActivityRes.error?.message ?? null}
        />
      )}

      {portStatsLatest.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="text-xs uppercase tracking-widest text-neutral-500">
                Ports &amp; disruptions
              </p>
              <p className="text-[10px] text-neutral-600 font-mono">
                click a port to filter alerts
              </p>
            </div>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Pins turn rose when an active weather or news alert is tagged to
              that port. The right panel shows the underlying events from the
              last seven days.
            </p>
          </div>
          <MapAndAlerts badges={portBadges} alerts={alerts} nowMs={Date.now()} />
        </section>
      )}

      {partnersByYear.length > 0 ? (
        <TradePartnersChart rows={partnersByYear} dataWindow={tradeWindow} />
      ) : (
        <EmptyState
          title="Trade partners"
          message="No trade_flows rows yet."
          hint="run tools/fetch_comtrade_monthly.py to load data."
          error={partnersByYearRes.error?.message ?? null}
        />
      )}
    </main>
  );
}
