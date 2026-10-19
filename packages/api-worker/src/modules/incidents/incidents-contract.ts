import { z } from 'zod'

import { INCIDENT_KINDS, type IncidentKind } from '../../db'

/*
 * How long an incident stays on the map. Fixed per kind rather than adaptive like inspections:
 * nothing "moves along the line", and riders mostly care whether something is happening now.
 * A disruption tends to outlast a delay, and a pickpocket moves on within the hour.
 */
export const INCIDENT_LIFETIME_MINUTES: Record<IncidentKind, number> = {
    delay: 30,
    disruption: 120,
    pickpocket: 60,
}

// Long enough to include every incident that can still be live.
export const DEFAULT_INCIDENTS_WINDOW_MINUTES = Math.max(...Object.values(INCIDENT_LIFETIME_MINUTES))
export const MAX_INCIDENTS_WINDOW_DAYS = 7

export const DELAY_MINUTES_OPTIONS = [5, 15, 30, 60] as const

export const incidentInputSchema = z
    .object({
        kind: z.enum(INCIDENT_KINDS),
        stationId: z.string().min(1).max(16).nullish(),
        lineId: z.string().min(1).max(16).nullish(),
        delayMinutes: z
            .number()
            .int()
            .refine((value) => (DELAY_MINUTES_OPTIONS as readonly number[]).includes(value))
            .nullish(),
        source: z.enum(['mini_app', 'web_app', 'mobile_app']).default('web_app'),
    })
    .strict()
    .refine((input) => (input.stationId ?? null) !== null || (input.lineId ?? null) !== null, {
        message: 'A station or a line is required',
    })
    .refine((input) => input.kind === 'delay' || (input.delayMinutes ?? null) === null, {
        message: 'Only delays carry delayMinutes',
    })

export type IncidentInput = z.infer<typeof incidentInputSchema>

export type Incident = {
    incidentId: number
    kind: IncidentKind
    stationId: string | null
    lineId: string | null
    delayMinutes: number | null
    timestamp: string
    expiresAt: string
}
