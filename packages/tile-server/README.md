# Statt’Accuort Tile Server

Builds the Statt’Accuort basemap as **static PMTiles files**. There is no running tile
server: an OSM extract is turned into a single `.pmtiles` archive per city, served as a static file
by any web server that supports HTTP range requests and CORS, and read directly by the browser via HTTP
range requests (MapLibre's `pmtiles://` protocol).

Which cities get built is a projection of the shared [`@stattaccuort/cities`](../cities) registry: every
city in it (each carries a `tiles` block with its Geofabrik `osmUrl`). There is no hand-maintained list.

## Layout

- `packages/cities` — the registry; a city's `tiles` block is what makes it buildable here.
- `tilemaker/config-stattaccuort.json` — city-agnostic layer/settings tuning. Per-city identity (name,
  description, schema, `default_view`) is injected by `generate.ts` from the registry.
- `tilemaker/` — Tilemaker config + Lua that map OSM into the basemap layers (city-agnostic).
- `source/stattaccuort-style.json` — the source MapLibre style (the only committed `source/` file).
- `scripts/generate.ts` — download extract → tilemaker → `dist/<city>.pmtiles` + `dist/styles/<city>.json`.
  A city can opt into a crop to its configured `map.bounds` before tile generation (Napoli does),
  keeping its archive focused on the city rather than the whole Southern Italy extract.
- `styles/rewrite-style.ts` — points the style at a city's archive (pure function used by `generate.ts`).
- `styles/serve.ts` — a range-capable static server for local `dist/`.
- `fonts/` — TTF the glyph PBFs would be generated from (unused until the style gets text layers).

## Prerequisites

- Docker (Tilemaker runs in a container)
- Bun

## Local development

```sh
cd packages/tile-server
bun run generate     # all buildable cities in the registry → dist/  (CITY=napoli builds just one)
bun run serve        # serve dist/ with range + CORS on http://localhost:3000
```

Then point the frontend at the local style:

```env
VITE_TILES_BASE_URL=http://localhost:3000
```

`generate` downloads each city's OSM extract into `source/` on first run (cached afterwards). Locally
the style references a flat `/<city>.pmtiles`.

## Publishing

Serve `dist/` from any static web server with range requests and CORS enabled for the app's origins
(Caddy and nginx do range requests out of the box), and point the frontend's `VITE_TILES_BASE_URL`
at it. `styles/rewrite-style.ts` can version the archive path (`/v<sha>/<city>.pmtiles`) so the
archive can be cached as immutable while only `styles/<city>.json` stays short-lived.

## Adding a city

1. Add a `tiles` block to the city's entry in `packages/cities` (`slug` is used in URLs/filenames;
   `osmUrl` is its Geofabrik extract):

   ```ts
   tiles: {
       osmUrl: 'https://download.geofabrik.de/europe/italy/centro-latest.osm.pbf',
       clipToMapBounds: true,
   },
   ```

2. `CITY=<slug> bun run generate` builds `dist/<slug>.pmtiles` + `dist/styles/<slug>.json`
   alongside the existing cities — additive, so other cities' URLs are untouched.

3. Point the relevant frontend deployment at `<tiles base URL>/styles/<slug>.json`. (The
   Tilemaker config is city-agnostic; `generate.ts` injects the per-city name/description/schema from
   the registry, and the archive's `default_view` from the city's `map` center + zoom.)

This is served as a static PMTiles archive (read directly via HTTP range requests) rather than
from a running tile server: the city data barely changes, so a stateful server would be ops cost and a
single point of failure for effectively static content.
