"use client";

import { useState } from "react";

import { AlertsPanel } from "./AlertsPanel";
import type { PortBadge } from "./PortLocationsMap";
import { PortLocationsMapSection } from "./PortLocationsMapSection";

type Alert = {
  id: number;
  source: string;
  event_type: string;
  ts: string;
  location: string | null;
  headline: string;
  url: string | null;
  severity: number;
};

type Props = {
  badges: PortBadge[];
  alerts: Alert[];
  nowMs: number;
};

export function MapAndAlerts({ badges, alerts, nowMs }: Props) {
  const [selectedPort, setSelectedPort] = useState<"TEMA" | "TAKORADI" | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <PortLocationsMapSection
        badges={badges}
        selectedPort={selectedPort}
        onPortClick={(p) => setSelectedPort((cur) => (cur === p ? null : p))}
      />
      <AlertsPanel
        alerts={alerts}
        nowMs={nowMs}
        locationFilter={selectedPort}
        onClearFilter={() => setSelectedPort(null)}
      />
    </div>
  );
}
