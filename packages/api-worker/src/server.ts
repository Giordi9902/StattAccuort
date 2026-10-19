import { serve } from '@hono/node-server'

import { type Bindings, resolveConfig } from './app-env'
import { logger } from './common/logger'
import { closeDb } from './db'
import { applyMigrationsExclusively } from './db/migrate'
import { startDraining } from './modules/ops'

import { app } from './index'

/*
 * Node entry point: `bun run dev` (watch) or `bun run start`. Configuration comes from the
 * environment (.env in development, see .env.example); it is handed to Hono as the request env,
 * merged with the Node request bindings @hono/node-server provides.
 */
const env: Bindings = {
    DATABASE_URL: process.env.DATABASE_URL,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL as Bindings['LOG_LEVEL'],
    REPORT_HASH_SECRET: process.env.REPORT_HASH_SECRET,
    REPORT_COOLDOWN_SECONDS: process.env.REPORT_COOLDOWN_SECONDS,
    TRUST_PROXY: process.env.TRUST_PROXY,
    REFERENCE_CACHE_TTL_SECONDS: process.env.REFERENCE_CACHE_TTL_SECONDS,
    ADMIN_TOKEN: process.env.ADMIN_TOKEN,
}

const port = Number(process.env.PORT ?? 8787)
const hostname = process.env.HOST ?? '0.0.0.0'
const drainSeconds = Number(process.env.SHUTDOWN_DRAIN_SECONDS ?? 0)

const start = async () => {
    // Every request resolves the same settings; failing here beats a replica that answers 500s.
    resolveConfig(env)
    if (env.DATABASE_URL === undefined || env.DATABASE_URL === '') throw new Error('DATABASE_URL is not set')

    // Bring the schema up to date before taking traffic, so a deploy is just "start the new build".
    await applyMigrationsExclusively(env.DATABASE_URL)

    const server = serve(
        { fetch: (request, nodeBindings) => app.fetch(request, { ...env, ...nodeBindings }), port, hostname },
        (info) => {
            logger.info({ port: info.port, hostname }, 'API listening')
        }
    )

    /*
     * Rolling restarts and scale-downs: fail /readyz first and keep serving for the drain period, so
     * the load balancer's health check moves traffic away before the listener closes. Then let the
     * open requests finish and close the database pool.
     */
    let stopping = false
    const shutdown = (signal: string) => {
        if (stopping) return
        stopping = true
        logger.info({ signal, drainSeconds }, 'API draining')
        startDraining()
        setTimeout(() => {
            server.close(() => {
                closeDb()
                    .catch((error: unknown) => logger.error(error, 'Closing the database pool failed'))
                    .finally(() => process.exit(0))
            })
        }, drainSeconds * 1000)
    }
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((error: unknown) => {
    logger.error(error, 'API failed to start')
    process.exit(1)
})
