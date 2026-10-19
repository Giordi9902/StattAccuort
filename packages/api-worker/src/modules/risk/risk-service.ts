import { DateTime } from 'luxon'

import { AppError } from '../../common/errors'
import type { IncidentsService } from '../incidents'
import type { ReportsService, ViewerContext } from '../reports/reports-service'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'

import { incidentRiskBySegment } from './incident-risk'
import {
    type CombinedSegmentRisk,
    combineSegmentRisk,
    inspectionRiskBySegment,
    type RiskModelReport,
    type RiskModelSegment,
} from './risk-model'

/*
 * `risk` and `color` combine every factor; `factors` keeps each one (inspection, delay, disruption,
 * pickpocket) so the map can show a subset, or say why a line is red.
 */
type RiskData = {
    segments_risk: Record<string, CombinedSegmentRisk>
}

// Reaches back as far as the longest-lived incident; older ones have expired and weigh nothing.
const INCIDENT_LOOKBACK_HOURS = 2

export class RiskService {
    constructor(
        private reportsService: ReportsService,
        private transitNetworkDataService: TransitNetworkDataService,
        private incidentsService: IncidentsService
    ) {}

    /*
     * The model runs in-process in a few milliseconds, so each request recomputes
     * from the latest reports instead of being served from a cache. This keeps the
     * output always fresh and removes the need to invalidate on new reports.
     */
    async getRisk({
        now = DateTime.utc(),
        viewer,
    }: { now?: DateTime; viewer?: ViewerContext } = {}): Promise<RiskData> {
        const oneHourAgo = now.minus({ hours: 1 })

        /*
         * Live reports only, the same set the map draws markers for. Risk spreads a report's weight
         * several segments along its line, so feeding it reports that have already expired off the
         * map is what paints a red line with no marker anywhere near it. The model still applies
         * its own temporal decay on top; expiry only decides which reports it gets to see at all.
         */
        const [segmentCollection, liveReports, stations, lines, incidents] = await Promise.all([
            this.transitNetworkDataService.getSegments(),
            this.reportsService.getLiveReports({ from: oneHourAgo, to: now, currentTime: now, viewer }),
            this.transitNetworkDataService.getStations(),
            this.transitNetworkDataService.getLines(),
            this.incidentsService.list({
                from: now.minus({ hours: INCIDENT_LOOKBACK_HOURS }).toJSDate(),
                to: now.toJSDate(),
            }),
        ])

        const circularLineIds = new Set(lines.filter((line) => line.isCircular).map((line) => line.id))

        const segments: RiskModelSegment[] = segmentCollection.features.map((feature) => ({
            sid: String(feature.properties.id),
            lineId: feature.properties.line,
            fromStationId: feature.properties.from,
            toStationId: feature.properties.to,
        }))

        const reports: RiskModelReport[] = liveReports.flatMap((r) => {
            const lines = r.lineId !== null ? [r.lineId] : stations[r.stationId].lines
            if (lines.length === 0) return []
            return [
                {
                    stationId: r.stationId,
                    lines,
                    directionId: r.directionId,
                    timestamp: r.timestamp,
                },
            ]
        })

        try {
            const at = now.toJSDate()
            return {
                segments_risk: combineSegmentRisk(segments, {
                    inspection: inspectionRiskBySegment(segments, reports, at, circularLineIds),
                    ...incidentRiskBySegment(segments, incidents, lines, stations, at, circularLineIds),
                }),
            }
        } catch (error) {
            throw new AppError({
                message: 'Risk model failed',
                statusCode: 500,
                internalCode: 'RISK_MODEL_FAILED',
                description: error instanceof Error ? error.message : String(error),
            })
        }
    }
}
