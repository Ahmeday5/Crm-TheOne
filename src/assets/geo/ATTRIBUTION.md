# Map data

Loaded on demand by the customer map (`/customers/map`). Feature `name` is the join key with the API.

| File | Source | Licence | Join key |
|---|---|---|---|
| `world.geo.json` | Natural Earth 1:110m via [`world-atlas`](https://github.com/topojson/world-atlas) | Public domain | ISO 3166-1 alpha-2 (`EG`) ↔ `MapCountry.iso2` |
| `egypt.geo.json` | [geoBoundaries](https://www.geoboundaries.org) gbOpen EGY ADM1 | CC BY 4.0 | ISO 3166-2 (`EG-C`) ↔ `MapGovernorate.code` |

The basemap underneath (streets, water, place names) is OpenFreeMap vector tiles built from
OpenStreetMap data — free, no API key; its attribution is shown on the map by the style.

Coordinates are rounded (2 / 3 decimals) to keep the files small. Countries too small for the
1:110m set (e.g. Bahrain, Singapore) are drawn as bubbles at the API's `lat` / `lng`.
