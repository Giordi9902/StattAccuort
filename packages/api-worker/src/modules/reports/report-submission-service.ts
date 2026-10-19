import type { CreatedReport, NormalizedReport } from '../report-intake'

import type { RawReport } from './post-process-report'
import type { ReportsService } from './reports-service'

export class ReportSubmissionService {
    constructor(private readonly reportsService: ReportsService) {}

    /** Normalize a public report against the network, then hand it to `persist` (report intake). */
    async submitPublicReport(
        input: Omit<RawReport, 'source'> & { source: NormalizedReport['source'] },
        persist: (report: NormalizedReport) => Promise<CreatedReport>
    ): Promise<CreatedReport> {
        const normalized = await this.reportsService.postProcessReport(input)
        return persist({
            ...normalized,
            source: input.source,
            lineId: normalized.lineId ?? null,
            directionId: normalized.directionId ?? null,
        })
    }
}
