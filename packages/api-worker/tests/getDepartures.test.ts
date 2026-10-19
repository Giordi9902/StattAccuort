import { DEFAULT_CITY_SLUG, getCity } from '@stattaccuort/cities'
import { DateTime } from 'luxon'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { DeparturesService, type DeparturesResponse } from '../src/modules/transit/departures-service'
import { TransitNetworkDataService } from '../src/modules/transit/transit-network-data-service'

import boardHtml from './fixtures/eav-board.html?raw'
import {
    db,
    eavStationBoards,
    lineStations,
    timetableDepartures,
    timetableServiceDates,
    timetableTrips,
} from './test-db'
import { appRequestWithRedirect, setSystemTime } from './test-utils'

const city = getCity(DEFAULT_CITY_SLUG)!
// 10:00 city-local on Tuesday 13 October 2026 (CEST, UTC+2).
const NOW = new Date('2026-10-13T08:00:00Z')
const TEN_AM = 10 * 3600

let stationId: string
let lineId: string

const insertTrip = async (tripId: string, serviceId: string, departureSecs: number, headsign = 'Capolinea') => {
    await db.insert(timetableTrips).values({ tripId, lineId, serviceId, headsign })
    await db.insert(timetableDepartures).values({ stationId, tripId, departureSecs })
}

const getDepartures = async (id: string): Promise<DeparturesResponse> => {
    const response = await appRequestWithRedirect(`/v0/departures/${id}`)
    expect(response.status).toBe(200)
    return (await response.json()) as DeparturesResponse
}

describe('GET /v0/departures/:stationId', () => {
    beforeAll(async () => {
        const [row] = await db
            .select({ stationId: lineStations.stationId, lineId: lineStations.lineId })
            .from(lineStations)
            .limit(1)
        stationId = row.stationId
        lineId = row.lineId
    })

    afterEach(async () => {
        setSystemTime()
        await db.delete(timetableDepartures)
        await db.delete(timetableTrips)
        await db.delete(timetableServiceDates)
        await db.delete(eavStationBoards)
    })

    it('lists scheduled departures in the next 90 minutes, including last night’s service', async () => {
        setSystemTime(NOW)
        await db.insert(timetableServiceDates).values([
            { serviceId: 'TODAY', date: 20261013 },
            { serviceId: 'YESTERDAY', date: 20261012 },
            { serviceId: 'OTHER', date: 20261020 },
        ])
        await insertTrip('past', 'TODAY', TEN_AM - 600)
        await insertTrip('soon', 'TODAY', TEN_AM + 600)
        await insertTrip('late-night', 'YESTERDAY', 24 * 3600 + TEN_AM + 900, 'Altro capolinea')
        await insertTrip('too-far', 'TODAY', TEN_AM + 2 * 3600)
        await insertTrip('not-running', 'OTHER', TEN_AM + 300)

        const { departures, unavailable } = await getDepartures(stationId)

        expect(unavailable).toBe(false)
        expect(departures.map((d) => [d.destination, DateTime.fromISO(d.time).toUTC().toISO()])).toEqual([
            ['Capolinea', '2026-10-13T08:10:00.000Z'],
            ['Altro capolinea', '2026-10-13T08:15:00.000Z'],
        ])
        expect(departures[0]).toMatchObject({ lineId, source: 'schedule', delayMinutes: null })
    })

    it('keeps at most three departures per line and direction', async () => {
        setSystemTime(NOW)
        await db.insert(timetableServiceDates).values({ serviceId: 'TODAY', date: 20261013 })
        for (let i = 1; i <= 5; i++) await insertTrip(`t${i}`, 'TODAY', TEN_AM + i * 300)

        const { departures } = await getDepartures(stationId)
        expect(departures).toHaveLength(3)
    })

    it('flags a station no timetable source covers', async () => {
        setSystemTime(NOW)
        const { departures, unavailable } = await getDepartures(stationId)
        expect(departures).toEqual([])
        expect(unavailable).toBe(true)
    })
})

describe('DeparturesService — EAV live boards', () => {
    afterEach(async () => {
        await db.delete(eavStationBoards)
    })

    const service = (fetchImpl: (input: URL, init: RequestInit) => Promise<Response>) =>
        new DeparturesService(db, new TransitNetworkDataService(db, city.slug), city, undefined, fetchImpl)

    it('reads the board, applies delays and drops trains that have left', async () => {
        const [row] = await db.select({ stationId: lineStations.stationId }).from(lineStations).limit(1)
        await db.insert(eavStationBoards).values({ stationId: row.stationId, codLoc: 'LOC', touchpoint: 'TP' })
        const requests: string[] = []
        const fetchImpl = async (input: URL, init: RequestInit) => {
            requests.push(`${input.toString()} ${String(init.body)}`)
            return new Response(boardHtml)
        }

        // 09:58 local: the 09:56 has left, the 09:57 runs 3 minutes late, the 10:00 is on time.
        const now = DateTime.fromISO('2026-10-13T09:58:00', { zone: city.timezone })
        const result = await service(fetchImpl).getDepartures(row.stationId, () => undefined, now)

        expect(requests).toEqual([
            'https://orariotreni.eavsrl.it/teleindicatori/ws_getData_moova.php tipoLista=P&codLoc=LOC&touchpoint=TP&visualizzazione=mobile',
        ])
        expect(result.unavailable).toBe(false)
        expect(result.departures.map((d) => [d.destination, d.delayMinutes, d.platform, d.source])).toEqual([
            ['Napoli Porta Nolana', 3, '4', 'live'],
            ['Napoli Porta Nolana', null, '4', 'live'],
        ])
    })

    it('reports a failing board and still answers', async () => {
        const [row] = await db.select({ stationId: lineStations.stationId }).from(lineStations).limit(1)
        await db.insert(eavStationBoards).values({ stationId: row.stationId, codLoc: 'LOC', touchpoint: 'TP' })
        const errors: unknown[] = []
        const fetchImpl = async () => new Response('down', { status: 503 })

        const result = await service(fetchImpl).getDepartures(row.stationId, (error) => errors.push(error))

        expect(result.departures).toEqual([])
        expect(errors).toHaveLength(1)
    })
})
