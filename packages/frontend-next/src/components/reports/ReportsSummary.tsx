import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { isIncidentLive, useIncidents } from '@/api/incidents';
import { IncidentRow } from '@/components/incidents/incident-row';
import { useNow } from '@/hooks/useNow';
import { REPORT_RECOMPUTE_INTERVAL_MS } from '@/hooks/useReportsLayer';
import { Route as IncidentsRoute } from '@/routes/reports/incidents';

import { DAY_MS, HOUR_MS, useReports } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { SectionHeading } from '@/components/ui/section-heading';

import { computeLineScores } from './lineScores';
import { LineScoreList } from './LineScoreList';
import { NAMESPACE } from './Reports.i18n';
import { ReportRow } from './ReportRow';

const TOP_LINES_LIMIT = 4;
const RECENT_LIMIT = 6;
const ALERTS_LIMIT = 3;

// The live alerts, so the summary is never "nothing reported" while there are some.
function ActiveAlerts() {
  const { t } = useTranslation(NAMESPACE);
  const { data: incidents } = useIncidents();
  const now = useNow(REPORT_RECOMPUTE_INTERVAL_MS);
  const live = (incidents ?? []).filter((incident) => isIncidentLive(incident, now));
  if (live.length === 0) return null;

  return (
    <section className="px-4">
      <div className="flex items-center justify-between pt-3">
        <SectionHeading>{t('sectionAlerts')}</SectionHeading>
        <Link
          to={IncidentsRoute.to}
          className="text-muted-foreground hover:text-foreground flex items-center text-xs font-semibold"
        >
          {t('allAlerts')}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="divide-border divide-y">
        {live.slice(0, ALERTS_LIMIT).map((incident) => (
          <li key={incident.incidentId}>
            <IncidentRow incident={incident} now={now} live />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReportsSummary() {
  const { t } = useTranslation(NAMESPACE);
  // Top lines summarise the full day; the recent list only shows the still-"live" last hour.
  const { data: dayReports } = useReports(DAY_MS);
  const { data: recentReports } = useReports(HOUR_MS);
  const { data: stations } = useStations();
  const { data: lines } = useLines();

  const lineScores = computeLineScores(dayReports ?? [], stations, lines);
  const topLines = lineScores.slice(0, TOP_LINES_LIMIT);
  // Percentages are shares of all checks in the window, not just the shown top lines.
  const totalLineScore = lineScores.reduce((sum, line) => sum + line.score, 0);
  const recent = (recentReports ?? [])
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, RECENT_LIMIT);

  return (
    <div className="pb-6">
      <ActiveAlerts />
      {topLines.length > 0 && (
        <section>
          <SectionHeading className="px-4 pt-3">{t('sectionTopLines')}</SectionHeading>
          <LineScoreList scores={topLines} total={totalLineScore} />
        </section>
      )}

      <section>
        <SectionHeading className="px-4 pt-3">{t('sectionRecent')}</SectionHeading>
        {recent.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">{t('emptyRecent')}</p>
        ) : (
          <ul>
            {recent.map((report, index) => (
              <ReportRow
                key={`${report.stationId}-${report.timestamp}-${index}`}
                report={report}
                recent
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
