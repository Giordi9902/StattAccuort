import type { CityConfig } from '@stattaccuort/cities'
import { and, between, eq, inArray, or } from 'drizzle-orm'
import { DateTime } from 'luxon'

import { DbConnection, eavStationBoards, timetableDepartures, timetableServiceDates, timetableTrips } from '../../db'

import { EAV_BOARD_PATH, parseEavBoard, stationNamesEquivalent, type EavBoardRow } from './eav-board'
import { cachedReference, type CacheCtx } from './reference-cache'
import type { TransitNetworkDataService } from './transit-network-data-service'
import type { Line, Lines, Stations } from './types'

export type Departure = {
    lineId: string | null
    lineName: string
    destination: string
    /** Scheduled departure, ISO 8601 with the city's offset. */
    time: string
    /** Minutes late per the live board; null for scheduled data or an on-time train. */
    delayMinutes: number | null
    source: 'schedule' | 'live'
    platform: string | null
}

export type DeparturesResponse = {
    departures: Departure[]
    /** No timetable source covers this station at all — as opposed to nothing departing soon. */
    unavailable: boolean
}

/** How far ahead the panel looks. */
export const DEPARTURES_WINDOW_SECONDS = 90 * 60
const PER_LINE_DIRECTION = 3
const MAX_DEPARTURES = 12
const DAY_SECONDS = 86_400
// A board time this far behind "now" is read as tomorrow's (the board wraps past midnight).
const BOARD_WRAP_SECONDS = 6 * 3600
const EAV_BOARD_CACHE_SECONDS = 30

const toDateNumber = (date: DateTime): number => date.year * 10_000 + date.month * 100 + date.day

const effectiveTime = (departure: Departure): number =>
    Date.parse(departure.time) + (departure.delayMinutes ?? 0) * 60_000

