import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { incidents } from './schema/incidents'
import { lines, lineStations } from './schema/lines'
import { reports } from './schema/reports'
import { segments } from './schema/segments'
import { stations } from './schema/stations'
import { eavStationBoards, timetableDepartures, timetableServiceDates, timetableTrips } from './schema/timetables'

export const schema = {
    reports,
    incidents,
    stations,
    lines,
    lineStations,
    segments,
    timetableServiceDates,
    timetableTrips,
    timetableDepartures,
    eavStationBoards,
}
export type Schema = typeof schema

// The server, the scripts and the test suite all talk to Postgres through this one type.
export type DbConnection = PostgresJsDatabase<Schema>

/*
 * Every API replica opens up to `max` connections, so replicas × DATABASE_POOL_MAX has to stay
 * below the server's max_connections (100 by default), with room left for the scripts.
 */
const poolMax = (): number => {
    const value = Number(process.env.DATABASE_POOL_MAX ?? 10)
    return Number.isInteger(value) && value > 0 ? value : 10
}

export const createDb = (url: string): { db: DbConnection; close: () => Promise<void> } => {
    const client = postgres(url, { max: poolMax(), onnotice: () => undefined })
    return { db: drizzle(client, { schema, casing: 'snake_case' }), close: () => client.end() }
}

let shared: { db: DbConnection; close: () => Promise<void> } | undefined

/**
 * The process-wide connection pool, opened on first use from DATABASE_URL. The server and the
 * scripts share it for their whole lifetime; postgres.js manages the pool itself.
 */
export const getDb = (url: string | undefined = process.env.DATABASE_URL): DbConnection => {
    if (shared === undefined) {
        if (url === undefined || url === '') throw new Error('DATABASE_URL is not set')
        shared = createDb(url)
    }
    return shared.db
}

/** Close the shared pool, letting in-flight queries finish (graceful shutdown). */
export const closeDb = async (): Promise<void> => {
    await shared?.close()
    shared = undefined
}

export * from './schema/reports'
export * from './schema/incidents'
export * from './schema/lines'
export * from './schema/stations'
export * from './schema/segments'
export * from './schema/timetables'
