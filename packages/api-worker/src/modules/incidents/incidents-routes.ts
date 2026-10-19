import { z } from 'zod'

import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { requestFingerprint } from '../report-intake'

import { DEFAULT_INCIDENTS_WINDOW_MINUTES, incidentInputSchema, MAX_INCIDENTS_WINDOW_DAYS } from './incidents-contract'

const DAY_MS = 86_400_000

const incidentsQuerySchema = z
    .object({ from: z.iso.datetime().optional(), to: z.iso.datetime().optional() })
    .refine(({ from, to }) => {
        if (from === undefined && to === undefined) return true
        if (from === undefined || to === undefined) return false
        const range = Date.parse(to) - Date.parse(from)
        return range > 0 && range <= MAX_INCIDENTS_WINDOW_DAYS * DAY_MS
    })

export const getIncidents = defineRoute<Env>()({
    method: 'get',
    path: '/',
    schemas: { query: incidentsQuerySchema },
    handler: async (c) => {
        const query = c.req.valid('query')
        const now = Date.now()
        const from =
            query.from === undefined ? new Date(now - DEFAULT_INCIDENTS_WINDOW_MINUTES * 60_000) : new Date(query.from)
        const to = query.to === undefined ? new Date(now) : new Date(query.to)
        return c.json(await c.get('incidentsService').list({ from, to }))
    },
})

export const postIncident = defineRoute<Env>()({
    method: 'post',
    path: '/',
    schemas: { json: incidentInputSchema },
    handler: async (c) => {
        const incident = await c.get('incidentsService').submit(c.req.valid('json'), {
            clientHash: requestFingerprint(c),
            cooldownSeconds: c.get('config').reportCooldownSeconds,
        })
        return c.json(incident)
    },
})
