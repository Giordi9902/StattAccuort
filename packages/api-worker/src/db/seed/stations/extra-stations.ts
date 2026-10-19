import { logger } from '../../../common/logger'
import { EXTRA_ROUTE_STATIONS, type RouteType } from '../config'

import { haversine } from './merge-proximate'
import type { OsmElement, OsmNode, OsmRelation, OsmRelationMember } from './overpass'

type ExtraRouteStations = Partial<Record<RouteType, Readonly<Record<string, readonly number[]>>>>

const coordinatesOf = (node: OsmNode) => ({ latitude: node.lat, longitude: node.lon })

/**
 * Index into `members` to insert `station` at: after the stop where it lengthens the route least
 * (cheapest insertion), or at either end when it lies beyond a terminal.
 */
const insertionIndex = (
    members: readonly OsmRelationMember[],
    station: OsmNode,
    nodes: ReadonlyMap<number, OsmNode>
) => {
    const stops = members
        .map((member, index) => ({ index, node: member.type === 'node' ? nodes.get(member.ref) : undefined }))
        .filter((stop): stop is { index: number; node: OsmNode } => stop.node !== undefined)
    if (stops.length === 0) return members.length

    const at = coordinatesOf(station)
    const distance = (node: OsmNode) => haversine(coordinatesOf(node), at)
    let best = { index: stops[0].index, cost: distance(stops[0].node) }
    const last = stops[stops.length - 1]
    if (distance(last.node) < best.cost) best = { index: last.index + 1, cost: distance(last.node) }
    for (let i = 0; i + 1 < stops.length; i++) {
        const from = stops[i].node
        const to = stops[i + 1].node
        const cost = distance(from) + distance(to) - haversine(coordinatesOf(from), coordinatesOf(to))
        if (cost < best.cost) best = { index: stops[i].index + 1, cost }
    }
    return best.index
}

/**
 * Add the configured extra stations to the route relations of their lines, so the rest of the
 * seed treats them as if OSM listed them. Returns new relation objects; the input is not mutated.
 */
export const addExtraRouteStations = (
    elements: OsmElement[],
    extras: ExtraRouteStations = EXTRA_ROUTE_STATIONS
): OsmElement[] => {
    const nodes = new Map<number, OsmNode>()
    for (const element of elements) if (element.type === 'node') nodes.set(element.id, element as OsmNode)

    const warned = new Set<number>()
    return elements.map((element) => {
        if (element.type !== 'relation') return element
        const relation = element as OsmRelation
        const { type, route, ref } = relation.tags ?? {}
        const stationIds = type === 'route' && ref !== undefined ? extras[route as RouteType]?.[ref] : undefined
        if (stationIds === undefined) return element

        const members = [...relation.members]
        for (const stationId of stationIds) {
            const station = nodes.get(stationId)
            if (station === undefined) {
                if (!warned.has(stationId)) {
                    logger.warn(
                        `[seed:stations] Extra station node ${stationId} for ${route} ${ref} is not in the snapshot — run the refresh`
                    )
                    warned.add(stationId)
                }
                continue
            }
            if (members.some((member) => member.type === 'node' && member.ref === stationId)) continue
            members.splice(insertionIndex(members, station, nodes), 0, { type: 'node', ref: stationId, role: 'stop' })
        }
        return { ...relation, members }
    })
}
