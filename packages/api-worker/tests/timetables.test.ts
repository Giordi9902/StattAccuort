import { describe, expect, it } from 'vitest'

import { parseCsvLine } from '../src/db/timetables/csv'
import { extractEavLocalita, matchEavStation } from '../src/db/timetables/eav-stations'
import {
    expandServiceDates,
    linesForRoute,
    matchTrip,
    nearestLineStation,
    parseGtfsTime,
    titleCase,
    type SeededLine,
} from '../src/db/timetables/gtfs'
import { normalizeStationName, parseEavBoard, stationNamesEquivalent } from '../src/modules/transit/eav-board'

import boardHtml from './fixtures/eav-board.html?raw'

const line = (id: string, name: string, type: SeededLine['type'], stationIds: string[]): SeededLine => ({
    id,
    name,
    type,
    stationIds,
})

describe('parseCsvLine', () => {
    it('splits quoted fields and unescapes doubled quotes', () => {
        expect(parseCsvLine('"1000","VERGINI","say ""hi""",,x')).toEqual(['1000', 'VERGINI', 'say "hi"', '', 'x'])
    })

    it('keeps commas inside quotes', () => {
        expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c'])
    })
})

describe('parseGtfsTime', () => {
    it('reads after-midnight times past 24:00', () => {
        expect(parseGtfsTime('25:10:00')).toBe(25 * 3600 + 600)
    })

    it('rejects malformed times', () => {
        expect(parseGtfsTime('8:1')).toBeUndefined()
    })
})

describe('linesForRoute', () => {
    const lines = [
        line('1', 'L1', 'subway', []),
        line('R2-a', 'R2', 'bus', []),
        line('R2-b', 'R2', 'bus', []),
        line('bus-5', '5', 'bus', []),
        line('5', 'Circumflegrea', 'train', []),
    ]

    it('maps a metro route by its short name', () => {
        expect(linesForRoute({ routeType: '1', shortName: 'L1' }, lines).map((l) => l.id)).toEqual(['1'])
    })

    it('returns every variant of a bus line', () => {
        expect(linesForRoute({ routeType: '3', shortName: 'R2' }, lines).map((l) => l.id)).toEqual(['R2-a', 'R2-b'])
    })

    it('matches on the route type, so bus 5 never lands on the Circumflegrea', () => {
        expect(linesForRoute({ routeType: '3', shortName: '5' }, lines).map((l) => l.id)).toEqual(['bus-5'])
    })

    // ANM's feed files Trenitalia's L2 as metro; OSM seeds it as a train.
    it('lets a rail route match a line seeded as another rail type', () => {
        const rail = [line('2', 'L2', 'train', [])]
        expect(linesForRoute({ routeType: '1', shortName: 'L2' }, rail).map((l) => l.id)).toEqual(['2'])
    })

    it('treats trolleybuses as buses', () => {
        const trolley = [line('201', '201', 'bus', [])]
        expect(linesForRoute({ routeType: '11', shortName: '201' }, trolley)).toHaveLength(1)
    })

    it('matches funiculars, but never a bus of the same name', () => {
        const mixed = [line('B', 'Chiaia', 'funicular', []), line('X', 'Chiaia', 'bus', [])]
        expect(linesForRoute({ routeType: '7', shortName: 'Chiaia' }, mixed).map((l) => l.id)).toEqual(['B'])
    })

    it('skips trams', () => {
        expect(linesForRoute({ routeType: '0', shortName: '1' }, [line('1', '1', 'subway', [])])).toEqual([])
    })
})

describe('nearestLineStation', () => {
    const coordinates = new Map([
        ['near', { latitude: 40.85, longitude: 14.25 }],
        ['far', { latitude: 40.86, longitude: 14.25 }], // ~1.1 km north
        ['other-line', { latitude: 40.8501, longitude: 14.25 }],
    ])
    const busLine = line('R2', 'R2', 'bus', ['near', 'far'])

    it("picks the closest of the line's own stations", () => {
        expect(nearestLineStation({ latitude: 40.8502, longitude: 14.25 }, busLine, coordinates)).toBe('near')
    })

    it('ignores stops beyond the distance limit', () => {
        expect(nearestLineStation({ latitude: 40.855, longitude: 14.25 }, busLine, coordinates)).toBeUndefined()
    })
})

describe('matchTrip', () => {
    const a = line('R2-a', 'R2', 'bus', ['s1', 's2'])
    const b = line('R2-b', 'R2', 'bus', ['s1', 's2', 's3'])
    const stationOf: Record<string, Record<string, string>> = {
        'R2-a': { x: 's1', y: 's2' },
        'R2-b': { x: 's1', y: 's2', z: 's3' },
    }
    const resolve = (stopId: string, l: SeededLine) => stationOf[l.id][stopId]

    it('picks the variant covering most stops', () => {
        const stops = [
            { stopId: 'x', departureSecs: 100 },
            { stopId: 'y', departureSecs: 200 },
            { stopId: 'z', departureSecs: 300 },
        ]
        expect(matchTrip(stops, [a, b], resolve)).toEqual({
            lineId: 'R2-b',
            departures: [
                { stationId: 's1', departureSecs: 100 },
                { stationId: 's2', departureSecs: 200 },
                { stationId: 's3', departureSecs: 300 },
            ],
        })
    })

    it('keeps only the first visit of a station on a loop', () => {
        const stops = [
            { stopId: 'x', departureSecs: 100 },
            { stopId: 'y', departureSecs: 200 },
            { stopId: 'x', departureSecs: 300 },
        ]
        expect(matchTrip(stops, [a], resolve)?.departures).toHaveLength(2)
    })

    it('returns undefined when no stop lands on a candidate', () => {
        expect(matchTrip([{ stopId: 'q', departureSecs: 1 }], [a], resolve)).toBeUndefined()
    })
})

