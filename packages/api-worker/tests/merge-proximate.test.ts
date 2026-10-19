import { describe, expect, it } from 'vitest'

import { shouldMergeNames } from '../src/db/seed/stations/merge-proximate'

const bus = new Set(['bus'])
const rail = new Set(['light_rail'])

describe('shouldMergeNames', () => {
    // Naples names bus stops "Street - Landmark": stops along one street must stay apart.
    it('keeps bus stops on the same street apart', () => {
        expect(
            shouldMergeNames(
                { name: 'Montagna Spaccata - Parco La Fenice', routeTypes: bus },
                { name: 'Montagna Spaccata - Polo Artigianale', routeTypes: bus }
            )
        ).toBe(false)
    })

    it('merges the two sides of one bus stop', () => {
        expect(
            shouldMergeNames(
                { name: 'Cintia - Parco San Paolo', routeTypes: bus },
                { name: 'Cintia  - parco San Paolo', routeTypes: bus }
            )
        ).toBe(true)
    })

    it('still merges a bus stop into the rail station it is named after', () => {
        expect(
            shouldMergeNames(
                { name: 'Garibaldi', routeTypes: rail },
                { name: 'Garibaldi - Corso Novara', routeTypes: bus }
            )
        ).toBe(true)
    })
})
