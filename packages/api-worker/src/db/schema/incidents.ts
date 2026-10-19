import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, smallint, timestamp, varchar } from 'drizzle-orm/pg-core'

import { lines } from './lines'
import { REPORT_SOURCES } from './reports'
import { stations } from './stations'

export const INCIDENT_KINDS = ['delay', 'disruption', 'pickpocket'] as const
export type IncidentKind = (typeof INCIDENT_KINDS)[number]

/*
 * Service problems riders report — delays, disruptions, pickpockets — kept apart from `reports`
 * (ticket inspections) on purpose: the risk model, the inspection decay, predicted reports and the
 * insights all read `reports` as "inspectors were here", and a delay must never colour a segment
 * red or count towards a station's inspection ranking.
 *
 * An incident sits at a station, on a line, or both: a stuck train is a line problem, a pickpocket
 * usually a station one. Riders pick from fixed kinds and never type free text, so there is nothing
 * to moderate and nothing that can describe a person.
 */
export const incidents = pgTable(
    'incidents',
    {
        incidentId: integer().primaryKey().generatedAlwaysAsIdentity(),
        kind: varchar({ length: 16, enum: INCIDENT_KINDS }).notNull(),
        stationId: varchar({ length: 16 }).references(() => stations.id),
        lineId: varchar({ length: 16 }).references(() => lines.id),
        // Only for delays: the rider's estimate in minutes.
        delayMinutes: smallint(),
        timestamp: timestamp({ withTimezone: true, precision: 3 }).notNull().defaultNow(),
        source: varchar({ length: 16, enum: REPORT_SOURCES }).notNull(),
        // Same anonymous device fingerprint as reports (see modules/report-intake). Never returned.
        clientHash: varchar({ length: 32 }),
    },
    (table) => [
        check('incidents_has_place', sql`${table.stationId} is not null or ${table.lineId} is not null`),
        index('incidents_ts_idx').on(table.timestamp),
        index('incidents_client_kind_ts_idx').on(table.clientHash, table.kind, table.timestamp),
    ]
)
