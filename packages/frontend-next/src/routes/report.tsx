import { createFileRoute } from '@tanstack/react-router';

import { INCIDENT_KINDS, type IncidentKind } from '@/api/incidents';
import { queryClient } from '@/api/queryClient';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { ReportForm } from '@/components/report/ReportForm';

export type ReportKind = 'inspection' | IncidentKind;

type ReportSearch = { stationId?: string; lineName?: string; kind?: ReportKind };

const isReportKind = (value: unknown): value is ReportKind =>
  value === 'inspection' || (INCIDENT_KINDS as readonly unknown[]).includes(value);

export const Route = createFileRoute('/report')({
  staticData: { legalDisclaimer: false },
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    stationId: typeof search.stationId === 'string' ? search.stationId : undefined,
    lineName: typeof search.lineName === 'string' ? search.lineName : undefined,
    kind: isReportKind(search.kind) ? search.kind : undefined,
  }),
  /*
   * Prefetch what the form renders (stations + lines). Fire-and-forget; no-op if already cached.
   */
  loader: () => {
    void queryClient.prefetchQuery(stationsQueryOptions());
    void queryClient.prefetchQuery(linesQueryOptions());
  },
  component: ReportForm,
});
