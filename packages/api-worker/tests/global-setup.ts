import { sql } from 'drizzle-orm'

import { TEST_DATABASE_URL } from '../vitest.config'

/*
 * Rebuilds the test database from scratch once per run: drop the schema, apply the migrations,
 * seed the reference tables from the bundled snapshots. Suites then only touch reports and the
 * timetable tables, cleaning up after themselves.
 */
export default async function setup(): Promise<void> {
    const { createDb } = await import('../src/db')
    const { applyMigrations } = await import('../src/db/migrate')
    const { db, close } = createDb(TEST_DATABASE_URL)
    try {
        await db.execute(sql`drop schema if exists public cascade`)
        await db.execute(sql`drop schema if exists drizzle cascade`)
        await db.execute(sql`create schema public`)
        await applyMigrations(db)

        const { seedBaseData, setSnapshotLoader } = await import('../src/db/seed/seed')
        const { fsSnapshotLoader } = await import('../src/db/seed/snapshots')
        setSnapshotLoader(fsSnapshotLoader)
        await seedBaseData(db)
    } finally {
        await close()
    }
}
