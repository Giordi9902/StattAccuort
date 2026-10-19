import type { RouteType } from '@stattaccuort/cities'

import { haversine, type Coordinates } from '../seed/stations/merge-proximate'

/*
 * Pure GTFS → seeded-network mapping for the departures import. Kept free of I/O so the matching
 * rules are testable without a feed or a database.
 */

/** A GTFS stop farther than this from every station of its line is left out. */
export const MAX_STOP_DISTANCE_METERS = 300

// GTFS route_type → the seeded route types it may correspond to. Feeds and OSM disagree on which
// Rail mode a line is (ANM files Trenitalia's L2 as metro, OSM as train), so a rail route may match
// Any seeded rail type; rail names are distinct enough (L1, L2, Cumana) to stay unambiguous.
// Trams aren't seeded.
const RAIL_TYPES: readonly RouteType[] = ['subway', 'suburban', 'train', 'light_rail']
const GTFS_ROUTE_TYPES: Record<string, readonly RouteType[]> = {
    '1': RAIL_TYPES,
    '2': RAIL_TYPES,
    '3': ['bus'],
    '7': ['funicular'],
    '11': ['bus'], // Trolleybus — seeded as bus (see the city's routeTypeAliases).
}

export interface SeededLine {
    id: string
    name: string
    type: RouteType
    /** Station ids in line order. */
    stationIds: string[]
}

/**
 * The seeded line variants a GTFS route runs as: a compatible route type, and the line's display name
 * equals the route's short name (`L1`, `R2`, `151`). Variants of one line share a name, so a
 * route maps to all of them; each trip then picks the variant it actually serves.
 */
export const linesForRoute = (
    route: { routeType: string; shortName: string },
    lines: readonly SeededLine[]
): SeededLine[] => {
    const types: readonly RouteType[] = GTFS_ROUTE_TYPES[route.routeType] ?? []
    const name = route.shortName.trim().toLowerCase()
    return lines.filter((line) => types.includes(line.type) && line.name.toLowerCase() === name)
}

/** `HH:MM:SS` → seconds since the service day's midnight. Hours may exceed 23 (after-midnight runs). */
export const parseGtfsTime = (time: string): number | undefined => {
    const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(time.trim())
    if (!match) return undefined
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

/**
 * Nearest station of `line` to a stop, within MAX_STOP_DISTANCE_METERS. Restricting the search to
 * the line's own stations keeps a bus stop from snapping to a metro station across the street.
 */
export const nearestLineStation = (
    stop: Coordinates,
    line: SeededLine,
    stationCoordinates: ReadonlyMap<string, Coordinates>
): string | undefined => {
    let best: string | undefined
    let bestDistance = MAX_STOP_DISTANCE_METERS
    for (const stationId of line.stationIds) {
        const coordinates = stationCoordinates.get(stationId)
        if (coordinates === undefined) continue
        const distance = haversine(stop, coordinates)
        if (distance <= bestDistance) {
            best = stationId
            bestDistance = distance
        }
    }
    return best
}

export interface TripStop {
    stopId: string
    departureSecs: number
}

export interface MatchedTrip {
    lineId: string
    departures: { stationId: string; departureSecs: number }[]
}

/**
 * Resolve a trip to the candidate variant that matches most of its stops, and its departures
 * from that variant's stations. A station visited twice (a loop) keeps its first departure.
 * Returns undefined when no stop lands on any candidate.
 */
export const matchTrip = (
    stops: readonly TripStop[],
    candidates: readonly SeededLine[],
    resolveStation: (stopId: string, line: SeededLine) => string | undefined
): MatchedTrip | undefined => {
    let best: MatchedTrip | undefined
    for (const line of candidates) {
        const seen = new Set<string>()
        const departures: MatchedTrip['departures'] = []
        for (const stop of stops) {
            const stationId = resolveStation(stop.stopId, line)
            if (stationId === undefined || seen.has(stationId)) continue
            seen.add(stationId)
            departures.push({ stationId, departureSecs: stop.departureSecs })
        }
        if (departures.length > 0 && (best === undefined || departures.length > best.departures.length)) {
            best = { lineId: line.id, departures }
        }
    }
    return best
}

const toDateNumber = (date: Date): number =>
    date.getUTCFullYear() * 10_000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()

const parseDateNumber = (value: string): Date | undefined => {
    const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim())
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : undefined
}

const WEEKDAY_COLUMNS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

/**
 * The dates each service runs on: calendar.txt's weekly pattern over its date range (when the
 * feed has one), plus calendar_dates.txt additions (exception_type 1) minus removals (2).
 */
export const expandServiceDates = (
    calendar: readonly Record<string, string>[],
    calendarDates: readonly Record<string, string>[]
): Map<string, Set<number>> => {
    const byService = new Map<string, Set<number>>()
    const datesOf = (serviceId: string): Set<number> => {
        let dates = byService.get(serviceId)
        if (dates === undefined) {
            dates = new Set()
            byService.set(serviceId, dates)
        }
        return dates
    }

    for (const row of calendar) {
        const start = parseDateNumber(row.start_date)
        const end = parseDateNumber(row.end_date)
        if (start === undefined || end === undefined) continue
        const dates = datesOf(row.service_id)
        for (let day = start; day <= end; day = new Date(day.getTime() + 86_400_000)) {
            if (row[WEEKDAY_COLUMNS[day.getUTCDay()]] === '1') dates.add(toDateNumber(day))
        }
    }

    for (const row of calendarDates) {
        const date = Number(row.date)
        if (!Number.isInteger(date)) continue
        if (row.exception_type === '1') datesOf(row.service_id).add(date)
        else if (row.exception_type === '2') byService.get(row.service_id)?.delete(date)
    }
    return byService
}

/** `VIA DE MARCO` → `Via De Marco`: GTFS stop names are uppercase, the app shows title case. */
export const titleCase = (name: string): string =>
    name
        .toLowerCase()
        .replace(/(^|[\s'(/-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
