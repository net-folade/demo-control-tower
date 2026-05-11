import { CommodityPriceChart } from "@/components/CommodityPriceChart";
import { KpiTile } from "@/components/KpiTile";
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

export const revalidate = 0;

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default async function Home() {
  const client = supabase();

  const [latestRes, cocoaHistoryRes, kpiRes, partnersRes, tradeLatestRes] = await Promise.all([
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
  ]);

  const latest = (latestRes.data ?? []) as LatestPriceRow[];
  const cocoaLatest = latest.find((r) => r.commodity === "cocoa") ?? null;
  const cocoaHistory = (cocoaHistoryRes.data ?? []) as PriceHistoryRow[];
  const kpis = (kpiRes.data ?? []) as KpiRow[];
  const tradeYtd = kpis.find((k) => k.metric === "trade_value_ytd") ?? null;
  const partners = (partnersRes.data ?? []) as PartnerRow[];

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
      </section>

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
