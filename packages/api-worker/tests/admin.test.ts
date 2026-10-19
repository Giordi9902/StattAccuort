import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AdminOverview } from '../src/modules/admin'
import { db, reports, stations } from './test-db'
import { appRequestWithRedirect, resetTestEnv, sendReportRequest, setSystemTime, setTestEnv } from './test-utils'

const ADMIN_TOKEN = 'a'.repeat(40)

const overview = (query = '', token: string | null = ADMIN_TOKEN) =>
    appRequestWithRedirect(`/admin/overview${query}`, {
        headers: token === null ? {} : { Authorization: `Bearer ${token}` },
    })

const errorCode = async (response: Response) =>
    ((await response.json()) as { details: { internal_code: string } }).details.internal_code

describe('Admin overview', () => {
    beforeEach(async () => {
        await db.delete(reports)
        setTestEnv({ ADMIN_TOKEN })
    })

    afterEach(() => {
        setSystemTime()
        resetTestEnv()
    })

    it('is unavailable until a token is configured', async () => {
        resetTestEnv()
        const response = await overview()
        expect(response.status).toBe(503)
        expect(await errorCode(response)).toBe('ADMIN_UNAVAILABLE')
    })

    it('rejects missing and wrong tokens', async () => {
        const missing = await overview('', null)
        expect(missing.status).toBe(401)
        expect(await errorCode(missing)).toBe('ADMIN_UNAUTHORIZED')

        const wrong = await overview('', 'b'.repeat(40))
        expect(wrong.status).toBe(401)
    })

    it('is never cached', async () => {
        const response = await overview()
        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
    })

    it('rejects an unknown window', async () => {
        const response = await overview('?window=1y')
        expect(response.status).toBe(400)
    })

    it('summarises the reports of the window', async () => {
        const [first, second] = await db.select({ id: stations.id, name: stations.name }).from(stations).limit(2)

        setSystemTime(new Date('2026-05-04T08:10:00Z'))
        // Outside a 1h window, inside the previous one.
        await sendReportRequest({ stationId: second.id }, undefined, { 'X-Forwarded-For': '203.0.113.1' })

        setSystemTime(new Date('2026-05-04T09:20:00Z'))
        await sendReportRequest({ stationId: first.id }, undefined, { 'X-Forwarded-For': '203.0.113.1' })
        await sendReportRequest({ stationId: first.id }, undefined, { 'X-Forwarded-For': '203.0.113.2' })
        await sendReportRequest({ stationId: second.id }, undefined, { 'X-Forwarded-For': '203.0.113.2' })

        setSystemTime(new Date('2026-05-04T09:30:00Z'))
        const response = await overview('?window=1h')
        expect(response.status).toBe(200)
        const body = (await response.json()) as AdminOverview

        expect(body.window.bucketMinutes).toBe(5)
        expect(body.reports.total).toBe(3)
        expect(body.reports.previousTotal).toBe(1)
        expect(body.reports.devices).toBe(2)
        expect(body.reports.bySource).toEqual([{ source: 'web_app', count: 3 }])
        expect(body.reports.series).toHaveLength(12)
        expect(body.reports.series.reduce((total, bucket) => total + bucket.count, 0)).toBe(3)
        expect(body.reports.topStations[0]).toEqual({ id: first.id, name: first.name, count: 2 })
        expect(body.reports.topDevices.map((device) => device.device.length)).toEqual([8, 8])
        expect(body.data.stations).toBeGreaterThan(0)
        expect(body.database.maxConnections).toBeGreaterThan(0)
        expect(body.instance.uptimeSeconds).toBeGreaterThanOrEqual(0)
    })
})

describe('Operational endpoints', () => {
    it('reports liveness and readiness', async () => {
        expect((await appRequestWithRedirect('/healthz')).status).toBe(200)
        const ready = await appRequestWithRedirect('/readyz')
        expect(ready.status).toBe(200)
        expect(await ready.json()).toEqual({ status: 'ready' })
    })

    it('exposes Prometheus metrics labelled by route pattern', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
        await appRequestWithRedirect(`/v0/reports/${station.id}`)

        const response = await appRequestWithRedirect('/metrics')
        expect(response.status).toBe(200)
        const text = await response.text()
        expect(text).toContain('http_requests_total')
        expect(text).toContain('route="/v0/reports/:stationId"')
        expect(text).not.toContain(`/v0/reports/${station.id}`)
    })
})
