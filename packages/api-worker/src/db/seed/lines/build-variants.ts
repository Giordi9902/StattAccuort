import { logger } from '../../../common/logger'
import {
    ROUTE_TYPE_PRIORITY,
    isSeedLineIncluded,
    resolveLineColor,
    resolveLineIdBase,
    resolveLineName,
    resolveRouteType,
    type RouteType,
} from '../config'
import type { OsmRelation } from '../stations/overpass'

export interface LineVariant {
    /** Final `lines.id` value. */
    id: string
    /** OSM ref the id derives from (e.g. "M1"). */
    ref: string
    /** Display name written to `lines.name` — the ref unless the city aliases it. */
    name: string
    /** Transport type derived from the OSM `route` tag, restricted to the configured set. */
    type: RouteType
    /** Hex color written to `lines.color`; segments inherit it. */
    color: string
    stationIds: string[]
    osmRelationId: number
    isCircular: boolean
}

interface RawVariant {
    ref: string
    /** `lines.id` before the variant suffix — the ref unless the city overrides it. */
    idBase: string
    name: string
    type: RouteType
    color: string
    osmRelationId: number
    stationIds: string[]
    isCircular: boolean
}

const isRouteType = (value: string | undefined): value is RouteType =>
    value !== undefined && (ROUTE_TYPE_PRIORITY as readonly string[]).includes(value)

const LINE_ID_MAX_LENGTH = 16
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

const resolveRouteStations = (rel: OsmRelation, nodeIdToStationId: Map<number, string>): string[] => {
    const result: string[] = []
    for (const member of rel.members) {
        if (member.type !== 'node') continue
        const stationId = nodeIdToStationId.get(member.ref)
        if (stationId === undefined) continue
        if (result.length > 0 && result[result.length - 1] === stationId) continue
        result.push(stationId)
    }
    return result
}

const terminalPairKey = (stationIds: string[]): string => {
    const first = stationIds[0]
    const last = stationIds[stationIds.length - 1]
    return first < last ? `${first}|${last}` : `${last}|${first}`
}

const isStrictSubset = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
    if (a.size >= b.size) return false
    for (const item of a) {
        if (!b.has(item)) return false
    }
    return true
}

const pickLongest = (variants: RawVariant[]): RawVariant =>
    variants.reduce((best, v) => (v.stationIds.length > best.stationIds.length ? v : best))

const covers = (outer: RawVariant, inner: RawVariant): boolean => {
    const stations = new Set(outer.stationIds)
    return inner.stationIds.every((id) => stations.has(id))
}

/*
 * Forward/backward runs between the same terminals collapse into the longest one — unless a run
 * serves stations the longest doesn't. Bus directions often take different streets (one-way
 * systems, a loop at the end), and folding those away would drop their stops from the network.
 */
const collapseTerminalPairGroup = (variants: RawVariant[]): RawVariant[] => {
    const longest = pickLongest(variants)
    return [longest, ...variants.filter((v) => v !== longest && !covers(longest, v))]
}

const dropSubsetVariants = (variants: RawVariant[]): RawVariant[] => {
    const sets = variants.map((v) => new Set(v.stationIds))
    return variants.filter((_, i) => !sets.some((other, j) => i !== j && isStrictSubset(sets[i], other)))
}

const suffixFor = (index: number): string => {
    if (index < LETTERS.length) return LETTERS[index]
    const first = Math.floor(index / LETTERS.length) - 1
    const second = index % LETTERS.length
    return `${LETTERS[first]}${LETTERS[second]}`
}

const assignVariantId = (idBase: string, suffix: string | null): string => {
    const id = suffix === null ? idBase : `${idBase}-${suffix}`
    if (id.length > LINE_ID_MAX_LENGTH) {
        throw new Error(`[seed:lines] Variant id "${id}" exceeds ${LINE_ID_MAX_LENGTH} chars (lines.id column width).`)
    }
    return id
}

/**
 * Ring lines (circular routes) start and end at the same station. The
 * line_stations PK is (line_id, station_id), so the closing duplicate must be
 * dropped and the circular flag recorded instead. A defensive dedup afterwards
 * warns and skips further repeats rather than crashing on constraint violation.
 */
const normalizeSequence = (ref: string, stationIds: string[]): { stationIds: string[]; isCircular: boolean } => {
    const isCircular = stationIds.length > 2 && stationIds[0] === stationIds[stationIds.length - 1]
    const trimmed = isCircular ? stationIds.slice(0, -1) : stationIds
    const seen = new Set<string>()
    const deduped: string[] = []
    let droppedDuplicates = 0
    for (const id of trimmed) {
        if (seen.has(id)) {
            droppedDuplicates++
            continue
        }
        seen.add(id)
        deduped.push(id)
    }
    if (droppedDuplicates > 0) {
        logger.warn(
            `[seed:lines] ${ref}: dropped ${droppedDuplicates} repeated station(s) to satisfy (line_id, station_id) PK`
        )
    }
    return { stationIds: deduped, isCircular }
}

