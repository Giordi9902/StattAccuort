import type { HttpBindings } from '@hono/node-server'
import { CITY_SLUGS, type CityConfig, DEFAULT_CITY_SLUG, getCity } from '@stattaccuort/cities'
import { Context, Hono } from 'hono'

import { AppError } from './common/errors'
import { createLogger, Logger, LogLevel } from './common/logger'
import { DbConnection, getDb } from './db'
import { IncidentsService } from './modules/incidents'
import { InsightsService } from './modules/insights'
import { ReportsService } from './modules/reports'
import { ReportSubmissionService } from './modules/reports/report-submission-service'
import { RiskService } from './modules/risk'
import { DeparturesService } from './modules/transit/departures-service'
import type { CacheCtx } from './modules/transit/reference-cache'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'

// Configuration from the environment (see .env.example). `incoming` is the Node request, set by
// @hono/node-server; app.request() in tests leaves it out.
export type Bindings = Partial<HttpBindings> & {
    DATABASE_URL?: string
    CORS_ORIGINS?: string
    NODE_ENV?: string
    LOG_LEVEL?: LogLevel
    REPORT_HASH_SECRET?: string
    REPORT_COOLDOWN_SECONDS?: string
    TRUST_PROXY?: string
    REFERENCE_CACHE_TTL_SECONDS?: string
    ADMIN_TOKEN?: string
}

export type AppConfig = {
    nodeEnv: string
    corsOrigins: string[]
    reportHashSecret: string
    reportCooldownSeconds: number
    trustProxy: boolean
    referenceCacheTtlSeconds: number
    // Unset: the admin API answers 503, so it can't be left open by forgetting to configure it.
    adminToken: string | undefined
}

const PRIVATE_HTTP_ORIGIN =
    /^http:\/\/(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?::\d+)?$/

export const isAllowedCorsOrigin = (origin: string, config: AppConfig) =>
    config.corsOrigins.includes(origin) || PRIVATE_HTTP_ORIGIN.test(origin)

export const corsAllowOrigin = (
    origin: string,
    method: string,
    accessControlRequestMethod: string | undefined,
    config: AppConfig
): string | null => {
    const effectiveMethod = method === 'OPTIONS' ? (accessControlRequestMethod ?? 'GET') : method
    if (effectiveMethod === 'GET' || effectiveMethod === 'HEAD') {
        return '*'
    }
    return isAllowedCorsOrigin(origin, config) ? origin : null
}

export type Services = {
    reportsService: ReportsService
    insightsService: InsightsService
    riskService: RiskService
    transitNetworkDataService: TransitNetworkDataService
    departuresService: DeparturesService
    incidentsService: IncidentsService
}

export type Env = {
    Bindings: Bindings
    Variables: Services & {
        reportSubmissionService: ReportSubmissionService
        logger: Logger
        config: AppConfig
        db: DbConnection
        /*
         * Set when a reports response covers a station that fell below the trust threshold. Such a
         * response depends on who asked — including when it is empty — so no cache may share it.
         */
        reportsUncacheable?: boolean
        // The city resolved for this request (from `?city=`), the single source for
        // Which DB the request talks to and how downstream code scopes per-city work.
        city: CityConfig
    }
}

const DEV_REPORT_HASH_SECRET = 'development-only-report-hash-secret'
const MIN_ADMIN_TOKEN_LENGTH = 32

