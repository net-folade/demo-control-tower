"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

export type PortBadge = {
  port_code: "TEMA" | "TAKORADI";
  name: string;
  lat: number;
  lng: number;
  vessel_calls_latest: number | null;
  cargo_tonnes_latest: number | null;
  year: number | null;
};

const PORT_COORDS: Record<"TEMA" | "TAKORADI", { lat: number; lng: number; name: string }> = {
  TEMA: { lat: 5.6314, lng: -0.0166, name: "Port of Tema" },
  TAKORADI: { lat: 4.8845, lng: -1.7554, name: "Port of Takoradi" },
};

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function PortLocationsMap({ badges }: { badges: PortBadge[] }) {
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
            return (
              <CircleMarker
                key={b.port_code}
                center={[coords.lat, coords.lng]}
                radius={10}
                pathOptions={{
                  color: "#34d399",
                  fillColor: "#34d399",
                  fillOpacity: 0.7,
                  weight: 2,
                }}
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
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </section>
  );
}
