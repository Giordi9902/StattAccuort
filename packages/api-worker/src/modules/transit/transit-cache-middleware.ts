import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_TRANSIT_PATH = '/:version{v\\d+}/transit/*'

export const VERSIONED_TRANSIT_CACHEABLE_PATHS = [
    '/:version{v\\d+}/transit/stations',
    '/:version{v\\d+}/transit/lines',
    '/:version{v\\d+}/transit/segments',
] as const

/*
 * Browsers get max-age=0 + must-revalidate so they always revalidate with an If-None-Match: on an
 * unchanged network that is a cheap 304 (the ETag middleware in index.ts), and after a reseed every
 * client picks up the new data at once instead of serving a stale copy for the length of a max-age.
 */
export const TRANSIT_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

export const transitCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET' || c.res.status >= 500) return

    c.header('Cache-Control', TRANSIT_CACHE_CONTROL)
}
