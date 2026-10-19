// Seed configuration. City-specific inputs (operators, admin level, colors,
// Route-type priority) come from the shared `@stattaccuort/cities` registry; the
// Pipeline-global tuning below (Overpass endpoint, merge threshold, geometry
// Tolerance) doesn't vary by city and stays here with the pipeline.

import { DEFAULT_CITY_SLUG, getCity, isExcludedLineRef, type CityConfig, type RouteType } from '@stattaccuort/cities'

// The seed pipeline runs as a single-city process. The city is selected via the
// SEED_CITY env var (the seed entry points set it from their `--city` flag),
// Defaulting to the registry's default city, and resolved once here so every transform
// Reads the constants below for that one city. In the Worker bundle SEED_CITY is unset.
const SEED_CITY_SLUG = process.env.SEED_CITY ?? DEFAULT_CITY_SLUG

const CITY: CityConfig = (() => {
    const city = getCity(SEED_CITY_SLUG)
    if (!city) {
        throw new Error(`Unknown SEED_CITY="${SEED_CITY_SLUG}" — not in the @stattaccuort/cities registry`)
    }
    return city
})()

/** Slug of the city this seed run targets — used to namespace snapshots per city. */
export const SEED_CITY = CITY.slug

export type { RouteType }

export const ROUTE_TYPE_PRIORITY = CITY.seed.routeTypePriority
export const ROUTE_REF_PATTERNS: Partial<Record<RouteType, string>> = CITY.seed.routeRefPatterns ?? {}
export const ROUTE_TYPE_OPERATORS: Partial<Record<RouteType, readonly string[]>> = CITY.seed.routeTypeOperators ?? {}
export const ROUTE_TYPE_ALIASES: Readonly<Record<string, RouteType>> = CITY.seed.routeTypeAliases ?? {}
/** Route types built from the city's GTFS feed rather than OSM (see `CitySeedConfig.gtfsRouteTypes`). */
export const GTFS_ROUTE_TYPES: ReadonlySet<RouteType> = new Set(CITY.seed.gtfsRouteTypes ?? [])
/** The GTFS feed those route types come from; required when any are configured. */
export const GTFS_URL: string | undefined = CITY.timetables?.gtfsUrl
/** GTFS short name → the ref it is seeded under (e.g. ANM's `ALIB` → `Alibus`). */
export const GTFS_ROUTE_ALIASES: Readonly<Record<string, string>> = CITY.timetables?.gtfsRouteAliases ?? {}
const ROUTE_TYPE_OVERRIDES: Partial<Record<RouteType, Readonly<Record<string, RouteType>>>> =
    CITY.seed.routeTypeOverrides ?? {}
// Types only ever assigned by an override: no OSM relation carries them.
const OVERRIDE_ONLY_TYPES: ReadonlySet<RouteType> = new Set(
    Object.values(ROUTE_TYPE_OVERRIDES).flatMap((byRef) => Object.values(byRef ?? {}))
)

/** The route type a line is seeded as: the city's per-line override, else its OSM type. */
export const resolveRouteType = (osmType: RouteType, ref: string | undefined): RouteType =>
    (ref !== undefined ? ROUTE_TYPE_OVERRIDES[osmType]?.[ref] : undefined) ?? osmType

/**
 * Every OSM `route` value the Overpass queries ask for: the seeded types plus their aliases, minus
 * the types (and aliases of types) that come from GTFS or only from overrides.
 */
export const QUERY_ROUTE_TYPES: readonly string[] = [
    ...ROUTE_TYPE_PRIORITY.filter((type) => !GTFS_ROUTE_TYPES.has(type) && !OVERRIDE_ONLY_TYPES.has(type)),
    ...Object.entries(ROUTE_TYPE_ALIASES)
        .filter(([, type]) => !GTFS_ROUTE_TYPES.has(type))
        .map(([alias]) => alias),
]
/** Station node ids added to lines whose OSM relations leave them out (see `CitySeedConfig.extraRouteStations`). */
export const EXTRA_ROUTE_STATIONS: Partial<Record<RouteType, Readonly<Record<string, readonly number[]>>>> =
    CITY.seed.extraRouteStations ?? {}