export const buildLineVariants = (relations: OsmRelation[], nodeIdToStationId: Map<number, string>): LineVariant[] => {
    const raw: RawVariant[] = []
    let skippedNoRef = 0
    let skippedTooShort = 0
    let skippedUnknownType = 0
    let skippedRefPattern = 0

    for (const rel of relations) {
        const tags: Record<string, string | undefined> = rel.tags ?? {}
        const ref = tags.ref
        if (ref === undefined || ref === '') {
            skippedNoRef++
            continue
        }
        if (!isRouteType(tags.route)) {
            skippedUnknownType++
            continue
        }
        // Ids and names are configured per OSM type; the line itself is seeded as the resolved type.
        const osmType: RouteType = tags.route
        const type = resolveRouteType(osmType, ref)

        // Re-apply the filtering the Overpass discovery already did, now that
        // The route type is known, so an over-complete snapshot — a ref shared
        // Across route types, or one fetched before the patterns existed — can't
        // Widen the seeded network.
        if (!isSeedLineIncluded(tags)) {
            skippedRefPattern++
            continue
        }

        const resolved = resolveRouteStations(rel, nodeIdToStationId)
        if (resolved.length < 2) {
            skippedTooShort++
            continue
        }
        const { stationIds, isCircular } = normalizeSequence(ref, resolved)
        if (stationIds.length < 2) {
            skippedTooShort++
            continue
        }

        const color = resolveLineColor(tags)
        raw.push({
            ref,
            idBase: resolveLineIdBase(ref, osmType),
            name: resolveLineName(ref, osmType),
            type,
            color,
            osmRelationId: rel.id,
            stationIds,
            isCircular,
        })
    }

    logger.info(
        `[seed:lines] Parsed ${raw.length} route variants (${skippedNoRef} no-ref, ${skippedTooShort} too-short, ${skippedUnknownType} unsupported route type, ${skippedRefPattern} ref-pattern filtered)`
    )

    const byIdBase = new Map<string, RawVariant[]>()
    for (const v of raw) {
        const list = byIdBase.get(v.idBase) ?? []
        list.push(v)
        byIdBase.set(v.idBase, list)
    }

    const result: LineVariant[] = []

    for (const [idBase, variants] of byIdBase) {
        // The same id base on two route types (a bus "2" next to metro L2) would silently fold
        // Into one line. Fail loudly instead; the city's lineIds or routeRefPatterns must keep
        // The types' ids disjoint.
        const types = new Set(variants.map((v) => v.type))
        if (types.size > 1) {
            throw new Error(
                `Line id "${idBase}" is used by several route types (${Array.from(types).join(', ')}) — ` +
                    'give one of them a distinct id in lineIds, or narrow routeRefPatterns'
            )
        }
        const { ref } = variants[0]

        // Collapse forward/backward pairs by unordered terminal pair — keep the longest per group.
        const byTerminalPair = new Map<string, RawVariant[]>()
        for (const v of variants) {
            const key = terminalPairKey(v.stationIds)
            const list = byTerminalPair.get(key) ?? []
            list.push(v)
            byTerminalPair.set(key, list)
        }

        const collapsed = Array.from(byTerminalPair.values()).flatMap(collapseTerminalPairGroup)
        const filtered = dropSubsetVariants(collapsed)

        // Deterministic order: by terminal-pair key, then by the run's own stations (two directions
        // Between the same terminals).
        filtered.sort((a, b) => {
            const byTerminals = terminalPairKey(a.stationIds).localeCompare(terminalPairKey(b.stationIds))
            return byTerminals !== 0 ? byTerminals : a.stationIds.join('|').localeCompare(b.stationIds.join('|'))
        })

        if (filtered.length === 1) {
            const v = filtered[0]
            result.push({
                id: assignVariantId(idBase, null),
                ref,
                name: v.name,
                type: v.type,
                color: v.color,
                stationIds: v.stationIds,
                osmRelationId: v.osmRelationId,
                isCircular: v.isCircular,
            })
            const ringLabel = v.isCircular ? ' [circular]' : ''
            logger.info(`[seed:lines] ${idBase} → 1 variant (${v.stationIds.length} stations${ringLabel})`)
        } else {
            const suffixes = filtered.map((_, i) => suffixFor(i))
            filtered.forEach((v, i) => {
                result.push({
                    id: assignVariantId(idBase, suffixes[i]),
                    ref,
                    name: v.name,
                    type: v.type,
                    color: v.color,
                    stationIds: v.stationIds,
                    osmRelationId: v.osmRelationId,
                    isCircular: v.isCircular,
                })
            })
            const summary = filtered
                .map(
                    (v, i) => `${assignVariantId(idBase, suffixes[i])}=${v.stationIds.length}${v.isCircular ? '*' : ''}`
                )
                .join(', ')
            const hasCircular = filtered.some((v) => v.isCircular)
            logger.info(
                `[seed:lines] ${idBase} → ${filtered.length} variants (${summary}${hasCircular ? ', *=circular' : ''})`
            )
        }
    }

    return result
}
