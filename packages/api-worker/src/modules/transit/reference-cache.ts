/*
 * Read-through, in-process cache for reference data that only changes on a reseed or a timetable
 * import: stations, lines, segments, the /distance graph inputs, the insights city profile, the
 * departure boards. Each API replica keeps its own copy: after a reseed replicas may disagree for up
 * to one TTL, which is acceptable for data that changes a few times a year and keeps the replicas
 * independent of each other.
 */

import { referenceCacheLookups } from '../../common/metrics'

export type CacheCtx = { ttlMs: number } | undefined

type Entry = { value: Promise<unknown>; expiresAt: number }

const entries = new Map<string, Entry>()

// City-scoped key, so one city's reference data never serves another's.
export const referenceCacheKey = (citySlug: string, key: string): string => `${citySlug}/${key}`

/** Drop every cached entry — after a reseed in the same process, and between tests. */
export const clearReferenceCache = (): void => entries.clear()

/**
 * The cached value for `key`, loading it on a miss. Concurrent misses share one load. Without a
 * ctx (the scripts) every call loads. `maxAgeSeconds` replaces the ctx TTL for data with a lifetime
 * of its own: a live departure board (seconds), the insights profile of one local date (until
 * midnight).
 */
export const cachedReference = async <T>(
    citySlug: string,
    key: string,
    loader: () => Promise<T>,
    ctx: CacheCtx,
    maxAgeSeconds?: number
): Promise<T> => {
    if (ctx === undefined) return loader()

    const cacheKey = referenceCacheKey(citySlug, key)
    const now = Date.now()
    const cached = entries.get(cacheKey)
    if (cached !== undefined && cached.expiresAt > now) {
        referenceCacheLookups.inc({ result: 'hit' })
        return cached.value as Promise<T>
    }
    referenceCacheLookups.inc({ result: 'miss' })

    const ttlMs = maxAgeSeconds === undefined ? ctx.ttlMs : maxAgeSeconds * 1000
    const value = loader()
    entries.set(cacheKey, { value, expiresAt: now + ttlMs })
    // A failed load must not be served from the cache until it expires.
    value.catch(() => {
        if (entries.get(cacheKey)?.value === value) entries.delete(cacheKey)
    })
    return value
}
