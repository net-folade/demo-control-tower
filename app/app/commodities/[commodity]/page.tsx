import Link from "next/link";
import { notFound } from "next/navigation";

import { CommodityPriceChart } from "@/components/CommodityPriceChart";
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
    <main className="flex flex-1 flex-col px-6 py-12 gap-8 max-w-6xl mx-auto w-full">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-xs uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
        >
          ← gh-control-tower
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{meta.label}</h1>
        <p className="text-neutral-400 font-mono text-xs">HS {meta.hsCode}</p>
      </header>

      {prices.length > 0 ? (
        <CommodityPriceChart
          data={prices}
          commodity={meta.label}
          unit={prices.at(-1)?.unit ?? null}
        />
      ) : (
        <EmptySection
          message={`no commodity_prices rows for ${commodity} yet — run tools/fetch_pink_sheet.py.`}
          error={priceRes.error?.message}
        />
      )}

      {trade.length > 0 ? (
        <TradeValueChart data={trade} title={`${meta.label} — Ghana trade value`} />
      ) : (
        <EmptySection
          message={`no trade_flows rows for HS ${meta.hsCode} yet — run tools/fetch_comtrade_monthly.py.`}
          error={tradeRes.error?.message}
        />
      )}
    </main>
  );
}

function EmptySection({ message, error }: { message: string; error?: string }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-5">
      <p className="text-amber-400 font-mono text-sm">{message}</p>
      {error && <p className="text-rose-400 font-mono text-xs mt-2">{error}</p>}
    </section>
  );
}
