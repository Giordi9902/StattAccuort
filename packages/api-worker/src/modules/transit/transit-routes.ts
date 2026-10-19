import { ROUTE_TYPES } from '@stattaccuort/cities'
import { z } from 'zod'

import { Env, reportError } from '../../app-env'
import { defineRoute } from '../../common/router'

export const getStations = defineRoute<Env>()({
    method: 'get' as const,
    path: '/stations',
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getStations())
    },
})

const linesResponseSchema = z.array(
    z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(ROUTE_TYPES),
        isCircular: z.boolean(),
        color: z.string(),
        stations: z.array(z.string()),
    })
)

export const getLines = defineRoute<Env>()({
    method: 'get' as const,
    path: '/lines',
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        // Validate the output so an out-of-enum line type (e.g. a stale
        // "unknown") fails loudly here instead of leaking to clients.
        const lines = linesResponseSchema.parse(await transitNetworkDataService.getLines())
        return c.json(lines)
    },
})

export const getSegments = defineRoute<Env>()({
    method: 'get' as const,
    path: '/segments',
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getSegments())
    },
})

export const getDepartures = defineRoute<Env>()({
    method: 'get' as const,
    path: '/:stationId',
    schemas: {
        param: z.object({ stationId: z.string().min(1).max(16) }),
    },
    handler: async (c) => {
        const { stationId } = c.req.valid('param')
        const logger = c.get('logger')
        const result = await c.get('departuresService').getDepartures(stationId, (error) => {
            // A broken live board degrades to scheduled-only; surface it without failing the request.
            logger.warn(
                { stationId, error: error instanceof Error ? error.message : String(error) },
                'EAV board unavailable'
            )
            reportError(error, { tags: { source: 'eav-board' }, extra: { stationId } })
        })
        return c.json(result)
    },
})

export const getDistance = defineRoute<Env>()({
    method: 'get' as const,
    path: '/distance',
    schemas: {
        query: z.object({
            from: z.string().min(1),
            to: z.string().min(1),
        }),
    },
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        const query = c.req.valid('query')
        const distance = await transitNetworkDataService.getDistance(query.from, query.to)
        c.header('Cache-Control', 'no-store')
        return c.json({ distance })
    },
})
