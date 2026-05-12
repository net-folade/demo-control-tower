import { notFound } from "next/navigation";

import { CommodityPriceChart } from "@/components/CommodityPriceChart";
import { EmptyState } from "@/components/EmptyState";
import { TradeValueChart } from "@/components/TradeValueChart";
import { supabase } from "@/lib/supabase";

type PriceRow = { period: string; price_usd: number; unit: string | null };
type TradeRow = { period: string; flow: "import" | "export"; value_usd: number };

const COMMODITIES: Record<string, { label: string; hsCode: string }> = {
  cocoa: { label: "Cocoa", hsCode: "1801" },
  gold: { label: "Gold", hsCode: "7108" },
  crude_brent: { label: "Crude oil (Brent)", hsCode: "2709" },
  rice: { label: "Rice", hsCode: "1006" },
};

export const revalidate = 0;

export function generateStaticParams() {
  return Object.keys(COMMODITIES).map((commodity) => ({ commodity }));
}

export default async function CommodityPage({
  params,
}: {
  params: Promise<{ commodity: string }>;
}) {
  const { commodity } = await params;
  const meta = COMMODITIES[commodity];
  if (!meta) notFound();

  const client = supabase();

  const [priceRes, tradeRes] = await Promise.all([
    client
      .from("commodity_prices")
      .select("period, price_usd, unit")
      .eq("commodity", commodity)
      .order("period", { ascending: true }),
    client
      .from("trade_flows")
      .select("period, flow, value_usd")
      .eq("hs_code", meta.hsCode)
      .eq("partner", "W00")
      .order("period", { ascending: true }),
  ]);

  const prices = (priceRes.data ?? []) as PriceRow[];
  const trade = (tradeRes.data ?? []) as TradeRow[];

  return (
    <main className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 pt-2">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Commodity drill-down
        </p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-semibold tracking-tight">{meta.label}</h1>
          <span className="text-neutral-500 font-mono text-xs">
            HS {meta.hsCode}
          </span>
        </div>
        <p className="text-neutral-400 max-w-2xl leading-relaxed">
          Monthly world price next to Ghana&apos;s monthly import / export
          value for HS {meta.hsCode}. Use the brush below the price chart to
          zoom into a specific window.
        </p>
      </header>

      {prices.length > 0 ? (
        <CommodityPriceChart
          data={prices}
          commodity={meta.label}
          unit={prices.at(-1)?.unit ?? null}
          defaultRangeYears={5}
          showBrush
          height={380}
        />
      ) : (
        <EmptyState
          title={`${meta.label} prices`}
          message={`No commodity_prices rows for ${commodity} yet.`}
          hint="run tools/fetch_pink_sheet.py."
          error={priceRes.error?.message ?? null}
        />
      )}

      {trade.length > 0 ? (
        <TradeValueChart data={trade} title={`${meta.label} — Ghana trade value`} />
      ) : (
        <EmptyState
          title={`${meta.label} trade value`}
          message={`No trade_flows rows for HS ${meta.hsCode} yet.`}
          hint="run tools/fetch_comtrade_monthly.py."
          error={tradeRes.error?.message ?? null}
        />
      )}
    </main>
  );
}
