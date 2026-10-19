import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import type { DbConnection } from './index'

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))

// Arbitrary, but fixed: every process that migrates this database must agree on it.
const MIGRATION_LOCK_ID = 7_301_904

// Idempotent: drizzle records applied migrations in its own journal table.
export const applyMigrations = (db: DbConnection): Promise<void> => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

/*
 * Replicas starting together would otherwise race on the same pending migration and all but one
 * would fail. A session advisory lock queues them; the ones that wait find the journal up to date.
 * The lock lives on a connection, so this uses a dedicated single-connection client.
 */
export const applyMigrationsExclusively = async (url: string): Promise<void> => {
    const client = postgres(url, { max: 1, onnotice: () => undefined })
    try {
        await client`select pg_advisory_lock(${MIGRATION_LOCK_ID})`
        await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER })
        await client`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`
    } finally {
        await client.end()
    }
}
