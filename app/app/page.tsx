import { AlertsPanel } from "@/components/AlertsPanel";
import { CommodityPriceChart } from "@/components/CommodityPriceChart";
import { KpiTile } from "@/components/KpiTile";
import { PortActivityChart, type PortActivityRow } from "@/components/PortActivityChart";
import type { PortBadge } from "@/components/PortLocationsMap";
import { PortLocationsMapSection } from "@/components/PortLocationsMapSection";
import { TradePartnersChart } from "@/components/TradePartnersChart";
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

type PartnerRow = {
  partner: string;
  total_value_usd: number;
  share_pct: number;
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

export const revalidate = 0;

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default async function Home() {
  const client = supabase();

  const [
    latestRes,
    cocoaHistoryRes,
    kpiRes,
    partnersRes,
    tradeLatestRes,
    portStatsLatestRes,
    portActivityRes,
    alertsRes,
  ] = await Promise.all([
    client
      .from("v_commodity_price_latest")
      .select(
        "commodity, period, price_usd, unit, prior_period_price, pct_change_mom, sparkline_12m",
      ),
    client
      .from("commodity_prices")
      .select("period, price_usd, unit")
      .eq("commodity", "cocoa")
      .order("period", { ascending: true }),
    client
      .from("v_kpi_summary")
      .select("metric, current_value, prior_value, pct_change, sparkline"),
    client
      .from("v_top_trade_partners_ytd")
      .select("partner, total_value_usd, share_pct")
      .limit(10),
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
  ]);

  const latest = (latestRes.data ?? []) as LatestPriceRow[];
  const cocoaLatest = latest.find((r) => r.commodity === "cocoa") ?? null;
  const cocoaHistory = (cocoaHistoryRes.data ?? []) as PriceHistoryRow[];
  const kpis = (kpiRes.data ?? []) as KpiRow[];
  const tradeYtd = kpis.find((k) => k.metric === "trade_value_ytd") ?? null;
  const partners = (partnersRes.data ?? []) as PartnerRow[];
  const portStatsLatest = (portStatsLatestRes.data ?? []) as PortStatsLatestRow[];
  const portActivity = (portActivityRes.data ?? []) as PortActivityRow[];
  const alerts = (alertsRes.data ?? []) as AlertRow[];
  const activeDisruptions = kpis.find((k) => k.metric === "active_disruptions") ?? null;
  const alertsByPort: Record<"TEMA" | "TAKORADI", AlertRow[]> = {
    TEMA: alerts.filter((a) => a.location === "TEMA"),
    TAKORADI: alerts.filter((a) => a.location === "TAKORADI"),
  };

  const findStat = (port: "TEMA" | "TAKORADI", metric: string) =>
    portStatsLatest.find((s) => s.port_code === port && s.metric === metric) ?? null;
  const temaVesselCalls = findStat("TEMA", "vessel_calls");
  const temaCargo = findStat("TEMA", "cargo_tonnes");

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

  const formatPrice = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : n.toFixed(2);

  return (
    <main className="flex flex-1 flex-col px-6 py-12 gap-8 max-w-6xl mx-auto w-full">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-widest text-neutral-500">
          gh-control-tower
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Ghana Control Tower
        </h1>
        <p className="text-neutral-400 max-w-2xl">
          End-to-end visibility into West Africa / Ghana trade flows.
        </p>
      </header>

      <section className="flex flex-wrap gap-4">
        <KpiTile
          label={`Tema vessel calls (${temaVesselCalls?.year ?? "—"})`}
          value={temaVesselCalls ? compact.format(Number(temaVesselCalls.value)) : "—"}
          unit="calls"
          pctChange={temaVesselCalls?.pct_change_yoy ?? null}
          sparkline={temaVesselCalls?.sparkline_10y ?? null}
          footnote="GPHA Annual · 2014–2024"
        />
        <KpiTile
          label={`Tema cargo throughput (${temaCargo?.year ?? "—"})`}
          value={temaCargo ? `${compact.format(Number(temaCargo.value))} t` : "—"}
          pctChange={temaCargo?.pct_change_yoy ?? null}
          sparkline={temaCargo?.sparkline_10y ?? null}
          footnote="GPHA Annual · 2014–2024"
        />
        <KpiTile
          label="Cocoa price"
          value={formatPrice(cocoaLatest?.price_usd ?? null)}
          unit={cocoaLatest?.unit ?? undefined}
          pctChange={cocoaLatest?.pct_change_mom ?? null}
          sparkline={cocoaLatest?.sparkline_12m ?? null}
        />
        <KpiTile
          label="Trade value (last 12 mo)"
          value={
            tradeYtd && tradeYtd.current_value
              ? `$${compact.format(Number(tradeYtd.current_value))}`
              : "—"
          }
          pctChange={tradeYtd?.pct_change ?? null}
          sparkline={tradeYtd?.sparkline ?? null}
          footnote={tradeWindow}
        />
        <KpiTile
          label="Active disruptions (7d)"
          value={
            activeDisruptions
              ? compact.format(Number(activeDisruptions.current_value))
              : "0"
          }
          pctChange={activeDisruptions?.pct_change ?? null}
          sparkline={activeDisruptions?.sparkline ?? null}
          footnote="severity ≥ 3 · Open-Meteo + GDELT"
        />
      </section>

      {portStatsLatest.length > 0 && (
        <PortLocationsMapSection badges={portBadges} />
      )}

      <AlertsPanel alerts={alerts} />

      {portActivity.length > 0 ? (
        <PortActivityChart rows={portActivity} />
      ) : (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-5">
          <p className="text-amber-400 font-mono text-sm">
            no port_stats rows yet — run tools/load_gpha_port_stats.py to load data.
          </p>
          {portActivityRes.error && (
            <p className="text-rose-400 font-mono text-xs mt-2">
              {portActivityRes.error.message}
            </p>
          )}
        </section>
      )}

      {partners.length > 0 && (
        <TradePartnersChart partners={partners} dataWindow={tradeWindow} />
      )}

      {cocoaHistory.length > 0 ? (
        <CommodityPriceChart
          data={cocoaHistory}
          commodity="Cocoa"
          unit={cocoaHistory.at(-1)?.unit ?? null}
        />
      ) : (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-5">
          <p className="text-amber-400 font-mono text-sm">
            no commodity_prices rows yet — run tools/fetch_pink_sheet.py to load data.
          </p>
          {latestRes.error && (
            <p className="text-rose-400 font-mono text-xs mt-2">
              {latestRes.error.message}
            </p>
          )}
        </section>
      )}

      {partners.length === 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-5">
          <p className="text-amber-400 font-mono text-sm">
            no trade_flows rows yet — run tools/fetch_comtrade_monthly.py to load data.
          </p>
          {partnersRes.error && (
            <p className="text-rose-400 font-mono text-xs mt-2">
              {partnersRes.error.message}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
