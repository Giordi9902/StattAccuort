import { doublePrecision, index, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'

import { lines } from './lines'
import { stations } from './stations'

export const REPORT_SOURCES = ['mini_app', 'web_app', 'mobile_app', 'telegram'] as const

export const reports = pgTable(
    'reports',
    {
        reportId: integer().primaryKey().generatedAlwaysAsIdentity(),
        stationId: varchar({ length: 16 })
            .notNull()
            .references(() => stations.id),
        lineId: varchar({ length: 16 }).references(() => lines.id),
        directionId: varchar({ length: 16 }).references(() => stations.id),
        // Millisecond resolution (matches the explicit `new Date()` set on every insert) so that
        // "latest report" ordering stays deterministic — second resolution ties across same-second
        // Reports and breaks the risk/prediction reads.
        timestamp: timestamp({ withTimezone: true, precision: 3 }).notNull().defaultNow(),
        source: varchar({ length: 16, enum: REPORT_SOURCES }).notNull(),
        // Anonymous device fingerprint written by report intake (see modules/report-intake): it rate
        // Limits submissions and lets a client see its own reports. Never returned by the API.
        clientHash: varchar({ length: 32 }),
        // Weight of the report in the visibility threshold; 0 hides it. Intake writes 1, null is legacy.
        trust: doublePrecision(),
    },
    // Reads filter by a time window, often scoped to a station or line; the leading
    // Equality column lets the range predicate use an index seek instead of a full scan.
    (table) => [
        index('reports_station_ts_idx').on(table.stationId, table.timestamp),
        index('reports_ts_idx').on(table.timestamp),
        index('reports_line_ts_idx').on(table.lineId, table.timestamp),
        index('reports_client_ts_idx').on(table.clientHash, table.timestamp),
    ]
)

const insertReportDbSchema = createInsertSchema(reports).pick({
    stationId: true,
    lineId: true,
    directionId: true,
    source: true,
})

// API input schema:
// - Allows missing stationId so normalization can infer it
// - Defaults public submissions to web_app; Telegram uses private RPC
// - Requires at least one of stationId, lineId, or directionId
export const insertReportSchema = insertReportDbSchema
    .extend({
        source: z.enum(['mini_app', 'web_app', 'mobile_app']).default('web_app'),
        stationId: insertReportDbSchema.shape.stationId.optional(),
    })
    .superRefine((data, ctx) => {
        if (data.stationId === undefined && data.lineId === undefined && data.directionId === undefined) {
            ctx.addIssue({
                code: 'custom',
                message: 'At least one of stationId, lineId, or directionId must be provided',
                path: [],
            })
        }
    })

// Database insert type (internal use): stationId + source are required
export type InsertReport = z.infer<typeof insertReportDbSchema>
