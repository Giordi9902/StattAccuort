// Shared city-registry types. Dependency-free plain TS so this package can be
// consumed unchanged by every toolchain in the monorepo (Vite build, the Node API,
// the seed scripts and the tile build). Do not import runtime dependencies here.

/**
 * The transit route types the pipeline understands, in no particular order. All but `suburban` are
 * OSM `route` values; `suburban` (a suburban rail service riders tell apart from the other trains)
 * is only ever assigned through `routeTypeOverrides`.
 */
export const ROUTE_TYPES = ['subway', 'suburban', 'tram', 'light_rail', 'train', 'funicular', 'bus'] as const

export type RouteType = (typeof ROUTE_TYPES)[number]

/** `[longitude, latitude]` — GeoJSON/MapLibre order. */
export type LngLat = readonly [number, number]

/** `[west, south, east, north]` — GeoJSON bbox order. */
export type BBox = readonly [number, number, number, number]

/**
 * City-specific seed configuration. The pipeline-global tuning (Overpass
 * endpoint, merge threshold, geometry tolerance) is intentionally NOT here — it
 * doesn't vary by city and lives with the seed pipeline.
 */
export interface CitySeedConfig {
    /**
     * OSM `admin_level` regex identifying the city boundary relation. Usually
     * 4–6 for a city-sized boundary.
     */
    adminLevel: string
    /**
     * OSM `operator` tag values whose route relations should be seeded.
     * Filtering by operator keeps the query focused without coupling the
     * pipeline to a hand-maintained list of line refs that drifts whenever the
     * network changes.
     */
    operators: readonly string[]
    /**
     * Optional operational area for the seeded stop set. Route relations remain
     * intact so their geometry and stop ordering come from one OSM snapshot.
     */
    stationBounds?: BBox
    /**
     * Route types ordered most-to-least prioritized — used to pick a single
     * "highest" route type when a station is served by several. Also the set of
     * OSM `route` values to include.
     */
    routeTypePriority: readonly [RouteType, ...RouteType[]]
    /**
     * Optional per-route-type regex a line's `ref` must match to be seeded.
     * Route types absent from this map include every ref. Used when an operator
     * also runs lines that shouldn't be seeded (Naples: ANM Linea 6, Trenitalia
     * long-distance trains alongside the metro lines).
     */
    routeRefPatterns?: Partial<Record<RouteType, string>>
    /**
     * Optional per-route-type narrowing of `operators`. A route type listed here
     * only seeds relations whose `operator` is in its list; other types accept
     * every configured operator. Needed when an operator seeded for one mode also
     * runs another we don't want (Naples: EAV's rail lines are in, its buses are not).
     */
    routeTypeOperators?: Partial<Record<RouteType, readonly string[]>>
    /**
     * Optional OSM `route` values to seed as one of the known route types. The
     * pipeline queries them alongside `routeTypePriority` and rewrites the tag on
     * arrival, so everything downstream sees only known types (Naples:
     * `trolleybus` → `bus`).
     */
    routeTypeAliases?: Readonly<Record<string, RouteType>>
    /**
     * Optional per-line route type, keyed by the type OSM gives the line, then its `ref`: moves a
     * single line into another category than its OSM tag (Naples: Trenitalia's Linea 2, tagged
     * `train` like EAV's Cumana, becomes `suburban`). Applied when seeding, so snapshots keep the
     * OSM type and `routeRefPatterns`, `lineIds` and `lineNames` are keyed by the OSM type too.
     */
    routeTypeOverrides?: Partial<Record<RouteType, Readonly<Record<string, RouteType>>>>
    /**
     * Route types listed here always get the configured color regardless of the
     * OSM relation tags (e.g. one shared color for every tram line). Route types
     * absent from this map fall back to
     * the OSM colour/color tag — best for subway lines with per-line branding.
     */
    colors: Partial<Record<RouteType, string>>
    /**
     * Fallback color when neither a configured route color nor an OSM
     * colour/color tag is available. Mirrors the DB default on `lines.color`.
     */
    defaultLineColor: string
    excludeLineRefPatterns?: readonly string[]
    /**
     * Optional display names keyed by route type, then OSM `ref`. The ref still
     * forms the line id; only `lines.name` changes. Keyed per type because a ref can
     * be reused across route types (Naples has an EAV train `7` and a Circumvesuviana `7`).
     */
    lineNames?: Partial<Record<RouteType, Readonly<Record<string, string>>>>
    /**
     * Optional line id bases keyed by route type, then OSM `ref`, for refs whose
     * bare form is already taken by another route type (Naples: the EAV train `7`
     * becomes `L7` next to the Circumvesuviana `7`). Unlisted refs keep the ref as
     * their id, so existing line ids — and the reports pointing at them — never move.
     */
    lineIds?: Partial<Record<RouteType, Readonly<Record<string, string>>>>
    /**
     * Optional route types whose lines come from the city's GTFS feed (`timetables.gtfsUrl`)
     * instead of OSM: stops, stop order and shapes are the operator's own. For a network OSM maps
     * only patchily (Naples' buses). These types drop out of the Overpass queries; every other
     * filter here (`routeRefPatterns`, `routeTypeOperators`, `lineIds`, `lineNames`) still applies,
     * with the agency name as the operator and the route's short name as the ref.
     */
    gtfsRouteTypes?: readonly RouteType[]
    /**
     * Optional OSM station node ids to add to a line, keyed by route type then `ref`: stations OSM
     * maps but leaves out of the line's route relation (Naples: Baia and Pozzuoli on the Cumana).
     * The refresh fetches the nodes; the seed inserts each into every relation of that line where
     * it lengthens the route least.
     */
    extraRouteStations?: Partial<Record<RouteType, Readonly<Record<string, readonly number[]>>>>
}

