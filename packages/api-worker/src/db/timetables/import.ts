import { getCity, type RouteType } from '@stattaccuort/cities'
import { asc } from 'drizzle-orm'

import { type DbConnection, eavStationBoards, getDb, lines, lineStations, stations } from '../index'
import { applyMigrations } from '../migrate'
import { chunkRowsForInsert } from '../seed/batch'
import { parseCityArg } from '../seed/city-arg'
import { timetableDepartures, timetableServiceDates, timetableTrips } from '../schema/timetables'

import { extractEavLocalita, matchEavStation } from './eav-stations'
import { readCsv, withGtfsFeed, type GtfsFeed } from './feed'
import {
    expandServiceDates,
    linesForRoute,
    MAX_STOP_DISTANCE_METERS,
    matchTrip,
    nearestLineStation,
    parseGtfsTime,
    titleCase,
    type SeededLine,
    type TripStop,
} from './gtfs'

/*
 * Rebuilds a city's departure tables in DATABASE_URL from its timetable sources (see CityTimetables):
 *
 *   bun run timetables:import --city <slug>
 *
 * It maps the sources onto the seeded network, so run it after `bun run seed`, and again whenever
 * the GTFS feed is republished. Each run replaces the four tables wholesale, in one transaction:
 * the API keeps serving the previous timetable until the new one is complete.
 */

interface Coordinates {
    latitude: number
    longitude: number
}

interface Network {
    lines: SeededLine[]
    stationNames: Map<string, string>
    stationCoordinates: Map<string, Coordinates>
}

const loadNetwork = async (db: DbConnection): Promise<Network> => {
    const [stationRows, lineRows, lineStationRows] = await Promise.all([
        db.select({ id: stations.id, name: stations.name, lat: stations.lat, lng: stations.lng }).from(stations),
        db.select({ id: lines.id, name: lines.name, type: lines.type }).from(lines),
        db
            .select({ lineId: lineStations.lineId, stationId: lineStations.stationId })
            .from(lineStations)
            .orderBy(asc(lineStations.lineId), asc(lineStations.order)),
    ])
    const stationIdsByLine = new Map<string, string[]>()
    for (const row of lineStationRows) {
        const list = stationIdsByLine.get(row.lineId) ?? []
        list.push(row.stationId)
        stationIdsByLine.set(row.lineId, list)
    }
    return {
        lines: lineRows.map((line) => ({ ...line, stationIds: stationIdsByLine.get(line.id) ?? [] })),
        stationNames: new Map(stationRows.map((s) => [s.id, s.name])),
        stationCoordinates: new Map(stationRows.map((s) => [s.id, { latitude: s.lat, longitude: s.lng }])),
    }
}

interface TimetableRows {
    serviceDates: [string, number][]
    trips: [string, string, string, string][]
    departures: [string, string, number][]
    boards: [string, string, string][]
}

const importGtfs = async (
    { file, has }: GtfsFeed,
    routeAliases: Readonly<Record<string, string>>,
    network: Network,
    rows: TimetableRows
): Promise<void> => {
    // Routes → candidate line variants.
    const candidatesByRoute = new Map<string, SeededLine[]>()
    const unmatchedRoutes: string[] = []
    await readCsv(file('routes.txt'), (route) => {
        const shortName = routeAliases[route.route_short_name] ?? route.route_short_name
        const candidates = linesForRoute({ routeType: route.route_type, shortName }, network.lines)
        if (candidates.length > 0) candidatesByRoute.set(route.route_id, candidates)
        else unmatchedRoutes.push(`${route.route_short_name} (type ${route.route_type})`)
    })

    const stops = new Map<string, Coordinates & { name: string }>()
    await readCsv(file('stops.txt'), (stop) => {
        stops.set(stop.stop_id, {
            name: stop.stop_name,
            latitude: Number(stop.stop_lat),
            longitude: Number(stop.stop_lon),
        })
    })

    const trips = new Map<string, { routeId: string; serviceId: string; headsign: string }>()
    await readCsv(file('trips.txt'), (trip) => {
        if (!candidatesByRoute.has(trip.route_id)) return
        trips.set(trip.trip_id, { routeId: trip.route_id, serviceId: trip.service_id, headsign: trip.trip_headsign })
    })

    const stopsByTrip = new Map<string, (TripStop & { sequence: number })[]>()
    await readCsv(file('stop_times.txt'), (stopTime) => {
        if (!trips.has(stopTime.trip_id)) return
        const departureSecs = parseGtfsTime(stopTime.departure_time || stopTime.arrival_time)
        if (departureSecs === undefined) return
        const list = stopsByTrip.get(stopTime.trip_id) ?? []
        list.push({ stopId: stopTime.stop_id, departureSecs, sequence: Number(stopTime.stop_sequence) })
        stopsByTrip.set(stopTime.trip_id, list)
    })

    // A stop is resolved once per line variant, not once per trip.
    const stationByStopAndLine = new Map<string, string | null>()
    const resolveStation = (stopId: string, line: SeededLine): string | undefined => {
        const key = `${stopId}|${line.id}`
        let stationId = stationByStopAndLine.get(key)
        if (stationId === undefined) {
            const stop = stops.get(stopId)
            stationId = (stop && nearestLineStation(stop, line, network.stationCoordinates)) ?? null
            stationByStopAndLine.set(key, stationId)
        }
        return stationId ?? undefined
    }

    const usedServices = new Set<string>()
    let unmatchedTrips = 0
    for (const [tripId, trip] of trips) {
        const tripStops = (stopsByTrip.get(tripId) ?? []).sort((a, b) => a.sequence - b.sequence)
        const matched = matchTrip(tripStops, candidatesByRoute.get(trip.routeId) ?? [], resolveStation)
        if (matched === undefined) {
            unmatchedTrips++
            continue
        }
        // Feeds often leave trip_headsign empty (ANM does); the last stop is what riders read.
        const lastStop = stops.get(tripStops[tripStops.length - 1].stopId)
        const headsign = trip.headsign.trim() || (lastStop ? titleCase(lastStop.name.trim()) : '')
        rows.trips.push([tripId, matched.lineId, trip.serviceId, headsign])
        for (const departure of matched.departures)
            rows.departures.push([departure.stationId, tripId, departure.departureSecs])
        usedServices.add(trip.serviceId)
    }

    const calendar: Record<string, string>[] = []
    const calendarDates: Record<string, string>[] = []
    if (has('calendar.txt')) await readCsv(file('calendar.txt'), (row) => calendar.push(row))
    if (has('calendar_dates.txt')) await readCsv(file('calendar_dates.txt'), (row) => calendarDates.push(row))
    for (const [serviceId, dates] of expandServiceDates(calendar, calendarDates)) {
        if (!usedServices.has(serviceId)) continue
        for (const date of dates) rows.serviceDates.push([serviceId, date])
    }

    const unmatchedStops = [...stationByStopAndLine.values()].filter((value) => value === null).length
    console.log(
        `[timetables] GTFS: ${rows.trips.length} trips, ${rows.departures.length} departures, ` +
            `${rows.serviceDates.length} service dates; ${unmatchedTrips} trips on no seeded station, ` +
            `${unmatchedStops} stop/line pairs beyond ${MAX_STOP_DISTANCE_METERS} m`
    )
    if (unmatchedRoutes.length > 0) {
        console.log(`[timetables] GTFS routes with no seeded line (skipped): ${unmatchedRoutes.join(', ')}`)
    }
}

