import { CommodityPriceChart } from "@/components/CommodityPriceChart";
import { KpiTile } from "@/components/KpiTile";
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

export const revalidate = 0;

export default async function Home() {
  const client = supabase();

  const [latestRes, cocoaHistoryRes] = await Promise.all([
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
  ]);

  const latest = (latestRes.data ?? []) as LatestPriceRow[];
  const cocoaLatest = latest.find((r) => r.commodity === "cocoa") ?? null;
  const cocoaHistory = (cocoaHistoryRes.data ?? []) as PriceHistoryRow[];

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
      </section>

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
    </main>
  );
}
