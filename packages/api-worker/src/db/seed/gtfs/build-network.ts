import type { RouteType } from '@stattaccuort/cities'

import { titleCase } from '../../timetables/gtfs'
import type { OsmElement, OsmNode, OsmRelation, OsmWay } from '../stations/overpass'

/*
 * Turns a GTFS feed into OSM-shaped elements — a platform node per stop, a route relation per line
 * direction, a way carrying its shape — so the seed pipeline (station merge, variants, segments)
 * runs on them unchanged. Pure: the feed is read by ./read-feed.
 *
 * Element ids are negative, which keeps them clear of every real OSM id they sit next to. Station
 * ids come from the stop ids instead (`gtfs-<stop_id>`), through the node's `ref`.
 */

export interface GtfsRoute {
    routeId: string
    agencyId: string
    shortName: string
    longName: string
    routeType: string
    color: string
}

export interface GtfsTrip {
    tripId: string
    routeId: string
    directionId: string
    shapeId: string
}

export interface GtfsStop {
    name: string
    lat: number
    lon: number
}

export interface GtfsNetworkInput {
    /** agency_id → agency_name. */
    agencies: ReadonlyMap<string, string>
    routes: readonly GtfsRoute[]
    trips: readonly GtfsTrip[]
    /** trip_id → its stop ids in stop_sequence order. */
    stopSequences: ReadonlyMap<string, readonly string[]>
    stops: ReadonlyMap<string, GtfsStop>
    /** shape_id → its points in shape_pt_sequence order. */
    shapes: ReadonlyMap<string, readonly { lat: number; lon: number }[]>
}

export interface GtfsNetworkOptions {
    routeTypes: ReadonlySet<RouteType>
    /** GTFS short name → seeded ref. */
    routeAliases: Readonly<Record<string, string>>
    /** The seed's line filter, applied to the relation tags each route would get. */
    isIncluded: (tags: Readonly<Record<string, string | undefined>>) => boolean
}

const STATION_ID_MAX_LENGTH = 16

/** GTFS route_type (basic and extended) → seeded route type, for the modes a city may take from GTFS. */
export const gtfsRouteType = (routeType: string): RouteType | undefined => {
    const code = Number(routeType)
    if (code === 3 || code === 11 || (code >= 700 && code < 900)) return 'bus'
    if (code === 0 || (code >= 900 && code < 1000)) return 'tram'
    if (code === 7 || code === 1400) return 'funicular'
    return undefined
}

/** `PADULA _ PICCOLA LURDES` → `Padula - Piccola Lurdes`. */
export const gtfsStopName = (name: string): string =>
    titleCase(
        name
            .replace(/\s*_\s*/g, ' - ')
            .replace(/\s+/g, ' ')
            .trim()
    )

export const gtfsStationId = (stopId: string): string => {
    const id = `gtfs-${stopId}`
    if (id.length > STATION_ID_MAX_LENGTH) {
        throw new Error(
            `[seed:gtfs] Station id "${id}" exceeds ${STATION_ID_MAX_LENGTH} chars (stations.id column width)`
        )
    }
    return id
}

const round = (value: number): number => Math.round(value * 1e6) / 1e6

interface Pattern {
    stopIds: readonly string[]
    trips: number
    shapeTrips: Map<string, number>
}

/**
 * The stop pattern a direction of a route usually runs: the one most of its trips follow, the
 * longer one on a tie. Short workings and depot runs are the minority by trip count.
 */
