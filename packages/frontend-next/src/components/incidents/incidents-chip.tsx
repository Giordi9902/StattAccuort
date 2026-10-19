import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { INCIDENT_KINDS, isIncidentLive, useIncidents } from '@/api/incidents';
import { useNow } from '@/hooks/useNow';
import { REPORT_RECOMPUTE_INTERVAL_MS } from '@/hooks/useReportsLayer';
import { Route as IncidentsRoute } from '@/routes/reports/incidents';

import { IncidentIcon } from './incident-icon';
import { NAMESPACE } from './incidents.i18n';

/** How many alerts are live right now, by kind — the only map entry point for line-wide ones. */
export function IncidentsChip() {
  const { t } = useTranslation(NAMESPACE);
  const { data: incidents } = useIncidents();
  const now = useNow(REPORT_RECOMPUTE_INTERVAL_MS);

  const live = (incidents ?? []).filter((incident) => isIncidentLive(incident, now));
  if (live.length === 0) return null;
  const kinds = INCIDENT_KINDS.filter((kind) => live.some((incident) => incident.kind === kind));

  return (
    <Link
      to={IncidentsRoute.to}
      className="bg-card text-card-foreground hover:bg-card/80 pointer-events-auto flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs font-semibold shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
    >
      <span className="flex gap-0.5">
        {kinds.map((kind) => (
          <IncidentIcon key={kind} kind={kind} className="size-6 rounded-full" />
        ))}
      </span>
      {t('activeCount', { count: live.length })}
    </Link>
  );
}
