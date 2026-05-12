"""Fetch current weather at Tema and Takoradi from Open-Meteo.

Writes raw conditions to `weather_obs`, and derives a `disruption_events` row
whenever wind / precipitation / weather code thresholds are breached. No API
key required (Open-Meteo is free for non-commercial use up to 10k calls/day).

Run:
    python tools/fetch_weather_ports.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import upsert  # noqa: E402

API_URL = "https://api.open-meteo.com/v1/forecast"

PORTS: dict[str, dict] = {
    "TEMA":     {"lat": 5.6314, "lng": -0.0166},
    "TAKORADI": {"lat": 4.8845, "lng": -1.7554},
}

# WMO weather codes → human-readable label.
# https://open-meteo.com/en/docs (under "Weather variable documentation")
WMO_CODES: dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}

# Disruption thresholds. Severity grades 1-5; ≥3 = "active alert" in v_active_alerts.
WIND_KPH_SEV3 = 50.0
WIND_KPH_SEV4 = 70.0
PRECIP_MM_SEV3 = 15.0
PRECIP_MM_SEV4 = 30.0


def fetch_current(lat: float, lng: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": "temperature_2m,wind_speed_10m,precipitation,weather_code",
        "wind_speed_unit": "kmh",
        "timezone": "UTC",
    }
    resp = requests.get(API_URL, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def parse_ts(iso_str: str) -> datetime:
    # Open-Meteo returns "2026-05-12T14:00" (no zone). We requested UTC.
    return datetime.fromisoformat(iso_str).replace(tzinfo=timezone.utc)


def classify_disruption(
    code: int,
    wind_kph: float | None,
    precip_mm: float | None,
) -> tuple[str, int] | None:
    """Return (event_type, severity) for an alert-worthy reading, else None."""
    # Thunderstorm trumps everything else.
    if code in (95, 96, 99):
        return ("thunderstorm", 4)

    if wind_kph is not None and wind_kph >= WIND_KPH_SEV4:
        return ("high_wind", 4)
    if precip_mm is not None and precip_mm >= PRECIP_MM_SEV4:
        return ("heavy_rain", 4)
    if wind_kph is not None and wind_kph >= WIND_KPH_SEV3:
        return ("high_wind", 3)
    if precip_mm is not None and precip_mm >= PRECIP_MM_SEV3:
        return ("heavy_rain", 3)

    # Code-based fallbacks: 65 = heavy rain, 82 = violent showers.
    if code in (65, 82):
        return ("heavy_rain", 3)

    return None


def build_rows(location: str, payload: dict) -> tuple[dict, dict | None]:
    cur = payload["current"]
    ts = parse_ts(cur["time"])
    wind = cur.get("wind_speed_10m")
    precip = cur.get("precipitation")
    code = int(cur.get("weather_code", 0))
    conditions = WMO_CODES.get(code, f"code {code}")

    obs = {
        "location": location,
        "ts": ts.isoformat(),
        "temp_c": cur.get("temperature_2m"),
        "wind_kph": wind,
        "precip_mm": precip,
        "conditions": conditions,
    }

    disruption: dict | None = None
    cls = classify_disruption(code, wind, precip)
    if cls is not None:
        event_type, severity = cls
        # Round to the hour for a stable key (Open-Meteo current returns hour-aligned ts).
        hour_iso = ts.replace(minute=0, second=0, microsecond=0).isoformat()
        headline_bits = [f"{conditions} at {location.title()}"]
        if wind is not None and wind >= WIND_KPH_SEV3:
            headline_bits.append(f"wind {wind:.0f} kph")
        if precip is not None and precip >= PRECIP_MM_SEV3:
            headline_bits.append(f"precip {precip:.1f} mm/h")
        headline = " — ".join(headline_bits)

        disruption = {
            "event_key": f"weather:{location}:{hour_iso}:{event_type}",
            "source": "weather",
            "event_type": event_type,
            "ts": ts.isoformat(),
            "location": location,
            "headline": headline,
            "url": None,
            "severity": severity,
        }
    return obs, disruption


def main() -> int:
    obs_rows: list[dict] = []
    disruption_rows: list[dict] = []

    for location, coords in PORTS.items():
        try:
            payload = fetch_current(coords["lat"], coords["lng"])
        except requests.RequestException as exc:
            print(f"warn: {location} fetch failed: {exc}")
            continue
        obs, dis = build_rows(location, payload)
        obs_rows.append(obs)
        print(
            f"{location}: {obs['conditions']} · "
            f"wind {obs['wind_kph']} kph · precip {obs['precip_mm']} mm"
        )
        if dis is not None:
            disruption_rows.append(dis)
            print(f"  → disruption: {dis['event_type']} severity={dis['severity']}")

    if obs_rows:
        n = upsert("weather_obs", obs_rows, on_conflict="location,ts")
        print(f"Upserted {n} weather_obs rows")
    if disruption_rows:
        n = upsert("disruption_events", disruption_rows, on_conflict="event_key")
        print(f"Upserted {n} disruption_events rows (weather)")
    else:
        print("No weather-derived disruptions this run.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
