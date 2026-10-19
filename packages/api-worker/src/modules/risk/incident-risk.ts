import type { Incident } from '../incidents'
import type { Line, Stations } from '../transit/types'

import { buildLineIndexes, combineRiskFactors, type RiskModelSegment, ringSize } from './risk-model'

/*
 * How rider-reported incidents raise a segment's risk. Unlike inspections there is no learned model
 * behind these numbers: they are hand-set weights, chosen so that one fresh report turns the nearby
 * segments yellow, several turn them red, and nothing outlives the incident's own expiry.
 *
 * - Severity: what one fresh report is worth at the place it names.
 * - Reach: how much of it survives each segment away from that place. A delay or a disruption
 *   stalls the whole line, so they carry far; pickpockets are a local danger.
 * - Line-wide: the weight on every segment when the report names a line but no station.
 */
type IncidentProfile = { severity: number; reach: number; maxDistance: number; lineWide: number }

const PROFILES: Record<Incident['kind'], IncidentProfile> = {
    delay: { severity: 0.4, reach: 0.85, maxDistance: Infinity, lineWide: 0.4 },
    disruption: { severity: 0.7, reach: 0.8, maxDistance: Infinity, lineWide: 0.6 },
    pickpocket: { severity: 0.6, reach: 0.5, maxDistance: 1, lineWide: 0.3 },
}

// A longer delay is worth more; unknown keeps the profile's default.
const DELAY_SEVERITY: Record<number, number> = { 5: 0.25, 15: 0.45, 30: 0.65, 60: 0.85 }

const severityOf = (incident: Incident): number =>
    incident.kind === 'delay' && incident.delayMinutes !== null
        ? (DELAY_SEVERITY[incident.delayMinutes] ?? PROFILES.delay.severity)
        : PROFILES[incident.kind].severity

/*
 * Fades linearly to zero at the incident's expiry, the same instant its marker leaves the map, so a
 * coloured segment always has a live alert behind it.
 */
const freshness = (incident: Incident, nowMs: number): number => {
    const start = Date.parse(incident.timestamp)
    const end = Date.parse(incident.expiresAt)
    if (nowMs >= end) return 0
    return Math.min(1, Math.max(0, (end - nowMs) / (end - start)))
}

export type IncidentFactors = Record<Incident['kind'], Map<string, number>>

/**
 * Per kind, the risk each segment gets from the live incidents. Reports of one kind combine as a
 * probabilistic OR, so every further report of the same problem raises the value without passing 1.
 */
export const incidentRiskBySegment = (
    segments: RiskModelSegment[],
    incidents: readonly Incident[],
    lines: readonly Line[],
    stations: Stations,
    now: Date,
    circularLineIds: ReadonlySet<string> = new Set()
): IncidentFactors => {
    const lineIndexes = buildLineIndexes(segments)
    // A report names one variant of a line; it concerns every variant riders know by that name.
    const variantsByName = new Map<string, string[]>()
    const nameById = new Map<string, string>()
    for (const line of lines) {
        nameById.set(line.id, line.name)
        variantsByName.set(line.name, [...(variantsByName.get(line.name) ?? []), line.id])
    }

    // Contributions per kind and segment, combined once at the end.
    const contributions: Record<Incident['kind'], Map<string, number[]>> = {
        delay: new Map(),
        disruption: new Map(),
        pickpocket: new Map(),
    }
    const add = (kind: Incident['kind'], sid: string, value: number) => {
        if (value <= 0) return
        const list = contributions[kind].get(sid)
        if (list) list.push(value)
        else contributions[kind].set(sid, [value])
    }

    const nowMs = now.getTime()
    for (const incident of incidents) {
        const weight = freshness(incident, nowMs)
        if (weight === 0) continue
        const profile = PROFILES[incident.kind]

        const lineName = incident.lineId === null ? undefined : nameById.get(incident.lineId)
        const variantIds =
            lineName !== undefined
                ? (variantsByName.get(lineName) ?? [])
                : incident.stationId !== null
                  ? (stations[incident.stationId]?.lines ?? [])
                  : []

        for (const lineId of variantIds) {
            const lineIndex = lineIndexes.get(lineId)
            if (!lineIndex) continue

            if (incident.stationId === null) {
                for (const segment of lineIndex.segments) add(incident.kind, segment.sid, profile.lineWide * weight)
                continue
            }

            const stationRank = lineIndex.stationRank.get(incident.stationId)
            if (stationRank === undefined) continue
            const lineRingSize = ringSize(lineIndex, circularLineIds.has(lineId))
            const severity = severityOf(incident) * weight
            for (const segment of lineIndex.segments) {
                const linearDistance = Math.abs(segment.rank - stationRank)
                const distance =
                    lineRingSize === null ? linearDistance : Math.min(linearDistance, lineRingSize - linearDistance)
                if (distance > profile.maxDistance) continue
                add(incident.kind, segment.sid, severity * profile.reach ** distance)
            }
        }
    }

    const combine = (byKind: Map<string, number[]>) =>
        new Map([...byKind].map(([sid, values]) => [sid, combineRiskFactors(values)]))
    return {
        delay: combine(contributions.delay),
        disruption: combine(contributions.disruption),
        pickpocket: combine(contributions.pickpocket),
    }
}
