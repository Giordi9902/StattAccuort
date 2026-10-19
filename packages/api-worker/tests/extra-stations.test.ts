import { describe, expect, it } from 'vitest'

import { addExtraRouteStations } from '../src/db/seed/stations/extra-stations'
import type { OsmElement, OsmRelation } from '../src/db/seed/stations/overpass'

// Cumana, west to east: Fusaro, Lucrino, Arco Felice; Baia lies between Fusaro and Lucrino.
const node = (id: number, lon: number): OsmElement => ({ type: 'node', id, lat: 40.82, lon })
const route = (stops: number[]): OsmRelation => ({
    type: 'relation',
    id: 1,
    tags: { type: 'route', route: 'train', ref: '4' },
    members: [
        ...stops.map((ref) => ({ type: 'node' as const, ref, role: 'stop' })),
        { type: 'way', ref: 99, role: '' },
    ],
})
const elements = (stops: number[]): OsmElement[] => [
    node(1, 14.06), // Fusaro
    node(2, 14.083), // Lucrino
    node(3, 14.1), // Arco Felice
    node(10, 14.071), // Baia
    node(11, 14.2), // Beyond Arco Felice
    route(stops),
]
const stopsOf = (out: OsmElement[]) => (out.find((e) => e.type === 'relation') as OsmRelation).members.map((m) => m.ref)

describe('addExtraRouteStations', () => {
    it('inserts a station between the two stops it lies between, in either direction', () => {
        expect(stopsOf(addExtraRouteStations(elements([1, 2, 3]), { train: { '4': [10] } }))).toEqual([1, 10, 2, 3, 99])
        expect(stopsOf(addExtraRouteStations(elements([3, 2, 1]), { train: { '4': [10] } }))).toEqual([3, 2, 10, 1, 99])
    })

    it('appends a station beyond a terminal at that end', () => {
        expect(stopsOf(addExtraRouteStations(elements([1, 2, 3]), { train: { '4': [11] } }))).toEqual([1, 2, 3, 11, 99])
    })

    it('leaves other lines, and stations already listed, alone', () => {
        expect(stopsOf(addExtraRouteStations(elements([1, 2, 3]), { train: { '5': [10] } }))).toEqual([1, 2, 3, 99])
        expect(stopsOf(addExtraRouteStations(elements([1, 10, 2]), { train: { '4': [10] } }))).toEqual([1, 10, 2, 99])
    })
})
