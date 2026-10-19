import { hostname } from 'node:os'

import type { MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client'

/*
 * Prometheus metrics of this process, served on /metrics. With several API replicas every replica
 * exposes its own numbers; Prometheus scrapes each one and sums them (see docker/prometheus).
 */

export const INSTANCE_ID = process.env.INSTANCE_ID ?? hostname()

export const metricsRegistry = new Registry()
metricsRegistry.setDefaultLabels({ instance_id: INSTANCE_ID })
collectDefaultMetrics({ register: metricsRegistry })

export const httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'HTTP requests served, by matched route',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [metricsRegistry],
})

export const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency, by matched route',
    labelNames: ['method', 'route'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [metricsRegistry],
})

// `kind` is `inspection` for ticket-inspection reports, else the incident kind.
export const reportsSubmitted = new Counter({
    name: 'reports_submitted_total',
    help: 'Report and incident submissions, by kind and outcome',
    labelNames: ['kind', 'outcome'] as const,
    registers: [metricsRegistry],
})

export const referenceCacheLookups = new Counter({
    name: 'reference_cache_lookups_total',
    help: 'In-process reference cache lookups',
    labelNames: ['result'] as const,
    registers: [metricsRegistry],
})

/*
 * Labelled by the route pattern (`/v0/reports/:stationId`), never the raw path: one series per
 * station id would grow without bound. Unmatched paths share one label for the same reason.
 * After next() the route index points at the handler that answered, so routePath() is its pattern.
 */
export const httpMetrics: MiddlewareHandler = async (c, next) => {
    const stop = httpRequestDuration.startTimer()
    try {
        await next()
    } finally {
        const pattern = routePath(c)
        const route = pattern === '*' || pattern === '/*' ? 'unmatched' : pattern
        stop({ method: c.req.method, route })
        httpRequests.inc({ method: c.req.method, route, status: String(c.res.status) })
    }
}

const sumByLabel = async (counter: Counter, label: string, match: (value: string) => boolean) => {
    const { values } = await counter.get()
    return values
        .filter((sample) => match(String(sample.labels[label] ?? '')))
        .reduce((total, sample) => total + sample.value, 0)
}

/** The few process-local numbers the admin dashboard shows next to the database figures. */
export const processSnapshot = async () => {
    const memory = process.memoryUsage()
    return {
        instanceId: INSTANCE_ID,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        requests: await sumByLabel(httpRequests, 'status', () => true),
        serverErrors: await sumByLabel(httpRequests, 'status', (status) => status.startsWith('5')),
        rateLimited: await sumByLabel(reportsSubmitted, 'outcome', (outcome) => outcome === 'rate_limited'),
    }
}
