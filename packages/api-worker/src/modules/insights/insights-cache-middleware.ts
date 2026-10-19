import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_INSIGHTS_CACHEABLE_PATHS = [
    '/:version{v\\d+}/insights/station/:stationId',
    '/:version{v\\d+}/insights/lines/:lineName',
    '/:version{v\\d+}/insights/lines',
] as const

// Browsers revalidate on every use, so a client never paints stale insights out of its own cache.
// A shared cache in front of the API (a reverse proxy) may still hold them; the API itself memoizes
// the expensive city profile (see InsightsService.getCityProfile).
export const INSIGHTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

export const insightsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET' || c.res.status >= 400) return

    c.header('Cache-Control', INSIGHTS_CACHE_CONTROL)
}
