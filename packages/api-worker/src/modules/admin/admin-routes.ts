import { createHash, timingSafeEqual } from 'node:crypto'

import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'
import { AppError } from '../../common/errors'
import { defineRoute } from '../../common/router'

import { adminOverviewQuerySchema } from './admin-contract'
import { getOverview } from './admin-service'

/*
 * Hashing first gives both sides the same length, which timingSafeEqual requires, without leaking
 * the token's length through an early return.
 */
const sameToken = (given: string, expected: string): boolean =>
    timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest())

/*
 * A bearer token rather than user accounts: the dashboard has a handful of operators, and a static
 * secret keeps the API stateless so any replica can answer. Rotate it by changing ADMIN_TOKEN.
 */
export const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
    const expected = c.get('config').adminToken
    if (expected === undefined) {
        throw new AppError({
            message: 'Admin access is not configured',
            statusCode: 503,
            internalCode: 'ADMIN_UNAVAILABLE',
        })
    }
    const given = c.req
        .header('Authorization')
        ?.match(/^Bearer\s+(.+)$/i)?.[1]
        ?.trim()
    if (given === undefined || !sameToken(given, expected)) {
        throw new AppError({ message: 'Admin access required', statusCode: 401, internalCode: 'ADMIN_UNAUTHORIZED' })
    }
    await next()
}

export const getAdminOverview = defineRoute<Env>()({
    method: 'get',
    path: '/overview',
    schemas: { query: adminOverviewQuerySchema },
    handler: async (c) => {
        const { window } = c.req.valid('query')
        return c.json(await getOverview(c.get('db'), { window, timezone: c.get('city').timezone }))
    },
})