// EAV's own rail lines are the light_rail and train lines; matching boards against just their
// Stations keeps "Garibaldi" from landing on a bus stop of the same name.
const EAV_ROUTE_TYPES: ReadonlySet<RouteType> = new Set(['light_rail', 'train'])

const importEavBoards = async (
    baseUrl: string,
    aliases: Readonly<Record<string, string>>,
    network: Network,
    rows: TimetableRows
): Promise<void> => {
    console.log(`[timetables] Reading the EAV board list from ${baseUrl}...`)
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`GET ${baseUrl} returned ${response.status}`)
    const localita = extractEavLocalita(await response.text())

    const candidateIds = new Set(
        network.lines.filter((line) => EAV_ROUTE_TYPES.has(line.type)).flatMap((l) => l.stationIds)
    )
    const candidates = [...candidateIds].map((id) => ({ id, name: network.stationNames.get(id) ?? '' }))

    const seen = new Set<string>()
    const unmatched = new Set<string>()
    for (const entry of localita) {
        const stationId = matchEavStation(entry.descrizione, candidates, aliases)
        if (stationId === undefined) {
            unmatched.add(`${entry.descrizione} (${entry.idLinea})`)
            continue
        }
        const key = `${stationId}|${entry.codLoc}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.boards.push([stationId, entry.codLoc, entry.touchpoint])
    }
    console.log(
        `[timetables] EAV: ${rows.boards.length} station boards matched, ${unmatched.size} board names unmatched`
    )
    if (unmatched.size > 0) {
        console.log(
            `[timetables] Unmatched EAV boards (add to timetables.eavStationAliases if seeded): ${[...unmatched].join(', ')}`
        )
    }
}

const writeTimetables = (db: DbConnection, rows: TimetableRows): Promise<void> =>
    db.transaction(async (tx) => {
        await tx.delete(timetableDepartures)
        await tx.delete(timetableTrips)
        await tx.delete(timetableServiceDates)
        await tx.delete(eavStationBoards)
        const insert = async <T extends object>(table: Parameters<typeof tx.insert>[0], values: T[]) => {
            for (const batch of chunkRowsForInsert(values, 4)) {
                await tx
                    .insert(table)
                    .values(batch as never)
                    .onConflictDoNothing()
            }
        }
        await insert(
            timetableServiceDates,
            rows.serviceDates.map(([serviceId, date]) => ({ serviceId, date }))
        )
        await insert(
            timetableTrips,
            rows.trips.map(([tripId, lineId, serviceId, headsign]) => ({ tripId, lineId, serviceId, headsign }))
        )
        await insert(
            timetableDepartures,
            rows.departures.map(([stationId, tripId, departureSecs]) => ({ stationId, tripId, departureSecs }))
        )
        await insert(
            eavStationBoards,
            rows.boards.map(([stationId, codLoc, touchpoint]) => ({ stationId, codLoc, touchpoint }))
        )
    })

const importTimetables = async () => {
    const slug = parseCityArg()
    const city = getCity(slug)!
    const { timetables } = city
    if (timetables === undefined) throw new Error(`City "${slug}" has no timetables configured`)

    const db = getDb()
    await applyMigrations(db)
    const network = await loadNetwork(db)
    if (network.lines.length === 0)
        throw new Error(`The ${slug} database has no lines — run \`bun run seed --city ${slug}\` first`)

    const rows: TimetableRows = { serviceDates: [], trips: [], departures: [], boards: [] }
    const { gtfsUrl } = timetables
    if (gtfsUrl !== undefined) {
        await withGtfsFeed(gtfsUrl, (feed) => importGtfs(feed, timetables.gtfsRouteAliases ?? {}, network, rows))
    }
    if (timetables.eavBoardsUrl !== undefined) {
        await importEavBoards(timetables.eavBoardsUrl, timetables.eavStationAliases ?? {}, network, rows)
    }

    await writeTimetables(db, rows)
    console.log('[timetables] Done')
}

importTimetables()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
        console.error('Timetable import failed', error)
        process.exit(1)
    })