describe('expandServiceDates', () => {
    it('expands a weekly calendar and applies exceptions', () => {
        const dates = expandServiceDates(
            [
                {
                    service_id: 'WK',
                    monday: '1',
                    tuesday: '1',
                    wednesday: '0',
                    thursday: '0',
                    friday: '0',
                    saturday: '0',
                    sunday: '0',
                    start_date: '20261012', // Monday
                    end_date: '20261018',
                },
            ],
            [
                { service_id: 'WK', date: '20261013', exception_type: '2' },
                { service_id: 'WK', date: '20261017', exception_type: '1' },
                { service_id: 'HOL', date: '20261225', exception_type: '1' },
            ]
        )
        expect([...(dates.get('WK') ?? [])].sort()).toEqual([20261012, 20261017])
        expect([...(dates.get('HOL') ?? [])]).toEqual([20261225])
    })
})

describe('titleCase', () => {
    it('title-cases uppercase GTFS stop names', () => {
        expect(titleCase('PIAZZA CARLO III')).toBe('Piazza Carlo Iii')
        expect(titleCase("VIA D'AMELIO")).toBe("Via D'Amelio")
    })
})

describe('EAV boards', () => {
    it('parses the departure rows of a board', () => {
        expect(parseEavBoard(boardHtml)).toEqual([
            expect.objectContaining({
                train: '1099',
                destination: 'SORRENTO',
                time: '09:56',
                delayMinutes: null,
                platform: '1',
            }),
            {
                train: '4088',
                destination: 'NAPOLI PORTA NOLANA',
                time: '09:57',
                delayMinutes: 3,
                platform: '4',
                stops: [],
            },
            {
                train: '1088',
                destination: 'NAPOLI PORTA NOLANA',
                time: '10:00',
                delayMinutes: null,
                platform: '4',
                stops: [],
            },
        ])
    })

    it('reads the intermediate stops of a train', () => {
        const [sorrento] = parseEavBoard(boardHtml)
        expect(sorrento.stops.slice(0, 3)).toEqual([
            'TORRE A.TA - OPLONTI',
            'Villa Regina',
            'POMPEI SCAVI VILLA DEI MISTERI',
        ])
        expect(sorrento.stops.at(-1)).toBe('S. Agnello')
    })

    it('returns nothing for markup without departure rows', () => {
        expect(parseEavBoard('<html><body>Servizio non disponibile</body></html>')).toEqual([])
    })

    it('normalizes the abbreviations EAV and OSM spell differently', () => {
        expect(normalizeStationName('NAPOLI P. GARIBALDI')).toBe('napoli piazza garibaldi')
        expect(normalizeStationName('S. Giorgio a Cremano')).toBe('san giorgio a cremano')
        expect(normalizeStationName('Torre A.ta - Oplonti')).toBe('torre annunziata oplonti')
    })

    it('matches names on whole words only', () => {
        expect(stationNamesEquivalent('NAPOLI PORTA NOLANA', 'Porta Nolana')).toBe(true)
        expect(stationNamesEquivalent('META', 'Metamorfosi')).toBe(false)
    })

    it('reads the board list embedded in the home page', () => {
        const html = `<script id="data-localita" type="application/json">${JSON.stringify([
            { descrizione: 'BARRA', idLinea: 'L1', idLocMoova: 'LOC1', touchpoint: 'TP1', visualizzato: 'true' },
            { descrizione: 'HIDDEN', idLinea: 'L1', idLocMoova: 'LOC2', touchpoint: 'TP2', visualizzato: 'false' },
        ])}</script>`
        expect(extractEavLocalita(html)).toEqual([
            { descrizione: 'BARRA', idLinea: 'L1', codLoc: 'LOC1', touchpoint: 'TP1' },
        ])
    })

    it('matches a board to its seeded station', () => {
        const candidates = [
            { id: 'pn', name: 'Napoli Porta Nolana' },
            { id: 'pg', name: 'Napoli Piazza Garibaldi' },
            { id: 'sg', name: 'San Giorgio a Cremano' },
        ]
        expect(matchEavStation('NAPOLI P. GARIBALDI', candidates)).toBe('pg')
        expect(matchEavStation('S. GIORGIO A CREMANO', candidates)).toBe('sg')
        expect(matchEavStation('SORRENTO', candidates)).toBeUndefined()
        expect(matchEavStation('SORRENTO', candidates, { SORRENTO: 'Napoli Porta Nolana' })).toBe('pn')
    })
})
