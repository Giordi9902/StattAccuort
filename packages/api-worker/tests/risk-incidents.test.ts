import { asc, eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { db, incidents, lines, reports, segments } from './test-db'
import { appRequestWithRedirect, resetTestEnv, sendReportRequest, setSystemTime } from './test-utils'

type Factors = Partial<Record<'inspection' | 'delay' | 'disruption' | 'pickpocket', number>>
type RiskResponse = { segments_risk: Record<string, { color: string; risk: number; factors: Factors }> }

const getRisk = async () => {
    const response = await appRequestWithRedirect('/risk')
    expect(response.status).toBe(200)
    return ((await response.json()) as RiskResponse).segments_risk
}

const postIncident = async (payload: object, device: string) => {
    const response = await appRequestWithRedirect('/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': device },
        body: JSON.stringify(payload),
    })
    expect(response.status).toBe(200)
}

// A line with enough segments to tell "near the station" from "far along the line".
let line: { id: string; segmentIds: string[]; stationOrder: string[] }

const riskOnLine = (risk: RiskResponse['segments_risk']) =>
    line.segmentIds.map((sid) => risk[sid]).filter((entry) => entry !== undefined)

describe('GET /v0/risk with incidents', () => {
    beforeAll(async () => {
        const candidates = await db.select({ id: lines.id }).from(lines)
        for (const candidate of candidates) {
            const rows = await db
                .select({ id: segments.id, from: segments.fromStationId, to: segments.toStationId })
                .from(segments)
                .where(eq(segments.lineId, candidate.id))
                .orderBy(asc(segments.id))
            if (rows.length < 8) continue
            line = {
                id: candidate.id,
                segmentIds: rows.map((row) => String(row.id)),
                stationOrder: rows.map((row) => row.from),
            }
            break
        }
    })

    beforeEach(async () => {
        await db.delete(incidents)
        await db.delete(reports)
        setSystemTime(new Date('2026-05-04T09:00:00Z'))
    })

    afterEach(async () => {
        setSystemTime()
        resetTestEnv()
        await db.delete(incidents)
    })

    it('colours a whole line for a line-wide disruption, and says why', async () => {
        await postIncident({ kind: 'disruption', lineId: line.id }, '203.0.113.1')

        const onLine = riskOnLine(await getRisk())
        expect(onLine).toHaveLength(line.segmentIds.length)
        for (const entry of onLine) {
            expect(entry.factors.disruption).toBeGreaterThan(0)
            expect(entry.factors.inspection).toBeUndefined()
        }
    })

    it('raises the risk with every further report of the same disruption', async () => {
        await postIncident({ kind: 'disruption', lineId: line.id }, '203.0.113.1')
        const once = riskOnLine(await getRisk())[0]!.risk

        await postIncident({ kind: 'disruption', lineId: line.id }, '203.0.113.2')
        const twice = riskOnLine(await getRisk())[0]!.risk

        expect(twice).toBeGreaterThan(once)
        expect(twice).toBeLessThanOrEqual(1)
    })

    it('keeps pickpockets local to their station', async () => {
        const stationId = line.stationOrder[Math.floor(line.stationOrder.length / 2)]!
        await postIncident({ kind: 'pickpocket', stationId, lineId: line.id }, '203.0.113.1')

        const onLine = riskOnLine(await getRisk())
        expect(onLine.length).toBeGreaterThan(0)
        expect(onLine.length).toBeLessThanOrEqual(4)
        for (const entry of onLine) expect(entry.factors.pickpocket).toBeGreaterThan(0)
    })

    it('weighs a long delay more than a short one', async () => {
        const stationId = line.stationOrder[0]!
        await postIncident({ kind: 'delay', stationId, lineId: line.id, delayMinutes: 60 }, '203.0.113.1')
        const long = riskOnLine(await getRisk())[0]?.factors.delay ?? 0

        await db.delete(incidents)
        await postIncident({ kind: 'delay', stationId, lineId: line.id, delayMinutes: 5 }, '203.0.113.2')
        const short = riskOnLine(await getRisk())[0]?.factors.delay ?? 0

        expect(long).toBeGreaterThan(short)
    })

    it('fades with the incident and is gone once it expires', async () => {
        await postIncident({ kind: 'disruption', lineId: line.id }, '203.0.113.1')
        const fresh = riskOnLine(await getRisk())[0]!.factors.disruption!

        setSystemTime(new Date('2026-05-04T09:40:00Z'))
        const older = riskOnLine(await getRisk())[0]?.factors.disruption ?? 0
        expect(older).toBeLessThan(fresh)

        setSystemTime(new Date('2026-05-04T11:01:00Z'))
        expect(riskOnLine(await getRisk())).toHaveLength(0)
    })

    it('combines incidents with inspections without exceeding 1', async () => {
        const stationId = line.stationOrder[0]!
        await sendReportRequest({ stationId, lineId: line.id })
        const inspectionOnly = await getRisk()
        const segment = line.segmentIds.find((sid) => inspectionOnly[sid] !== undefined)!
        expect(Object.keys(inspectionOnly[segment]!.factors)).toEqual(['inspection'])

        await postIncident({ kind: 'disruption', lineId: line.id }, '203.0.113.1')
        const both = (await getRisk())[segment]!

        expect(both.factors.inspection).toBe(inspectionOnly[segment]!.factors.inspection)
        expect(both.risk).toBeGreaterThan(inspectionOnly[segment]!.risk)
        expect(both.risk).toBeLessThanOrEqual(1)
    })
})
