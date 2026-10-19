# @stattaccuort/cities

The shared **city registry** — the single source of truth for everything that
differs between the cities Statt’Accuort serves (Napoli).

City is a runtime dimension resolved from the hostname (frontend) or an explicit
`?city=` query param (API). Code stays shared across cities; per-city differences
live here as **data**, never as forked code.

## Constraints

This package is consumed by several toolchains — the Vite frontend build, the
Node API, the Node/Bun seed scripts and the tile build. It is
therefore **dependency-free plain TypeScript data**: no runtime dependencies, no
build step. Consumers import the source directly.

## Usage

```ts
import { CITIES, getCity, DEFAULT_CITY_SLUG } from '@stattaccuort/cities'

const city = getCity(slug) ?? CITIES[DEFAULT_CITY_SLUG]
```

## Shape

See `src/types.ts` for the full `CityConfig`. Each entry carries identity
(`slug`, `subdomain`, `displayName`, `lang`), `map` defaults, basemap `tiles`
inputs, the `seed` pipeline inputs, `timetables` sources and public `community`
channels.