const dominantPatterns = (trips: readonly GtfsTrip[], stopSequences: GtfsNetworkInput['stopSequences']): Pattern[] => {
    const byDirection = new Map<string, Map<string, Pattern>>()
    for (const trip of trips) {
        const stopIds = stopSequences.get(trip.tripId)
        if (stopIds === undefined || stopIds.length < 2) continue
        const patterns = byDirection.get(trip.directionId) ?? new Map<string, Pattern>()
        byDirection.set(trip.directionId, patterns)
        const key = stopIds.join('|')
        const pattern = patterns.get(key) ?? { stopIds, trips: 0, shapeTrips: new Map() }
        patterns.set(key, pattern)
        pattern.trips++
        if (trip.shapeId !== '') pattern.shapeTrips.set(trip.shapeId, (pattern.shapeTrips.get(trip.shapeId) ?? 0) + 1)
    }

    const out: Pattern[] = []
    for (const directionId of [...byDirection.keys()].sort()) {
        const patterns = [...byDirection.get(directionId)!.values()]
        out.push(
            patterns.reduce((best, p) =>
                p.trips > best.trips || (p.trips === best.trips && p.stopIds.length > best.stopIds.length) ? p : best
            )
        )
    }
    return out
}

const mostUsedShape = (pattern: Pattern): string | undefined =>
    [...pattern.shapeTrips.entries()].reduce<[string, number] | undefined>(
        (best, entry) => (best === undefined || entry[1] > best[1] ? entry : best),
        undefined
    )?.[0]

export const buildGtfsNetwork = (input: GtfsNetworkInput, options: GtfsNetworkOptions): OsmElement[] => {
    const tripsByRoute = new Map<string, GtfsTrip[]>()
    for (const trip of input.trips) {
        const list = tripsByRoute.get(trip.routeId) ?? []
        list.push(trip)
        tripsByRoute.set(trip.routeId, list)
    }
    const [defaultAgency = ''] = input.agencies.values()

    const nodes = new Map<string, OsmNode>()
    const ways: OsmWay[] = []
    const relations: OsmRelation[] = []

    const nodeFor = (stopId: string): OsmNode | undefined => {
        const existing = nodes.get(stopId)
        if (existing !== undefined) return existing
        const stop = input.stops.get(stopId)
        if (stop === undefined || stop.name.trim() === '') return undefined
        const node: OsmNode = {
            type: 'node',
            id: -(nodes.size + 1),
            lat: round(stop.lat),
            lon: round(stop.lon),
            tags: { public_transport: 'platform', name: gtfsStopName(stop.name), ref: gtfsStationId(stopId) },
        }
        nodes.set(stopId, node)
        return node
    }

    for (const route of input.routes) {
        const type = gtfsRouteType(route.routeType)
        if (type === undefined || !options.routeTypes.has(type)) continue

        const ref = options.routeAliases[route.shortName] ?? route.shortName
        const tags: Record<string, string> = {
            type: 'route',
            route: type,
            ref,
            name: route.longName !== '' ? route.longName : ref,
            operator: input.agencies.get(route.agencyId) ?? defaultAgency,
        }
        // Feeds that don't brand their lines leave route_color white or empty; let the city default apply.
        const color = route.color.toUpperCase()
        if (/^[0-9A-F]{6}$/.test(color) && color !== 'FFFFFF') tags.colour = `#${color}`
        if (!options.isIncluded(tags)) continue

        for (const pattern of dominantPatterns(tripsByRoute.get(route.routeId) ?? [], input.stopSequences)) {
            const stopNodes = pattern.stopIds.map(nodeFor).filter((node) => node !== undefined)
            if (stopNodes.length < 2) continue

            const shapeId = mostUsedShape(pattern)
            const shape = shapeId !== undefined ? input.shapes.get(shapeId) : undefined
            // Without a shape the line is drawn stop to stop, which still beats leaving it off the map.
            const geometry =
                shape !== undefined && shape.length >= 2
                    ? shape.map((point) => ({ lat: round(point.lat), lon: round(point.lon) }))
                    : stopNodes.map((node) => ({ lat: node.lat, lon: node.lon }))
            const way: OsmWay = { type: 'way', id: -(ways.length + 1), geometry }
            ways.push(way)

            relations.push({
                type: 'relation',
                id: -(relations.length + 1),
                tags,
                members: [
                    ...stopNodes.map((node) => ({ type: 'node' as const, ref: node.id, role: 'platform' })),
                    { type: 'way', ref: way.id, role: '' },
                ],
            })
        }
    }

    return [...nodes.values(), ...ways, ...relations]
}