const numberSetting = (value: string | undefined, fallback: number, name: string): number => {
    if (value === undefined || value === '') return fallback
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`)
    return parsed
}

export const resolveConfig = (env: Bindings): AppConfig => {
    const corsOrigins = (env.CORS_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== '')

    if (corsOrigins.length === 0) {
        throw new Error('CORS_ORIGINS must be set to a comma-separated list of allowed origins')
    }

    // Default to development so verbose error descriptions are hidden only when production is
    // Set explicitly.
    const nodeEnv = env.NODE_ENV ?? 'development'
    const reportHashSecret = env.REPORT_HASH_SECRET ?? ''
    if (reportHashSecret === '' && nodeEnv === 'production') {
        throw new Error('REPORT_HASH_SECRET must be set in production')
    }

    const adminToken = env.ADMIN_TOKEN?.trim() ?? ''
    if (adminToken !== '' && adminToken.length < MIN_ADMIN_TOKEN_LENGTH) {
        throw new Error(`ADMIN_TOKEN must be at least ${MIN_ADMIN_TOKEN_LENGTH} characters`)
    }

    return {
        nodeEnv,
        corsOrigins,
        reportHashSecret: reportHashSecret !== '' ? reportHashSecret : DEV_REPORT_HASH_SECRET,
        reportCooldownSeconds: numberSetting(env.REPORT_COOLDOWN_SECONDS, 600, 'REPORT_COOLDOWN_SECONDS'),
        trustProxy: env.TRUST_PROXY === 'true',
        referenceCacheTtlSeconds: numberSetting(env.REFERENCE_CACHE_TTL_SECONDS, 600, 'REFERENCE_CACHE_TTL_SECONDS'),
        adminToken: adminToken !== '' ? adminToken : undefined,
    }
}

// Error-reporting hook, a no-op until an error tracker (e.g. Sentry for Node) is wired in.
export type ErrorReporter = (
    error: unknown,
    context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
) => void

let errorReporter: ErrorReporter = () => undefined

export const setErrorReporter = (reporter: ErrorReporter) => {
    errorReporter = reporter
}

export const reportError: ErrorReporter = (error, context) => errorReporter(error, context)

// Tags the current error-tracker request scope, e.g. with the city. No-op until one is wired in.
type ScopeTagger = (key: string, value: string) => void

let scopeTagger: ScopeTagger = () => undefined

export const setScopeTagger = (tagger: ScopeTagger) => {
    scopeTagger = tagger
}

export const resolveCityBySlug = (requested: string): CityConfig => {
    const city = getCity(requested)
    if (city === undefined) {
        throw new AppError({
            message: `Unknown city "${requested}"`,
            statusCode: 400,
            internalCode: 'UNKNOWN_CITY',
            description: `Supported cities: ${CITY_SLUGS.join(', ')}`,
        })
    }
    return city
}

export const createCityServices = (db: DbConnection, city: CityConfig, cacheCtx: CacheCtx): Services => {
    const transitNetworkDataService = new TransitNetworkDataService(db, city.slug, cacheCtx)
    const reportsService = new ReportsService(db, transitNetworkDataService)
    const incidentsService = new IncidentsService(db, transitNetworkDataService)
    return {
        transitNetworkDataService,
        reportsService,
        insightsService: new InsightsService(db, transitNetworkDataService, city.timezone, city.slug, cacheCtx),
        riskService: new RiskService(reportsService, transitNetworkDataService, incidentsService),
        departuresService: new DeparturesService(db, transitNetworkDataService, city, cacheCtx),
        incidentsService,
    }
}

const applyServices = (c: Context<Env>, db: DbConnection, config: AppConfig) => {
    const cacheCtx: CacheCtx =
        config.referenceCacheTtlSeconds > 0 ? { ttlMs: config.referenceCacheTtlSeconds * 1000 } : undefined
    const services = createCityServices(db, c.get('city'), cacheCtx)
    c.set('config', config)
    c.set('reportsService', services.reportsService)
    c.set('reportSubmissionService', new ReportSubmissionService(services.reportsService))
    c.set('insightsService', services.insightsService)
    c.set('riskService', services.riskService)
    c.set('transitNetworkDataService', services.transitNetworkDataService)
    c.set('departuresService', services.departuresService)
    c.set('incidentsService', services.incidentsService)
}

export const registerContext = (app: Hono<Env>) => {
    app.use('*', async (c, next) => {
        // Set the logger first so the error handler can log even if resolveConfig below throws.
        c.set('logger', createLogger(c.env.LOG_LEVEL ?? 'info'))

        const config = resolveConfig(c.env)

        // Resolve the city first: it scopes the caches and every downstream service.
        const city = resolveCityBySlug(c.req.query('city') ?? DEFAULT_CITY_SLUG)
        c.set('city', city)
        // Tag the error-tracker request scope so every event is filterable by city.
        scopeTagger('city', city.slug)

        // One shared pool for the process; every city lives in the same database.
        const db = getDb(c.env.DATABASE_URL)
        c.set('db', db)
        applyServices(c, db, config)

        await next()
    })
}
