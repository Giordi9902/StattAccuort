import { describe, expect, it } from 'vitest'

import { isSeedLineIncluded, normalizeRouteTag } from '../src/db/seed/config'
import { buildRefRegex, findMissingRouteRefs, type OsmElement } from '../src/db/seed/stations/overpass'

const routeRelation = (id: number, ref: string): OsmElement => ({
    type: 'relation',
    id,
    tags: { type: 'route', route: 'light_rail', ref },
    members: [],
})

// Discovery filters with the default city's (Napoli) per-type whitelist.
describe('Napoli line ref discovery', () => {
    it.each([
        ['subway', '1'],
        ['subway', '6'],
        ['train', '2'],
        ['train', '7'],
        ['train', '4'],
        ['light_rail', '7'],
        ['light_rail', '13'],
    ])('keeps %s %s', (routeType, ref) => {
        expect(isSeedLineIncluded({ ref, route: routeType })).toBe(true)
    })

    it.each([
        ['subway', '2'],
        ['train', '8'],
        ['train', 'Frecciarossa'],
    ])('drops %s %s', (routeType, ref) => {
        expect(isSeedLineIncluded({ ref, route: routeType })).toBe(false)
    })

    it.each(['ANM', 'Azienda Napoletana Mobilità'])('keeps a bus operated as %s', (operator) => {
        expect(isSeedLineIncluded({ ref: 'R2', route: 'bus', operator })).toBe(true)
    })

    it.each([['EAV'], ['CTP'], [undefined]])('drops a bus operated by %s', (operator) => {
        expect(isSeedLineIncluded({ ref: 'R2', route: 'bus', operator })).toBe(false)
    })

    it('drops the combined C51/C52 bus relation', () => {
        expect(isSeedLineIncluded({ ref: 'C51/C52', route: 'bus', operator: 'ANM' })).toBe(false)
    })
})

describe('normalizeRouteTag', () => {
    it('seeds trolleybus relations as buses', () => {
        const tags: Record<string, string | undefined> = { route: 'trolleybus', ref: '201' }
        normalizeRouteTag(tags)
        expect(tags.route).toBe('bus')
    })

    it('leaves known route types alone', () => {
        const tags: Record<string, string | undefined> = { route: 'subway', ref: '1' }
        normalizeRouteTag(tags)
        expect(tags.route).toBe('subway')
    })
})

describe('buildRefRegex', () => {
    it('puts plus in a character class so Overpass ERE does not treat it as a quantifier', () => {
        expect(buildRefRegex(['+65', '+65E', '1'])).toBe('^([+]65|[+]65E|1)$')
    })
})

describe('findMissingRouteRefs', () => {
    it('returns nothing when every discovered ref has a route relation', () => {
        const elements = [routeRelation(1, '13'), routeRelation(2, '9'), routeRelation(3, '9')]
        expect(findMissingRouteRefs(['13', '9'], elements)).toEqual([])
    })

    it('reports refs whose route relation is missing from a truncated response', () => {
        // Mirrors the real partial-response bug: 13 and 9 were discovered but a
        // batch returned HTTP 200 with their relations dropped.
        const elements = [routeRelation(1, '1'), routeRelation(2, '2')]
        expect(findMissingRouteRefs(['1', '2', '13', '9'], elements)).toEqual(['13', '9'])
    })

    it('ignores non-route relations that happen to carry a matching ref', () => {
        const stopArea: OsmElement = {
            type: 'relation',
            id: 9,
            tags: { type: 'public_transport', public_transport: 'stop_area', ref: '13' },
            members: [],
        }
        expect(findMissingRouteRefs(['13'], [stopArea])).toEqual(['13'])
    })
})
