"use client";

import dynamic from "next/dynamic";

import type { PortBadge } from "./PortLocationsMap";

const PortLocationsMap = dynamic(
  () => import("./PortLocationsMap").then((m) => m.PortLocationsMap),
  {
    ssr: false,
    loading: () => (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Ghana ports — latest annual stats
        </p>
        <div className="h-[360px] w-full rounded-md border border-neutral-800 grid place-items-center">
          <p className="text-xs text-neutral-500 font-mono">loading map…</p>
        </div>
      </section>
    ),
  },
);

type Props = {
  badges: PortBadge[];
  selectedPort?: "TEMA" | "TAKORADI" | null;
  onPortClick?: (port: "TEMA" | "TAKORADI") => void;
};

export function PortLocationsMapSection({ badges, selectedPort, onPortClick }: Props) {
  return (
    <PortLocationsMap
      badges={badges}
      selectedPort={selectedPort}
      onPortClick={onPortClick}
    />
  );
}
