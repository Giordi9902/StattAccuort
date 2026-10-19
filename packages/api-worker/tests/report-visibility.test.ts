import { describe, expect, it } from 'vitest'

import { selectVisibleReports } from '../src/modules/reports/reports-service'

/*
 * The trust-threshold rules the read path applies. Intake currently writes every report with trust 1
 * and the viewer asks for no threshold, but the rules stay so one can be introduced from intake alone.
 */
const row = (trust: number | null, clientHash: string | null = 'submitter', stationId = 's1') => ({
    timestamp: new Date(0),
    stationId,
    directionId: null,
    lineId: null,
    trust,
    clientHash,
})

describe('selectVisibleReports', () => {
    it('hides reports below the station threshold from other viewers, not from their submitter', () => {
        const rows = [row(0.1)]
        expect(selectVisibleReports(rows, { minStationTrust: 1, clientHash: 'other' }).rows).toHaveLength(0)
        expect(selectVisibleReports(rows, { minStationTrust: 1, clientHash: 'submitter' }).rows).toHaveLength(1)
    })

    it('shows a station once enough trust accumulates there', () => {
        const rows = Array.from({ length: 10 }, () => row(0.1))
        expect(selectVisibleReports(rows, { minStationTrust: 1, clientHash: 'other' }).rows).toHaveLength(10)
    })

    it('counts a legacy null trust as a full report', () => {
        expect(selectVisibleReports([row(null)], { minStationTrust: 1, clientHash: 'other' }).rows).toHaveLength(1)
    })

    it('keeps pending reports owner-only, even with no threshold', () => {
        const rows = [row(0), row(5, 'someone-else')]
        const other = selectVisibleReports(rows, { minStationTrust: 0, clientHash: 'other' })
        expect(other.rows).toHaveLength(1)
        expect(other.suppressed).toBe(true)
        expect(selectVisibleReports(rows, { minStationTrust: 0, clientHash: 'submitter' }).rows).toHaveLength(2)
    })

    it('shows everything and suppresses nothing with trusted reports and no threshold', () => {
        const result = selectVisibleReports([row(1), row(1, null, 's2')], { minStationTrust: 0 })
        expect(result.rows).toHaveLength(2)
        expect(result.suppressed).toBe(false)
    })
})
