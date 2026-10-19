import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Incident } from '../src/modules/incidents'
import { db, incidents, reports } from './test-db'
import { appRequestWithRedirect, resetTestEnv, sendReportRequest, setSystemTime, setTestEnv } from './test-utils'

const postIncident = (payload: object, headers: Record<string, string> = {}) =>
    appRequestWithRedirect('/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
    })

const listIncidents = async (query = '') => {
    const response = await appRequestWithRedirect(`/incidents${query}`)
    expect(response.status).toBe(200)
    return (await response.json()) as Incident[]
}

let line: { id: string; stationId: string; otherLineStationId: string }

describe('Incidents', () => {
    beforeAll(async () => {
        const [first, second] = await db.query.lines.findMany({ limit: 2 })
        const firstStations = await db.query.lineStations.findMany({
            where: (table, { eq }) => eq(table.lineId, first.id),
        })
        const secondStations = await db.query.lineStations.findMany({
            where: (table, { eq }) => eq(table.lineId, second.id),
        })
        const onFirst = new Set(firstStations.map((row) => row.stationId))
        line = {
            id: first.id,
            stationId: firstStations[0].stationId,
            otherLineStationId: secondStations.find((row) => !onFirst.has(row.stationId))!.stationId,
        }
    })

    beforeEach(async () => {
        await db.delete(incidents)
        await db.delete(reports)
    })

    afterEach(() => {
        setSystemTime()
        resetTestEnv()
    })

    it('stores a delay on a line and lists it with its expiry', async () => {
        setSystemTime(new Date('2026-05-04T09:00:00Z'))
        const response = await postIncident({ kind: 'delay', lineId: line.id, delayMinutes: 15 })
        expect(response.status).toBe(200)
        const created = (await response.json()) as Incident
        expect(created).toMatchObject({ kind: 'delay', lineId: line.id, stationId: null, delayMinutes: 15 })
        expect(created).not.toHaveProperty('clientHash')
        expect(Date.parse(created.expiresAt) - Date.parse(created.timestamp)).toBe(30 * 60_000)

        setSystemTime(new Date('2026-05-04T09:10:00Z'))
        expect((await listIncidents()).map((incident) => incident.incidentId)).toEqual([created.incidentId])
    })

    it('needs a station or a line', async () => {
        expect((await postIncident({ kind: 'pickpocket' })).status).toBe(400)
    })

    it('rejects unknown places and a station that is not on the line', async () => {
        expect((await postIncident({ kind: 'pickpocket', stationId: 'nope' })).status).toBe(400)
        expect((await postIncident({ kind: 'disruption', lineId: 'nope' })).status).toBe(400)
        const mismatch = await postIncident({ kind: 'disruption', lineId: line.id, stationId: line.otherLineStationId })
        expect(mismatch.status).toBe(400)
    })

    it('accepts delay minutes only on delays, from the offered options', async () => {
        expect((await postIncident({ kind: 'delay', lineId: line.id, delayMinutes: 7 })).status).toBe(400)
        expect((await postIncident({ kind: 'pickpocket', stationId: line.stationId, delayMinutes: 15 })).status).toBe(
            400
        )
        expect((await postIncident({ kind: 'delay', lineId: line.id })).status).toBe(200)
    })

    it('rate limits the same kind from one device but not other kinds', async () => {
        setTestEnv({ REPORT_COOLDOWN_SECONDS: '600' })
        const device = { 'X-Forwarded-For': '203.0.113.9' }

        expect((await postIncident({ kind: 'pickpocket', stationId: line.stationId }, device)).status).toBe(200)
        const repeated = await postIncident({ kind: 'pickpocket', stationId: line.stationId }, device)
        expect(repeated.status).toBe(429)
        expect(((await repeated.json()) as { details: { internal_code: string } }).details.internal_code).toBe(
            'REPORT_RATE_LIMITED'
        )
        expect((await postIncident({ kind: 'delay', lineId: line.id }, device)).status).toBe(200)
        // Another device is unaffected.
        expect(
            (
                await postIncident(
                    { kind: 'pickpocket', stationId: line.stationId },
                    { 'X-Forwarded-For': '203.0.113.10' }
                )
            ).status
        ).toBe(200)
    })

    it('never shows up as an inspection report', async () => {
        await postIncident({ kind: 'disruption', stationId: line.stationId, lineId: line.id })
        expect(await db.select().from(reports)).toHaveLength(0)

        // An inspection still goes through, independent of the incident cooldown.
        setTestEnv({ REPORT_COOLDOWN_SECONDS: '600' })
        expect((await sendReportRequest({ stationId: line.stationId })).status).toBe(200)
    })

    it('lists a past window on request', async () => {
        setSystemTime(new Date('2026-05-01T09:00:00Z'))
        await postIncident({ kind: 'pickpocket', stationId: line.stationId })

        setSystemTime(new Date('2026-05-04T09:00:00Z'))
        expect(await listIncidents()).toHaveLength(0)
        const past = await listIncidents('?from=2026-05-01T00:00:00.000Z&to=2026-05-02T00:00:00.000Z')
        expect(past).toHaveLength(1)
    })

    it('rejects a window longer than a week', async () => {
        const response = await appRequestWithRedirect(
            '/incidents?from=2026-04-01T00:00:00.000Z&to=2026-05-01T00:00:00.000Z'
        )
        expect(response.status).toBe(400)
    })
})
