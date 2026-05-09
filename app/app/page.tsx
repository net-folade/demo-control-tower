import { supabase } from "@/lib/supabase";

type HealthRow = {
  id: number;
  status: string;
  checked_at: string;
};

export const revalidate = 0;

export default async function Home() {
  const { data, error } = await supabase()
    .from("_health")
    .select("id, status, checked_at")
    .eq("id", 1)
    .maybeSingle<HealthRow>();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 gap-8">
      <div className="flex flex-col gap-2 text-center">
        <p className="text-sm uppercase tracking-widest text-neutral-500">
          gh-control-tower
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Ghana Control Tower
        </h1>
        <p className="text-neutral-400 max-w-md">
          End-to-end visibility into West Africa / Ghana trade flows.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-5 w-full max-w-md">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Supabase connectivity
        </p>
        {error ? (
          <p className="text-red-400 font-mono text-sm">
            error: {error.message}
          </p>
        ) : data ? (
          <div className="flex flex-col gap-1 font-mono text-sm">
            <span>
              status:{" "}
              <span className="text-emerald-400">{data.status}</span>
            </span>
            <span className="text-neutral-500">
              checked_at: {new Date(data.checked_at).toISOString()}
            </span>
          </div>
        ) : (
          <p className="text-amber-400 font-mono text-sm">
            no _health row found — did you run sql/0001_init.sql?
          </p>
        )}
      </section>
    </main>
  );
}
