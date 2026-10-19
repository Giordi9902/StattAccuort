import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_REPORTS_CACHEABLE_PATHS = ['/:version{v\\d+}/reports/:stationId'] as const

// Browsers revalidate on every use, so a client never paints a stale count out of its own HTTP cache.
export const REPORTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

export const reportsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET' || c.res.status >= 400) return

    /*
     * A station below the trust threshold answers differently depending on who asks, so its response
     * cannot be shared — and that includes the empty list a non-owner gets.
     */
    if (c.get('reportsUncacheable') === true) {
        c.header('Cache-Control', 'no-store')
        return
    }

    c.header('Cache-Control', REPORTS_CACHE_CONTROL)
}
