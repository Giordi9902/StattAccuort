import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { dayIncidentsQueryOptions, isIncidentLive } from '@/api/incidents';
import { SectionHeading } from '@/components/ui/section-heading';
import { useNow } from '@/hooks/useNow';
import { REPORT_RECOMPUTE_INTERVAL_MS } from '@/hooks/useReportsLayer';

import { IncidentRow } from './incident-row';
import { NAMESPACE } from './incidents.i18n';

/** The last 24 hours of alerts: the live ones first, then what already expired today. */
export function IncidentsList() {
  const { t } = useTranslation(NAMESPACE);
  const { data: incidents } = useQuery(dayIncidentsQueryOptions());
  const now = useNow(REPORT_RECOMPUTE_INTERVAL_MS);

  if (incidents === undefined) return null;
  if (incidents.length === 0) {
    return <p className="text-muted-foreground px-4 py-6 text-sm">{t('empty')}</p>;
  }

  const live = incidents.filter((incident) => isIncidentLive(incident, now));
  const earlier = incidents.filter((incident) => !isIncidentLive(incident, now));

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {[
        { key: 'active', items: live, isLive: true },
        { key: 'earlier', items: earlier, isLive: false },
      ].map(({ key, items, isLive }) =>
        items.length === 0 ? null : (
          <section key={key}>
            <SectionHeading>{t(key)}</SectionHeading>
            <ul className="divide-border divide-y">
              {items.map((incident) => (
                <li key={incident.incidentId}>
                  <IncidentRow incident={incident} now={now} live={isLive} />
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
