# Screenshots

Source images for the **Demo** section of the top-level `README.md`.

## Capture specs

- Browser window **1440 px wide** (lets the layout breathe without empty side margins).
- Dark OS theme so the dashboard's neutral-950 background matches.
- Hide browser chrome (use the system screenshot crop tool, or browser "capture viewport" devtools).
- PNG, ≥ 2× device pixel ratio if possible (Retina).

## Expected files

| Filename | What to capture |
|---|---|
| `01-overview.png` | Home page top-third — top nav + hero + "At a glance" KPI strip. The opening impression. |
| `02-commodities.png` | Commodities section with cocoa selected — chip grid + big KPI tile + price chart. |
| `03-ports-map-alerts.png` | Tema + Takoradi map next to the AlertsPanel. Ideally pick a moment when at least one port pin is rose so the alert-state contrast is visible. |
| `04-port-activity.png` | PortActivityChart with a non-default metric selected (e.g. "Container TEUs") so the Tema-vs-Takoradi structural split shows. |
| `05-trade-partners.png` | TradePartnersChart for 2023 (the latest available year given the Comtrade gap). |

## Adding a new one

1. Drop the PNG into this directory.
2. Reference it from the main README's **Demo** section using `deliverables/screenshots/<file>.png`.
