import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { dayIncidentsQueryOptions } from '@/api/incidents';
import { queryClient } from '@/api/queryClient';
import { DAY_MS, HOUR_MS, reportsSliceQueryOptions, useReports } from '@/api/reports';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { ReportsTabBar } from '@/components/reports/ReportsTabBar';
import { NAMESPACE } from '@/components/reports/Reports.i18n';
import { PageHeader } from '@/components/templates/PageHeader';
import { track } from '@/lib/analytics';

export const Route = createFileRoute('/reports')({
  staticData: { legalDisclaimer: false },
  // Prefetch what this section renders (the day window + stations + lines). Runs for any reports
  // tab on preload (it's the shared layout). Fire-and-forget so it never blocks the transition;
  // already-cached queries are no-ops. Covers all tabs, so they need no loader of their own.
  loader: () => {
    void queryClient.prefetchQuery(reportsSliceQueryOptions(HOUR_MS, 0));
    void queryClient.prefetchQuery(reportsSliceQueryOptions(DAY_MS, HOUR_MS));
    void queryClient.prefetchQuery(stationsQueryOptions());
    void queryClient.prefetchQuery(linesQueryOptions());
    void queryClient.prefetchQuery(dayIncidentsQueryOptions());
  },
  component: ReportsOverviewLayout,
});

function ReportsOverviewLayout() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const { data: reports } = useReports(DAY_MS);
  const { data: incidents } = useQuery(dayIncidentsQueryOptions());

  // One open event per visit, fired once the count is known (so report_count is the real figure
  // shown, not 0 before the prefetch resolves). The ref guards against re-firing on data refetch.
  const openTracked = useRef(false);
  useEffect(() => {
    if (openTracked.current || reports === undefined) return;
    openTracked.current = true;
    track('reports_overview_opened', { report_count: reports.length });
  }, [reports]);

  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <PageHeader
          title={t('title')}
          onBack={() => navigate({ to: '/' })}
          action={
            <FeedbackButton
              source="reports_overview"
              size="xs"
              className="text-muted-foreground hover:text-foreground"
            />
          }
        />
        {/* Two counts, not one: the page holds both kinds of report and a single "0" over a list of
            alerts read as if nothing had been reported at all. */}
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-4 pt-2 pb-4">
          <span className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-semibold">{reports?.length ?? 0}</span>
            <span className="text-muted-foreground text-sm">{t('summaryCount')}</span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-semibold">{incidents?.length ?? 0}</span>
            <span className="text-muted-foreground text-sm">{t('alertsCount')}</span>
          </span>
        </div>
        <ReportsTabBar />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
