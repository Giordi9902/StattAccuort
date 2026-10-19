import { index, integer, pgTable, primaryKey, text, varchar } from 'drizzle-orm/pg-core'

/*
 * Departure data for the "next departures" panel, rebuilt wholesale by `timetables:import` (see
 * src/db/timetables). None of these tables carry foreign keys to stations or lines: the import
 * replaces them in one pass after each seed, and a FK would only turn a reseed that drops a station
 * into a failed load instead of one stale row nobody queries.
 */

/** The dates (YYYYMMDD, city-local) each GTFS service runs on, from calendar_dates.txt. */
export const timetableServiceDates = pgTable(
    'timetable_service_dates',
    {
        serviceId: text().notNull(),
        date: integer().notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.serviceId, table.date] }),
        index('timetable_service_dates_date_idx').on(table.date),
    ]
)

/** One scheduled trip, already resolved to the seeded line variant it runs on. */
export const timetableTrips = pgTable('timetable_trips', {
    tripId: text().primaryKey(),
    lineId: varchar({ length: 16 }).notNull(),
    serviceId: text().notNull(),
    headsign: text().notNull(),
})

/**
 * A trip's scheduled departure from a seeded station. `departureSecs` counts from the service
 * day's midnight and may exceed 86 400 — GTFS writes after-midnight runs as e.g. 25:10:00.
 */
export const timetableDepartures = pgTable(
    'timetable_departures',
    {
        stationId: varchar({ length: 16 }).notNull(),
        tripId: text().notNull(),
        departureSecs: integer().notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.stationId, table.tripId] }),
        index('timetable_departures_station_time_idx').on(table.stationId, table.departureSecs),
    ]
)

/** The live departure boards (EAV teleindicatori) that cover a seeded station. */
export const eavStationBoards = pgTable(
    'eav_station_boards',
    {
        stationId: varchar({ length: 16 }).notNull(),
        codLoc: text().notNull(),
        touchpoint: text().notNull(),
    },
    (table) => [primaryKey({ columns: [table.stationId, table.codLoc] })]
)