/**
 * Public community channels surfaced in the app for a city. Only genuinely per-city
 * channels live here — Instagram/GitHub are shared across all cities (one account
 * each) and stay as frontend constants.
 */
export interface CityCommunity {
    /** Telegram group handle reports are synced with (e.g. `@stattaccuort_napoli`). Omit when the city has no group yet. */
    telegramHandle?: string
    reporterCount?: { min: number; max: number }
}

/**
 * Basemap tile-build inputs for a city. Consumed by the tile-server pipeline
 * (packages/tile-server). The archive's suggested view is derived from `map`
 * (center + zoom), so there is no separate view to keep in sync here.
 */
export interface CityTiles {
    /** Geofabrik OSM extract the basemap is built from. */
    osmUrl: string
    /** Crop this regional extract to `map.bounds` before generating the archive. */
    clipToMapBounds?: boolean
}

/** Map defaults for the city's basemap. */
export interface CityMap {
    /** Initial map center. */
    center: LngLat
    /** Initial zoom level. */
    zoom: number
    /** Metro-area extent. Used for optional tile cropping. */
    bounds: BBox
    /** URL of the MapLibre style JSON served by the tile-server. */
    styleUrl: string
}

/**
 * Sources for the station "next departures" panel, imported by `timetables:import` and, for live
 * boards, read on request. A city without this block shows no departures.
 */
export interface CityTimetables {
    /** Static GTFS feed (zip) with the scheduled departures of the seeded lines. */
    gtfsUrl?: string
    /**
     * Base URL of EAV's live departure boards (orariotreni.eavsrl.it). Its home page lists the
     * boards per station; `teleindicatori/ws_getData_moova.php` returns one board's departures.
     */
    eavBoardsUrl?: string
    /**
     * EAV board names (`descrizione`) the importer can't match to a seeded station by name,
     * mapped to the station's name as seeded.
     */
    eavStationAliases?: Readonly<Record<string, string>>
    /** GTFS route_short_name values that differ from the seeded line name, mapped to that name. */
    gtfsRouteAliases?: Readonly<Record<string, string>>
}

/**
 * A single city's complete configuration. City is a runtime dimension resolved
 * from the hostname (or an explicit `?city=` param on the API); this registry is
 * the single source of truth for everything that differs between cities.
 */
export interface CityConfig {
    /** Stable identifier used as the registry key and the API `?city=` value. */
    slug: string
    /** Subdomain the city is served from (`<subdomain>.stattaccuort.it`). */
    subdomain: string
    /** Human-readable name shown in the UI. */
    displayName: string
    /** Canonical web app origin used in links for this city. */
    publicAppUrl: string
    listed?: boolean
    /** BCP-47 language tag for the city's primary language. */
    lang: string
    /**
     * Local names for the line-type filter tabs, e.g. Naples' "Circumvesuviana" rather than a
     * generic "light rail". Types absent here fall back to the app's translated labels.
     */
    lineTypeLabels?: Partial<Record<RouteType, string>>
    /** IANA timezone used to bucket reports into local service hours. */
    timezone: string
    map: CityMap
    /** Basemap tile-build inputs. Every city ships with a basemap. */
    tiles: CityTiles
    seed: CitySeedConfig
    community: CityCommunity
    timetables?: CityTimetables
}
