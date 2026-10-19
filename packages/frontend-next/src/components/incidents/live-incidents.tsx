import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type Incident, isIncidentLive, useIncidents } from '@/api/incidents';
import { CardContent } from '@/components/ui/card';
import { useNow } from '@/hooks/useNow';
import { REPORT_RECOMPUTE_INTERVAL_MS } from '@/hooks/useReportsLayer';
import { Route as ReportRoute } from '@/routes/report';

import { IncidentRow } from './incident-row';
import { NAMESPACE } from './incidents.i18n';

type LiveIncidentsProps = {
  matches: (incident: Incident) => boolean;
  /** Prefills the report form when the rider adds one from here. */
  reportSearch: { stationId?: string; lineName?: string };
  hideStationFor?: string;
};

/** The live incidents relevant to a station or line card, newest first, plus a way to add one. */
export function LiveIncidents({ matches, reportSearch, hideStationFor }: LiveIncidentsProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: incidents } = useIncidents();
  const now = useNow(REPORT_RECOMPUTE_INTERVAL_MS);

  const live = (incidents ?? []).filter(
    (incident) => isIncidentLive(incident, now) && matches(incident),
  );

  return (
    <CardContent className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-text-3 text-[11px] font-semibold tracking-widest uppercase">
          {t('sectionTitle')}
        </h3>
        <Link
          to={ReportRoute.to}
          search={{ ...reportSearch, kind: 'delay' }}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-semibold"
        >
          <Plus className="size-3.5" aria-hidden />
          {t('reportProblem')}
        </Link>
      </div>
      {live.length > 0 && (
        <ul className="divide-border max-h-[24dvh] divide-y overflow-y-auto overscroll-contain">
          {live.map((incident) => (
            <li key={incident.incidentId}>
              <IncidentRow
                incident={incident}
                now={now}
                live
                hideStation={incident.stationId === hideStationFor}
              />
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  );
}