// EAV boards are uppercase ("NAPOLI PORTA NOLANA"); keep short dotted abbreviations readable.
const titleCaseBoard = (name: string): string =>
    name
        .toLowerCase()
        .replace(/(^|[\s'(/.-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())

export class DeparturesService {
    constructor(
        private db: DbConnection,
        private transitNetworkDataService: TransitNetworkDataService,
        private city: CityConfig,
        private cacheCtx: CacheCtx = undefined,
        private fetchImpl: (input: URL, init: RequestInit) => Promise<Response> = (input, init) => fetch(input, init)
    ) {}

    /**
     * Scheduled (GTFS) and live (EAV board) departures from a station in the next 90 minutes.
     * A failing live board is reported through `onSourceError` and contributes nothing, so one
     * flaky upstream never takes the scheduled departures down with it.
     */
    async getDepartures(
        stationId: string,
        onSourceError: (error: unknown) => void,
        now: DateTime = DateTime.now()
    ): Promise<DeparturesResponse> {
        const localNow = now.setZone(this.city.timezone)
        const [lines, stations, boards] = await Promise.all([
            this.transitNetworkDataService.getLines(),
            this.transitNetworkDataService.getStations(),
            this.db.select().from(eavStationBoards).where(eq(eavStationBoards.stationId, stationId)),
        ])
        const linesById = new Map(lines.map((line) => [line.id, line]))

        const scheduled = await this.scheduledDepartures(stationId, localNow, linesById)
        const live = await Promise.all(
            boards.map(async (board) => {
                try {
                    const rows = await this.boardRows(board.codLoc, board.touchpoint)
                    return this.liveDepartures(rows, stationId, localNow, lines, stations)
                } catch (error) {
                    onSourceError(error)
                    return []
                }
            })
        )

        const departures = [...scheduled, ...live.flat()]
            .sort((a, b) => effectiveTime(a) - effectiveTime(b))
            .slice(0, MAX_DEPARTURES)
        const unavailable = boards.length === 0 && scheduled.length === 0 && !(await this.hasSchedule(stationId))
        return { departures, unavailable }
    }

    private async scheduledDepartures(
        stationId: string,
        localNow: DateTime,
        linesById: ReadonlyMap<string, Line>
    ): Promise<Departure[]> {
        const today = localNow.startOf('day')
        const yesterday = today.minus({ days: 1 })
        const nowSecs = Math.floor(localNow.diff(today, 'seconds').seconds)
        const todayNumber = toDateNumber(today)
        const yesterdayNumber = toDateNumber(yesterday)

        // Yesterday's service still runs after midnight, with times past 24:00 (e.g. 25:10).
        const rows = await this.db
            .select({
                departureSecs: timetableDepartures.departureSecs,
                lineId: timetableTrips.lineId,
                headsign: timetableTrips.headsign,
                date: timetableServiceDates.date,
            })
            .from(timetableDepartures)
            .innerJoin(timetableTrips, eq(timetableTrips.tripId, timetableDepartures.tripId))
            .innerJoin(
                timetableServiceDates,
                and(
                    eq(timetableServiceDates.serviceId, timetableTrips.serviceId),
                    inArray(timetableServiceDates.date, [todayNumber, yesterdayNumber])
                )
            )
            .where(
                and(
                    eq(timetableDepartures.stationId, stationId),
                    or(
                        and(
                            eq(timetableServiceDates.date, todayNumber),
                            between(timetableDepartures.departureSecs, nowSecs, nowSecs + DEPARTURES_WINDOW_SECONDS)
                        ),
                        and(
                            eq(timetableServiceDates.date, yesterdayNumber),
                            between(
                                timetableDepartures.departureSecs,
                                nowSecs + DAY_SECONDS,
                                nowSecs + DAY_SECONDS + DEPARTURES_WINDOW_SECONDS
                            )
                        )
                    )
                )
            )

        const perLineDirection = new Map<string, number>()
        const departures: Departure[] = []
        for (const row of rows
            .map((r) => ({ ...r, at: (r.date === todayNumber ? today : yesterday).plus({ seconds: r.departureSecs }) }))
            .sort((a, b) => a.at.toMillis() - b.at.toMillis())) {
            const key = `${row.lineId}|${row.headsign}`
            const count = perLineDirection.get(key) ?? 0
            if (count >= PER_LINE_DIRECTION) continue
            perLineDirection.set(key, count + 1)
            departures.push({
                lineId: row.lineId,
                lineName: linesById.get(row.lineId)?.name ?? row.lineId,
                destination: row.headsign,
                time: row.at.toISO() ?? '',
                delayMinutes: null,
                source: 'schedule',
                platform: null,
            })
        }
        return departures
    }

    private async hasSchedule(stationId: string): Promise<boolean> {
        const rows = await this.db
            .select({ stationId: timetableDepartures.stationId })
            .from(timetableDepartures)
            .where(eq(timetableDepartures.stationId, stationId))
            .limit(1)
        return rows.length > 0
    }

    /** One board's rows, shared across requests for 30 s so a busy station costs EAV one call. */
    private async boardRows(codLoc: string, touchpoint: string): Promise<EavBoardRow[]> {
        const baseUrl = this.city.timetables?.eavBoardsUrl
        if (baseUrl === undefined) return []
        return cachedReference(
            this.city.slug,
            `eav-board/${codLoc}`,
            async () => {
                const response = await this.fetchImpl(new URL(EAV_BOARD_PATH, baseUrl), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        tipoLista: 'P',
                        codLoc,
                        touchpoint,
                        visualizzazione: 'mobile',
                    }).toString(),
                    signal: AbortSignal.timeout(5_000),
                })
                if (!response.ok) throw new Error(`EAV board ${codLoc} returned ${response.status}`)
                return parseEavBoard(await response.text())
            },
            this.cacheCtx,
            EAV_BOARD_CACHE_SECONDS
        )
    }

    private liveDepartures(
        rows: readonly EavBoardRow[],
        stationId: string,
        localNow: DateTime,
        lines: Lines,
        stations: Stations
    ): Departure[] {
        // The board names no line. Attribute a train to the serving line whose stations best cover
        // Its destination and listed stops; a tie (e.g. two CV branches sharing the trunk) or no
        // Overlap at all leaves it unattributed rather than guessing.
        const servingLines = lines.filter((line) => line.stations.includes(stationId))
        const stationNames = new Map(
            servingLines.map((line) => [
                line.id,
                line.stations.map((id) => (Object.hasOwn(stations, id) ? stations[id].name : '')),
            ])
        )
        const lineFor = (row: EavBoardRow): Line | undefined => {
            const places = [row.destination, ...row.stops]
            let best: Line | undefined
            let bestScore = 0
            let tied = false
            for (const line of servingLines) {
                const names = stationNames.get(line.id) ?? []
                const score = places.filter((place) => names.some((name) => stationNamesEquivalent(name, place))).length
                if (score > bestScore) {
                    best = line
                    bestScore = score
                    tied = false
                } else if (score === bestScore && score > 0) {
                    tied = true
                }
            }
            return tied ? undefined : best
        }

        const departures: Departure[] = []
        for (const row of rows) {
            const [hours, minutes] = row.time.split(':').map(Number)
            let at = localNow.startOf('day').set({ hour: hours, minute: minutes })
            if (at.diff(localNow, 'seconds').seconds < -BOARD_WRAP_SECONDS) at = at.plus({ days: 1 })
            const expected = at.plus({ minutes: row.delayMinutes ?? 0 })
            // The board keeps a train listed for a moment after it has left.
            if (expected < localNow.minus({ minutes: 1 })) continue
            if (expected.diff(localNow, 'seconds').seconds > DEPARTURES_WINDOW_SECONDS) continue
            const line = lineFor(row)
            departures.push({
                lineId: line?.id ?? null,
                lineName: line?.name ?? '',
                destination: titleCaseBoard(row.destination),
                time: at.toISO() ?? '',
                delayMinutes: row.delayMinutes,
                source: 'live',
                platform: row.platform,
            })
        }
        return departures
    }
}
