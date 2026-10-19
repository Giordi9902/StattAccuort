import { describe, expect, it } from 'vitest'

import { buildLineVariants } from '../src/db/seed/lines/build-variants'
import type { OsmRelation } from '../src/db/seed/stations/overpass'

// The suite runs with the default seed city (Napoli), whose profile whitelists refs per route
// type (subway `1|6`, train `2|4|5|7`, light_rail `7|9|12|13|14`) and aliases them to local names.
const nodeIdToStationId = new Map([
    [1, 'station-a'],
    [2, 'station-b'],
])

const routeRelation = (id: number, route: string, ref: string, operator?: string): OsmRelation => ({
    type: 'relation',
    id,
    tags: { type: 'route', route, ref, ...(operator !== undefined && { operator }) },
    members: [
        { type: 'node', ref: 1, role: 'stop' },
        { type: 'node', ref: 2, role: 'stop' },
    ],
})

const variantsOf = (relations: OsmRelation[]) => buildLineVariants(relations, nodeIdToStationId)
const refsOf = (relations: OsmRelation[]): string[] => variantsOf(relations).map((variant) => variant.ref)

describe('buildLineVariants — route ref patterns', () => {
    it.each(['2', '4', '5', '7'])('keeps the train ref %s', (ref) => {
        expect(refsOf([routeRelation(1, 'train', ref)])).toEqual([ref])
    })

    it.each(['2', '11'])('drops the out-of-scope subway ref %s', (ref) => {
        expect(refsOf([routeRelation(1, 'subway', ref)])).toEqual([])
    })

    it('applies the pattern only to the route type it is configured for', () => {
        expect(refsOf([routeRelation(1, 'subway', '7'), routeRelation(2, 'light_rail', '7')])).toEqual(['7'])
    })
})

describe('buildLineVariants — line ids', () => {
    // Linea 7 (EAV train) and CV S.Giorgio (light_rail) share the OSM ref `7`.
    it('gives a ref shared across route types the configured id', () => {
        const variants = variantsOf([routeRelation(1, 'light_rail', '7'), routeRelation(2, 'train', '7')])
        expect(variants.map(({ id, name }) => ({ id, name }))).toEqual(
            expect.arrayContaining([
                { id: '7', name: 'CV S.Giorgio' },
                { id: 'L7', name: 'L7' },
            ])
        )
    })

    it('keeps the bus name while moving its id off a rail line', () => {
        const [variant] = variantsOf([routeRelation(1, 'bus', '5', 'ANM')])
        expect(variant).toMatchObject({ id: 'bus-5', ref: '5', name: '5' })
    })

    it('names the funiculars', () => {
        const [variant] = variantsOf([routeRelation(1, 'funicular', 'A')])
        expect(variant).toMatchObject({ id: 'A', name: 'Centrale', type: 'funicular' })
    })

    it('names Linea 6', () => {
        const [variant] = variantsOf([routeRelation(1, 'subway', '6')])
        expect(variant).toMatchObject({ id: '6', name: 'L6' })
    })
})

describe('buildLineVariants — buses', () => {
    it('keeps ANM buses and drops other operators', () => {
        expect(refsOf([routeRelation(1, 'bus', 'R2', 'ANM'), routeRelation(2, 'bus', 'E1', 'EAV')])).toEqual(['R2'])
    })

    it('refuses a ref that two route types would fold into one line id', () => {
        expect(() => variantsOf([routeRelation(1, 'subway', '1'), routeRelation(2, 'bus', '1', 'ANM')])).toThrow(
            /used by several route types/
        )
    })
})

describe('buildLineVariants — line names', () => {
    it('writes the configured local name while keeping the ref-derived id', () => {
        const [variant] = variantsOf([routeRelation(1, 'train', '4')])
        expect(variant).toMatchObject({ id: '4', ref: '4', name: 'Cumana' })
    })

    it('resolves the name per route type', () => {
        const [variant] = variantsOf([routeRelation(1, 'light_rail', '13')])
        expect(variant.name).toBe('CV Sorrento')
    })
})

describe('buildLineVariants — directions', () => {
    const run = (id: number, stationIds: number[]): OsmRelation => ({
        type: 'relation',
        id,
        tags: { type: 'route', route: 'bus', ref: 'R6', operator: 'ANM' },
        members: stationIds.map((ref) => ({ type: 'node' as const, ref, role: 'platform' })),
    })
    const stations = new Map([1, 2, 3, 4, 5].map((n) => [n, `s${n}`]))

    it('folds a return run that serves no station of its own', () => {
        const variants = buildLineVariants([run(1, [1, 2, 3, 4]), run(2, [4, 2, 1])], stations)
        expect(variants.map((v) => v.stationIds)).toEqual([['s1', 's2', 's3', 's4']])
    })

    it('keeps a return run on other streets as its own variant', () => {
        const variants = buildLineVariants([run(1, [1, 2, 3, 4]), run(2, [4, 5, 1])], stations)
        expect(variants.map((v) => v.id)).toEqual(['R6-a', 'R6-b'])
        expect(variants.flatMap((v) => v.stationIds)).toContain('s5')
    })
})

describe('buildLineVariants — route type overrides', () => {
    it('seeds Linea 2 as suburban, keeping the id and name configured for its OSM type', () => {
        const [variant] = variantsOf([routeRelation(1, 'train', '2', 'Trenitalia')])
        expect(variant).toMatchObject({ id: '2', name: 'L2', type: 'suburban', color: '#8E24AA' })
    })

    it('leaves the other trains alone', () => {
        const [variant] = variantsOf([routeRelation(1, 'train', '4')])
        expect(variant).toMatchObject({ type: 'train', color: '#1E88E5' })
    })
})
