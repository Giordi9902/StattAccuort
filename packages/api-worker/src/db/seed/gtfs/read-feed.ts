import type { RouteType } from '@stattaccuort/cities'

import { readCsv, type GtfsFeed } from '../../timetables/feed'

import { gtfsRouteType, type GtfsNetworkInput, type GtfsRoute, type GtfsTrip } from './build-network'

/**
 * Read what buildGtfsNetwork needs from an unpacked feed. Only the trips of routes of
 * `routeTypes` are kept, so stop_times.txt (the bulk of the feed) is held for those alone.
 */
export const readGtfsNetworkInput = async (
    { file, has }: GtfsFeed,
    routeTypes: ReadonlySet<RouteType>
): Promise<GtfsNetworkInput> => {
    const agencies = new Map<string, string>()
    if (has('agency.txt')) {
        await readCsv(file('agency.txt'), (row) => agencies.set(row.agency_id, row.agency_name))
    }

    const routes: GtfsRoute[] = []
    await readCsv(file('routes.txt'), (row) => {
        const type = gtfsRouteType(row.route_type)
        if (type === undefined || !routeTypes.has(type)) return
        routes.push({
            routeId: row.route_id,
            agencyId: row.agency_id,
            shortName: row.route_short_name.trim(),
            longName: row.route_long_name.trim(),
            routeType: row.route_type,
            color: row.route_color.trim(),
        })
    })
    const routeIds = new Set(routes.map((route) => route.routeId))

    const trips: GtfsTrip[] = []
    await readCsv(file('trips.txt'), (row) => {
        if (!routeIds.has(row.route_id)) return
        trips.push({ tripId: row.trip_id, routeId: row.route_id, directionId: row.direction_id, shapeId: row.shape_id })
    })
    const tripIds = new Set(trips.map((trip) => trip.tripId))

    const stopTimes = new Map<string, [number, string][]>()
    await readCsv(file('stop_times.txt'), (row) => {
        if (!tripIds.has(row.trip_id)) return
        const list = stopTimes.get(row.trip_id) ?? []
        list.push([Number(row.stop_sequence), row.stop_id])
        stopTimes.set(row.trip_id, list)
    })
    const stopSequences = new Map<string, string[]>()
    for (const [tripId, list] of stopTimes) {
        stopSequences.set(
            tripId,
            list.sort((a, b) => a[0] - b[0]).map(([, stopId]) => stopId)
        )
    }

    const stops = new Map<string, { name: string; lat: number; lon: number }>()
    await readCsv(file('stops.txt'), (row) => {
        stops.set(row.stop_id, { name: row.stop_name, lat: Number(row.stop_lat), lon: Number(row.stop_lon) })
    })

    const shapePoints = new Map<string, [number, { lat: number; lon: number }][]>()
    if (has('shapes.txt')) {
        await readCsv(file('shapes.txt'), (row) => {
            const list = shapePoints.get(row.shape_id) ?? []
            list.push([Number(row.shape_pt_sequence), { lat: Number(row.shape_pt_lat), lon: Number(row.shape_pt_lon) }])
            shapePoints.set(row.shape_id, list)
        })
    }
    const shapes = new Map<string, { lat: number; lon: number }[]>()
    for (const [shapeId, list] of shapePoints) {
        shapes.set(
            shapeId,
            list.sort((a, b) => a[0] - b[0]).map(([, point]) => point)
        )
    }

    return { agencies, routes, trips, stopSequences, stops, shapes }
}
