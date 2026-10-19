import { Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import { etag, RETAINED_304_HEADERS } from 'hono/etag'
import { requestId } from 'hono/request-id'

import { corsAllowOrigin, Env, registerContext } from './app-env'
import { handleError } from './common/error-handler'
import { httpMetrics } from './common/metrics'
import { registerVersionedRoutes } from './common/router'
import { getAdminOverview, requireAdmin } from './modules/admin'
import { getConfig } from './modules/config'
import { getIncidents, postIncident } from './modules/incidents'
import { getLineInsights, getLinesInsights, getStationInsights } from './modules/insights'
import { registerOpsRoutes } from './modules/ops'
import {
    insightsCacheMiddleware,
    VERSIONED_INSIGHTS_CACHEABLE_PATHS,
} from './modules/insights/insights-cache-middleware'
import { TURNSTILE_TOKEN_HEADER } from './modules/report-intake'
import { getReports, getReportsByStation, postReport } from './modules/reports/'
import { reportsCacheMiddleware, VERSIONED_REPORTS_CACHEABLE_PATHS } from './modules/reports/reports-cache-middleware'
import { getRisk } from './modules/risk/risk-routes'
import {
    transitCacheMiddleware,
    VERSIONED_TRANSIT_CACHEABLE_PATHS,
    VERSIONED_TRANSIT_PATH,
} from './modules/transit/transit-cache-middleware'
import { getDepartures, getDistance, getLines, getSegments, getStations } from './modules/transit/transit-routes'

export const createApp = () => {
    const app = new Hono<Env>()

    app.use(requestId())
    app.use(httpMetrics)

    // Before the request context: probes and scrapes must stay cheap and out of the request log.
    registerOpsRoutes(app)

    registerContext(app)

    // Request summary log.
    app.use('*', async (c, next) => {
        const start = Date.now()
        await next()
        c.get('logger').info(
            {
                method: c.req.method,
                path: new URL(c.req.url).pathname,
                status: c.res.status,
                ms: Date.now() - start,
            },
            'request'
        )
    })

    app.use(
        '*',
        cors({
            origin: (origin, c) => {
                const config = (c as Context<Env>).get('config')
                return corsAllowOrigin(origin, c.req.method, c.req.header('Access-Control-Request-Method'), config)
            },
            /*
             * Every header the client attaches to a report has to be listed here, or the browser
             * fails the preflight and the POST is never sent at all — the API sees nothing, and
             * React Query swallows the resulting network error, so the failure is invisible on both
             * sides. TURNSTILE_TOKEN_HEADER is the one that carries the challenge token.
             */
            allowHeaders: [
                'Accept',
                'Content-Type',
                'If-Modified-Since',
                'If-None-Match',
                'ff-platform',
                'Authorization',
                TURNSTILE_TOKEN_HEADER,
            ],
            allowMethods: ['GET', 'POST', 'OPTIONS'],
            exposeHeaders: ['ETag', 'Last-Modified'],
        })
    )
    // Browser caching (revalidate with ETag) for the responses that can be shared.
    for (const path of VERSIONED_TRANSIT_CACHEABLE_PATHS) {
        app.use(path, transitCacheMiddleware)
    }
    for (const path of VERSIONED_INSIGHTS_CACHEABLE_PATHS) {
        app.use(path, insightsCacheMiddleware)
    }
    for (const path of VERSIONED_REPORTS_CACHEABLE_PATHS) {
        app.use(path, reportsCacheMiddleware)
    }
    app.use('*', async (c, next) => {
        await next()
        c.header('Cache-Control', 'no-store')
    })
    app.use(
        VERSIONED_TRANSIT_PATH,
        etag({
            retainedHeaders: [
                ...RETAINED_304_HEADERS,
                'access-control-allow-origin',
                'access-control-allow-credentials',
                'access-control-expose-headers',
            ],
        })
    )

    app.onError(handleError)

    registerVersionedRoutes(app, 'reports', 'v0', {
        v0: [getReports, postReport, getReportsByStation],
    })
    registerVersionedRoutes(app, 'transit', 'v0', {
        v0: [getStations, getLines, getSegments, getDistance],
    })
    // Its own base path, outside /transit: departures change by the minute, so they must stay clear
    // Of the transit reference-data cache and ETag middlewares above.
    registerVersionedRoutes(app, 'departures', 'v0', {
        v0: [getDepartures],
    })
    // Delays, disruptions, pickpockets: their own resource, never part of the inspection reports.
    registerVersionedRoutes(app, 'incidents', 'v0', {
        v0: [getIncidents, postIncident],
    })
    registerVersionedRoutes(app, 'risk', 'v0', {
        v0: [getRisk],
    })
    registerVersionedRoutes(app, 'insights', 'v0', {
        v0: [getStationInsights, getLinesInsights, getLineInsights],
    })
    // Deliberately absent from the cache middlewares above — see config-routes.
    registerVersionedRoutes(app, 'config', 'v0', {
        v0: [getConfig],
    })
    app.use('/v0/admin/*', requireAdmin)
    registerVersionedRoutes(app, 'admin', 'v0', {
        v0: [getAdminOverview],
    })

    return app
}

export const app = createApp()
