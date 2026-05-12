"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip } from "react-leaflet";
import L from "leaflet";

export type PortBadge = {
  port_code: "TEMA" | "TAKORADI";
  name: string;
  lat: number;
  lng: number;
  vessel_calls_latest: number | null;
  cargo_tonnes_latest: number | null;
  year: number | null;
  alert_count: number;
  alert_headlines: string[];
};

const PORT_COORDS: Record<"TEMA" | "TAKORADI", { lat: number; lng: number; name: string }> = {
  TEMA: { lat: 5.6314, lng: -0.0166, name: "Port of Tema" },
  TAKORADI: { lat: 4.8845, lng: -1.7554, name: "Port of Takoradi" },
};

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

function badgeIcon(count: number): L.DivIcon {
  // Small rose-colored pip rendered to the upper-right of the port circle.
  return L.divIcon({
    className: "",
    html: `<div style="
      background:#f43f5e;color:#fff;font:600 10px ui-sans-serif,system-ui;
      border:1.5px solid #0a0a0a;border-radius:9999px;
      min-width:18px;height:18px;line-height:15px;text-align:center;padding:0 4px;
      box-shadow:0 0 0 1px rgba(244,63,94,0.4);
    ">${count}</div>`,
    iconSize: [18, 18],
    iconAnchor: [-6, 18],
  });
}

type MapProps = {
  badges: PortBadge[];
  selectedPort?: "TEMA" | "TAKORADI" | null;
  onPortClick?: (port: "TEMA" | "TAKORADI") => void;
};

export function PortLocationsMap({ badges, selectedPort, onPortClick }: MapProps) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-5 py-4 flex flex-col gap-3 w-full">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Ghana ports — latest annual stats
        </p>
        <p className="text-[10px] text-neutral-600 font-mono">
          source: GPHA · annual
        </p>
      </div>
      <div className="h-[360px] w-full overflow-hidden rounded-md border border-neutral-800">
        <MapContainer
          center={[5.25, -0.85]}
          zoom={8}
          style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {badges.map((b) => {
            const coords = PORT_COORDS[b.port_code];
            const hasAlerts = b.alert_count > 0;
            const isSelected = selectedPort === b.port_code;
            const ringColor = hasAlerts ? "#f43f5e" : "#34d399";
            return (
              <CircleMarker
                key={b.port_code}
                center={[coords.lat, coords.lng]}
                radius={isSelected ? 14 : 10}
                pathOptions={{
                  color: ringColor,
                  fillColor: ringColor,
                  fillOpacity: isSelected ? 0.9 : 0.7,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={
                  onPortClick
                    ? { click: () => onPortClick(b.port_code) }
                    : undefined
                }
              >
                <Popup>
                  <div className="text-xs leading-tight">
                    <div className="font-semibold">{coords.name}</div>
                    {b.year && (
                      <div className="text-neutral-500">{b.year} · GPHA</div>
                    )}
                    <div className="mt-1">
                      Vessel calls:{" "}
                      <strong>
                        {b.vessel_calls_latest != null
                          ? compact.format(b.vessel_calls_latest)
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      Cargo:{" "}
                      <strong>
                        {b.cargo_tonnes_latest != null
                          ? `${compact.format(b.cargo_tonnes_latest)} t`
                          : "—"}
                      </strong>
                    </div>
                    {hasAlerts && (
                      <div className="mt-2 pt-2 border-t border-neutral-300">
                        <div className="font-semibold text-rose-600">
                          {b.alert_count} active disruption
                          {b.alert_count === 1 ? "" : "s"}
                        </div>
                        <ul className="mt-1 list-disc list-inside space-y-0.5">
                          {b.alert_headlines.map((h, i) => (
                            <li key={i} className="truncate max-w-[240px]">
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          {badges
            .filter((b) => b.alert_count > 0)
            .map((b) => {
              const coords = PORT_COORDS[b.port_code];
              return (
                <Marker
                  key={`badge-${b.port_code}`}
                  position={[coords.lat, coords.lng]}
                  icon={badgeIcon(b.alert_count)}
                  interactive={false}
                >
                  <Tooltip direction="top" offset={[2, -14]} opacity={0.95}>
                    {b.alert_count} active disruption
                    {b.alert_count === 1 ? "" : "s"}
                  </Tooltip>
                </Marker>
              );
            })}
        </MapContainer>
      </div>
    </section>
  );
}
