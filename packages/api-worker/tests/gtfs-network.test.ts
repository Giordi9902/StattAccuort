import { describe, expect, it } from 'vitest'

import { isSeedLineIncluded } from '../src/db/seed/config'
import {
    buildGtfsNetwork,
    gtfsRouteType,
    gtfsStopName,
    type GtfsNetworkInput,
    type GtfsTrip,
} from '../src/db/seed/gtfs/build-network'
import type { OsmNode, OsmRelation, OsmWay } from '../src/db/seed/stations/overpass'

const stop = (name: string, lat: number) => ({ name, lat, lon: 14.17 })

const trip = (tripId: string, routeId: string, directionId: string, shapeId = ''): GtfsTrip => ({
    tripId,
    routeId,
    directionId,
    shapeId,
})

const input = (overrides: Partial<GtfsNetworkInput> = {}): GtfsNetworkInput => ({
    agencies: new Map([['ANM', 'Azienda Napoletana Mobilità']]),
    routes: [{ routeId: 'r6', agencyId: 'ANM', shortName: 'R6', longName: '', routeType: '3', color: 'FFFFFF' }],
    trips: [
        trip('t1', 'r6', '0', 'shape-out'),
        trip('t2', 'r6', '0', 'shape-out'),
        trip('t3', 'r6', '0'),
        trip('t4', 'r6', '1'),
    ],
    stopSequences: new Map([
        ['t1', ['10', '11', '12']],
        ['t2', ['10', '11', '12']],
        ['t3', ['10', '11']], // A short working.
        ['t4', ['12', '13', '10']],
    ]),
    stops: new Map([
        ['10', stop('PADULA _ PICCOLA LURDES', 40.858)],
        ['11', stop('COMUNALE NAPOLI', 40.861)],
        ['12', stop('PIAZZALE TECCHIO', 40.824)],
        ['13', stop('PICASSO', 40.856)],
    ]),
    shapes: new Map([
        [
            'shape-out',
            [
                { lat: 40.858, lon: 14.17 },
                { lat: 40.84, lon: 14.18 },
                { lat: 40.824, lon: 14.17 },
            ],
        ],
    ]),
    ...overrides,
})

const build = (overrides?: Partial<GtfsNetworkInput>) =>
    buildGtfsNetwork(input(overrides), {
        routeTypes: new Set(['bus']),
        routeAliases: { ALIB: 'Alibus' },
        isIncluded: isSeedLineIncluded,
    })

const relationsOf = (elements: ReturnType<typeof build>) =>
    elements.filter((e): e is OsmRelation => e.type === 'relation')

describe('buildGtfsNetwork', () => {
    it('emits one route relation per direction, on the pattern most trips run', () => {
        const elements = build()
        const nodes = new Map(
            elements.filter((e): e is OsmNode => e.type === 'node').map((node) => [node.id, node.tags?.ref])
        )
        const stopsOf = (relation: OsmRelation) =>
            relation.members.filter((m) => m.type === 'node').map((m) => nodes.get(m.ref))

        expect(relationsOf(elements).map(stopsOf)).toEqual([
            ['gtfs-10', 'gtfs-11', 'gtfs-12'],
            ['gtfs-12', 'gtfs-13', 'gtfs-10'],
        ])
    })

    it('tags relations the way the seed filters expect, leaving a white route colour unset', () => {
        const [relation] = relationsOf(build())
        expect(relation.tags).toEqual({
            type: 'route',
            route: 'bus',
            ref: 'R6',
            name: 'R6',
            operator: 'Azienda Napoletana Mobilità',
        })
    })

    it('draws the shape when the feed has one, and stop to stop when it does not', () => {
        const elements = build()
        const ways = new Map(elements.filter((e): e is OsmWay => e.type === 'way').map((way) => [way.id, way]))
        const [outbound, inbound] = relationsOf(elements).map((relation) => {
            const member = relation.members.find((m) => m.type === 'way')!
            return ways.get(member.ref)!.geometry!
        })
        expect(outbound).toHaveLength(3)
        expect(inbound).toEqual([
            { lat: 40.824, lon: 14.17 },
            { lat: 40.856, lon: 14.17 },
            { lat: 40.858, lon: 14.17 },
        ])
    })

    it('uses negative element ids, clear of real OSM ids', () => {
        expect(build().every((element) => element.id < 0)).toBe(true)
    })

    it('applies route aliases and the city ref filter', () => {
        const routes = [
            { routeId: 'a', agencyId: 'ANM', shortName: 'ALIB', longName: '', routeType: '3', color: '' },
            {
                routeId: 'b',
                agencyId: 'ANM',
                shortName: 'ACTON',
                longName: 'ASCENSORE ACTON',
                routeType: '3',
                color: '',
            },
        ]
        const trips = [trip('t1', 'a', '0'), trip('t2', 'b', '0')]
        const stopSequences = new Map([
            ['t1', ['10', '11']],
            ['t2', ['10', '11']],
        ])
        expect(relationsOf(build({ routes, trips, stopSequences })).map((r) => r.tags?.ref)).toEqual(['Alibus'])
    })
})

describe('GTFS helpers', () => {
    it('maps basic and extended route types', () => {
        expect(gtfsRouteType('3')).toBe('bus')
        expect(gtfsRouteType('11')).toBe('bus')
        expect(gtfsRouteType('704')).toBe('bus')
        expect(gtfsRouteType('7')).toBe('funicular')
        expect(gtfsRouteType('1')).toBeUndefined()
    })

    it('cleans up stop names', () => {
        expect(gtfsStopName('PADULA _ PICCOLA LURDES')).toBe('Padula - Piccola Lurdes')
    })
})