export const ROUTE_COLORS: Partial<Record<RouteType, string>> = CITY.seed.colors
export const DEFAULT_LINE_COLOR = CITY.seed.defaultLineColor

/*
 * Three independent filters, all city config:
 * - `excludeLineRefPatterns` blacklists refs regardless of route type (e.g.
 *   replacement or night services).
 * - `routeRefPatterns` whitelists refs per route type (Naples seeds only refs
 *   2, 4 and 5 among trains, dropping the EAV train 7). It has to be per type: a
 *   type-agnostic blacklist can't express "numeric bus refs out, numeric tram
 *   refs in".
 * - `routeTypeOperators` narrows the operators per route type (Naples seeds
 *   only ANM's buses, not EAV's).
 * Reads the relation's `ref`, `route` and `operator` tags; a missing `route`
 * still gets the blacklist.
 */
export const isSeedLineIncluded = (tags: Readonly<Record<string, string | undefined>>): boolean => {
    const { ref = '', route: routeType, operator } = tags
    if (isExcludedLineRef(ref, CITY.seed.excludeLineRefPatterns)) return false
    if (routeType === undefined) return true
    const operators = ROUTE_TYPE_OPERATORS[routeType as RouteType]
    if (operators !== undefined && (operator === undefined || !operators.includes(operator))) return false
    const pattern = ROUTE_REF_PATTERNS[routeType as RouteType]
    return pattern === undefined || new RegExp(pattern).test(ref)
}

/** Rewrites an aliased OSM `route` tag (e.g. `trolleybus`) to the route type it is seeded as. */
export const normalizeRouteTag = (tags: Record<string, string | undefined> | undefined): void => {
    const alias = tags?.route !== undefined ? ROUTE_TYPE_ALIASES[tags.route] : undefined
    if (tags && alias !== undefined) tags.route = alias
}

export const resolveLineName = (ref: string, routeType: RouteType): string =>
    CITY.seed.lineNames?.[routeType]?.[ref] ?? ref

/** The `lines.id` base (before any variant suffix) for a ref: the city's override, else the ref. */
export const resolveLineIdBase = (ref: string, routeType: RouteType): string =>
    CITY.seed.lineIds?.[routeType]?.[ref] ?? ref

// Resolves the canonical color for an OSM route relation: configured route-type
// Color first, then the OSM colour/color tag, then the default. Color is a line
// Property; segments inherit it from their line.
export const resolveLineColor = (tags: Record<string, string | undefined>): string => {
    const routeType = tags.route !== undefined ? resolveRouteType(tags.route as RouteType, tags.ref) : undefined
    const configured = routeType ? ROUTE_COLORS[routeType] : undefined
    if (configured !== undefined) return configured

    const explicit = tags.colour ?? tags.color
    return explicit !== undefined && explicit !== '' ? explicit : DEFAULT_LINE_COLOR
}

export const SEED_CONFIG = {
    city: CITY.displayName,
    adminLevel: CITY.seed.adminLevel,
    operators: CITY.seed.operators,
    stationBounds: CITY.seed.stationBounds,
    routeTypes: QUERY_ROUTE_TYPES,

    // The Overpass API configuration.
    overpass: {
        url: 'https://overpass-api.de/api/interpreter',
        timeoutSeconds: 180,
        fetchTimeoutMs: 200_000,
    },

    mergeThresholdMeters: 250, // The threshold in meters for merging proximate stations.
    geometrySimplificationTolerance: 0.00003, // Approx. 3m in latitude; keeps endpoints while reducing vertex count.
    routeColors: ROUTE_COLORS,
} as const
