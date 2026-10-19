import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'

import { AppError } from '../../common/errors'
import { reportsSubmitted } from '../../common/metrics'
import { type DbConnection, incidents } from '../../db'
import { rateLimited } from '../report-intake'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'

import { type Incident, INCIDENT_LIFETIME_MINUTES, type IncidentInput } from './incidents-contract'

const MINUTE_MS = 60_000

const invalidPlace = (description: string) =>
    new AppError({
        message: 'Unknown station or line',
        statusCode: 400,
        internalCode: 'VALIDATION_FAILED',
        description,
    })

type Row = typeof incidents.$inferSelect

const toIncident = (
    row: Pick<Row, 'incidentId' | 'kind' | 'stationId' | 'lineId' | 'delayMinutes' | 'timestamp'>
): Incident => ({
    incidentId: row.incidentId,
    kind: row.kind,
    stationId: row.stationId,
    lineId: row.lineId,
    delayMinutes: row.delayMinutes,
    timestamp: row.timestamp.toISOString(),
    expiresAt: new Date(row.timestamp.getTime() + INCIDENT_LIFETIME_MINUTES[row.kind] * MINUTE_MS).toISOString(),
})

const COLUMNS = {
    incidentId: incidents.incidentId,
    kind: incidents.kind,
    stationId: incidents.stationId,
    lineId: incidents.lineId,
    delayMinutes: incidents.delayMinutes,
    timestamp: incidents.timestamp,
}

export class IncidentsService {
    constructor(
        private readonly db: DbConnection,
        private readonly transitNetworkDataService: TransitNetworkDataService
    ) {}

    async list({ from, to }: { from: Date; to: Date }): Promise<Incident[]> {
        const rows = await this.db
            .select(COLUMNS)
            .from(incidents)
            .where(and(gte(incidents.timestamp, from), lte(incidents.timestamp, to)))
            .orderBy(desc(incidents.timestamp))
        return rows.map(toIncident)
    }

    /** The station and line must exist, and a station given with a line must be on it. */
    private async assertKnownPlace(input: IncidentInput): Promise<void> {
        const [stations, lines] = await Promise.all([
            this.transitNetworkDataService.getStations(),
            this.transitNetworkDataService.getLines(),
        ])
        const stationId = input.stationId ?? null
        const lineId = input.lineId ?? null
        if (stationId !== null && !(stationId in stations)) {
            throw invalidPlace(`No station with id "${input.stationId}"`)
        }
        if (lineId !== null) {
            const line = lines.find((candidate) => candidate.id === lineId)
            if (line === undefined) throw invalidPlace(`No line with id "${input.lineId}"`)
            if (stationId !== null && !line.stations.includes(stationId)) {
                throw invalidPlace(`Station "${input.stationId}" is not on line "${input.lineId}"`)
            }
        }
    }

    /*
     * Rate limited per device *and kind*, so a rider stuck on a late train can still report
     * pickpockets, but cannot repeat the same delay over and over. Same advisory lock as report
     * intake, so concurrent submissions from one device are serialised across replicas.
     */
    async submit(
        input: IncidentInput,
        { clientHash, cooldownSeconds, now = new Date() }: { clientHash: string; cooldownSeconds: number; now?: Date }
    ): Promise<Incident> {
        await this.assertKnownPlace(input)

        const created = await this.db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clientHash}))`)

            if (cooldownSeconds > 0) {
                const since = new Date(now.getTime() - cooldownSeconds * 1000)
                const [recent] = await tx
                    .select({ incidentId: incidents.incidentId })
                    .from(incidents)
                    .where(
                        and(
                            eq(incidents.clientHash, clientHash),
                            eq(incidents.kind, input.kind),
                            gte(incidents.timestamp, since)
                        )
                    )
                    .limit(1)
                if (recent !== undefined) {
                    reportsSubmitted.inc({ kind: input.kind, outcome: 'rate_limited' })
                    throw rateLimited(cooldownSeconds)
                }
            }

            const [row] = await tx
                .insert(incidents)
                .values({
                    kind: input.kind,
                    stationId: input.stationId ?? null,
                    lineId: input.lineId ?? null,
                    delayMinutes: input.kind === 'delay' ? (input.delayMinutes ?? null) : null,
                    source: input.source,
                    timestamp: now,
                    clientHash,
                })
                .returning(COLUMNS)
            return row
        })

        reportsSubmitted.inc({ kind: input.kind, outcome: 'created' })
        return toIncident(created)
    }
}
