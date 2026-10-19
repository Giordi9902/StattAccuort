import { getDb, type DbConnection } from '../index'
import { applyMigrations } from '../migrate'

import { parseCityArg } from './city-arg'

/*
 * Seeds a city's reference tables (stations, lines, line_stations, segments) in DATABASE_URL from
 * the bundled snapshots, through the same seedBaseData pipeline the test suite seeds with:
 *
 *   bun run seed --city <slug>
 *
 * Idempotent, and never deletes a station or line a report still points at.
 */

// Reference data the seed rebuilds, in FK order.
export const REFERENCE_TABLES = ['stations', 'lines', 'line_stations', 'segments'] as const
// Tables holding user data rather than reference data, so the seed deliberately leaves them alone.
const NON_REFERENCE_TABLES = ['reports', 'incidents'] as const
// Departure data, rebuilt by `timetables:import` after a seed rather than by the seed itself.
export const TIMETABLE_TABLES = [
    'timetable_service_dates',
    'timetable_trips',
    'timetable_departures',
    'eav_station_boards',
] as const

// A new table is a decision — reference data to seed, or user data to leave alone — so an unlisted one
// Fails here instead of being silently left out of every seeded database.
const assertEveryTableIsAccountedFor = async (db: DbConnection): Promise<void> => {
    const rows = await db.execute<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    )
    const accounted = new Set<string>([...REFERENCE_TABLES, ...NON_REFERENCE_TABLES, ...TIMETABLE_TABLES])
    const unaccounted = rows.map(({ table_name }) => table_name).filter((name) => !accounted.has(name))
    if (unaccounted.length > 0) {
        throw new Error(
            `Tables missing from the seed: ${unaccounted.join(', ')} — add each to REFERENCE_TABLES (seeded), NON_REFERENCE_TABLES or TIMETABLE_TABLES (left alone)`
        )
    }
}

const seed = async () => {
    const city = parseCityArg()
    process.env.SEED_CITY = city

    // Import after SEED_CITY is set: ./seed and ./snapshots read the registry-backed config at
    // Import time, and the fs loader resolves the city-namespaced snapshot path from it.
    const { seedBaseData, setSnapshotLoader } = await import('./seed')
    const { fsSnapshotLoader } = await import('./snapshots')
    const { logger } = await import('../../common/logger')
    setSnapshotLoader(fsSnapshotLoader)

    const db = getDb()
    await applyMigrations(db)
    await assertEveryTableIsAccountedFor(db)
    logger.info({ city }, 'Seeding...')
    await seedBaseData(db)
    logger.info({ city }, 'Seed complete')
}

seed()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
        console.error('Seed failed', error)
        process.exit(1)
    })
