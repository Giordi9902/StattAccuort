import { sql } from 'drizzle-orm'
import type { Hono } from 'hono'

import type { Env } from '../../app-env'
import { metricsRegistry } from '../../common/metrics'
import { getDb } from '../../db'

/*
 * Infrastructure endpoints for the load balancer and Prometheus. They are registered ahead of the
 * request context, so a probe never resolves a city, builds services or writes a request log line.
 * The reverse proxy keeps /metrics off the public origin (docker/web/Caddyfile).
 */

let draining = false

/** From now on /readyz fails, so the load balancer stops routing here before the server closes. */
export const startDraining = (): void => {
    draining = true
}

const READY_TIMEOUT_MS = 2000

const databaseReachable = async (url: string | undefined): Promise<boolean> => {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), READY_TIMEOUT_MS)
    })
    try {
        const ping = getDb(url)
            .execute(sql`select 1`)
            .then(() => true)
        return await Promise.race([ping, timeout])
    } catch {
        return false
    } finally {
        clearTimeout(timer)
    }
}

export const registerOpsRoutes = (app: Hono<Env>) => {
    /*
     * Liveness: the process answers. Deliberately ignores the database, or a database outage would
     * make the orchestrator restart every healthy replica at once.
     */
    app.get('/healthz', (c) => c.json({ status: 'ok' }))

    // Readiness: this replica can serve traffic right now.
    app.get('/readyz', async (c) => {
        if (draining) return c.json({ status: 'draining' }, 503)
        if (!(await databaseReachable(c.env.DATABASE_URL))) return c.json({ status: 'database_unreachable' }, 503)
        return c.json({ status: 'ready' })
    })

    app.get('/metrics', async (c) => {
        c.header('Content-Type', metricsRegistry.contentType)
        return c.body(await metricsRegistry.metrics())
    })
}
