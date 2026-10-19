/**
 * Live-fetch entry point. Hits Overpass and stores the raw response in the
 * bundled snapshot JSON files under `snapshots/<city>/`. Does not touch seed
 * tables (e.g. stations) — the apply path (`bun db:seed`) reads the bundled
 * snapshots and runs the transforms.
 *
 * Run this manually when the OSM snapshot should be refreshed:
 *   bun db:seed:refresh --city <slug>   (defaults to the registry's default city)
 * Safe to retry — the existing snapshots are left untouched until all new
 * fetches succeed.
 *
 * A city with `seed.gtfsRouteTypes` also gets a `gtfs_network` snapshot built from its GTFS feed.
 * `--gtfs-only` refreshes just that one — minutes, against the hours Overpass can take — for when
 * the operator republishes its feed.
 */

import { parseCityArg } from './city-arg'
// Type-only import: erased at build, so it does not evaluate the Overpass module
// (and its registry-backed config) before SEED_CITY is set below.
import type { OsmElement, OsmRelation } from './stations/overpass'

type OsmSnapshotKind = 'stations' | 'route_geometries' | 'gtfs_network'

const countRouteRelations = (elements: OsmElement[]): number => {
    let count = 0
    for (const el of elements) {
        if (el.type !== 'relation') continue
        const rel = el as OsmRelation
        if ((rel.tags ?? {}).type === 'route') count++
    }
    return count
}

const refresh = async () => {
    const city = parseCityArg()
    // Select the city before importing the Overpass module, which reads the
    // Registry-backed SEED_CONFIG at import time (see ./config).
    process.env.SEED_CITY = city

    const { fetchLineRefs, fetchRouteGeometryElements, fetchStationElements } = await import('./stations/overpass')
    const { GTFS_ROUTE_TYPES } = await import('./config')

    const writeSnapshot = async (kind: OsmSnapshotKind, raw: unknown) => {
        const fileUrl = new URL(`./snapshots/${city}/${kind}.json`, import.meta.url)
        await Bun.write(fileUrl, `${JSON.stringify(raw, null, 2)}\n`)
    }

    // Fetched before Overpass so a broken feed fails fast, but written last with the others.
    const gtfsNetwork = GTFS_ROUTE_TYPES.size > 0 ? await fetchGtfsNetwork() : undefined
    if (process.argv.includes('--gtfs-only')) {
        if (gtfsNetwork === undefined) throw new Error(`'${city}' takes no route types from GTFS (seed.gtfsRouteTypes)`)
        await writeSnapshot('gtfs_network', gtfsNetwork)
        console.log(`[seed:refresh] Wrote 'gtfs_network' snapshot (${gtfsNetwork.length} elements)`)
        return
    }

    console.log(`[seed:refresh] Fetching station elements from Overpass for '${city}'...`)
    const refs = await fetchLineRefs()
    const stationElements = await fetchStationElements(refs)
    console.log(`[seed:refresh] Snapshot includes ${countRouteRelations(stationElements)} route relations.`)

    console.log('[seed:refresh] Fetching route geometry from Overpass...')
    const routeGeometryElements = await fetchRouteGeometryElements(refs)
    console.log(
        `[seed:refresh] Geometry snapshot includes ${countRouteRelations(routeGeometryElements)} route relations.`
    )

    await writeSnapshot('stations', stationElements)
    console.log(`[seed:refresh] Wrote 'stations' snapshot (${stationElements.length} elements)`)

    await writeSnapshot('route_geometries', routeGeometryElements)
    console.log(`[seed:refresh] Wrote 'route_geometries' snapshot (${routeGeometryElements.length} elements)`)

    if (gtfsNetwork !== undefined) {
        await writeSnapshot('gtfs_network', gtfsNetwork)
        console.log(`[seed:refresh] Wrote 'gtfs_network' snapshot (${gtfsNetwork.length} elements)`)
    }
}

const fetchGtfsNetwork = async (): Promise<OsmElement[]> => {
    const { GTFS_ROUTE_ALIASES, GTFS_ROUTE_TYPES, GTFS_URL, isSeedLineIncluded } = await import('./config')
    const { buildGtfsNetwork } = await import('./gtfs/build-network')
    const { readGtfsNetworkInput } = await import('./gtfs/read-feed')
    const { withGtfsFeed } = await import('../timetables/feed')
    if (GTFS_URL === undefined) throw new Error('seed.gtfsRouteTypes is set but the city has no timetables.gtfsUrl')

    const input = await withGtfsFeed(GTFS_URL, (feed) => readGtfsNetworkInput(feed, GTFS_ROUTE_TYPES))
    const elements = buildGtfsNetwork(input, {
        routeTypes: GTFS_ROUTE_TYPES,
        routeAliases: GTFS_ROUTE_ALIASES,
        isIncluded: isSeedLineIncluded,
    })
    console.log(
        `[seed:refresh] GTFS network: ${countRouteRelations(elements)} route directions from ${input.routes.length} routes`
    )
    return elements
}

refresh()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('[seed:refresh] Failed:', error)
        process.exit(1)
    })
