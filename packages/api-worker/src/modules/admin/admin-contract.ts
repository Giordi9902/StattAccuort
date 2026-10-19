import { z } from 'zod'

export const ADMIN_WINDOWS = ['1h', '24h', '7d', '30d'] as const
export type AdminWindow = (typeof ADMIN_WINDOWS)[number]

export const adminOverviewQuerySchema = z.object({
    window: z.enum(ADMIN_WINDOWS).default('24h'),
})

type Ranked = { id: string; name: string; count: number }

export type AdminOverview = {
    generatedAt: string
    window: { name: AdminWindow; start: string; end: string; bucketMinutes: number }
    reports: {
        total: number
        previousTotal: number
        devices: number
        bySource: { source: string; count: number }[]
        series: { start: string; count: number }[]
        topStations: Ranked[]
        topLines: Ranked[]
        // Anonymous fingerprints, shortened: enough to spot one device flooding, never reversible.
        topDevices: { device: string; count: number; stations: number }[]
        lastReportAt: string | null
    }
    // Delays, disruptions and pickpockets reported in the window.
    incidents: { kind: string; count: number }[]
    data: {
        stations: number
        lines: number
        segments: number
        eavBoards: number
        timetableFirstDate: string | null
        timetableLastDate: string | null
    }
    database: {
        version: string
        sizeBytes: number
        connections: number
        maxConnections: number
    }
    // The replica that answered; the others report their own numbers to Prometheus.
    instance: {
        instanceId: string
        nodeVersion: string
        uptimeSeconds: number
        rssBytes: number
        heapUsedBytes: number
        requests: number
        serverErrors: number
        rateLimited: number
    }
}
