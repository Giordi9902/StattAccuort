import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { Incident } from '@/api/incidents';
import { useLines, useStations } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { cn } from '@/lib/utils';

import { IncidentIcon } from './incident-icon';
import { NAMESPACE } from './incidents.i18n';

function elapsedLabel(timestamp: string, now: number, t: TFunction<typeof NAMESPACE>) {
  const minutes = Math.floor((now - new Date(timestamp).getTime()) / 60_000);
  if (minutes <= 1) return t('now');
  if (minutes < 60) return t('minutesAgo', { count: minutes });
  return t('hoursAgo', { count: Math.floor(minutes / 60) });
}

type IncidentRowProps = {
  incident: Incident;
  now: number;
  live: boolean;
  /** Hide the station name when the surrounding card is already about that station. */
  hideStation?: boolean;
};

export function IncidentRow({ incident, now, live, hideStation = false }: IncidentRowProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: stations } = useStations();
  const { data: lines } = useLines();

  const lineName = incident.lineId
    ? lines?.find((line) => line.id === incident.lineId)?.name
    : undefined;
  const stationName = incident.stationId ? stations?.[incident.stationId]?.name : undefined;
  const detail =
    incident.kind === 'delay' && incident.delayMinutes !== null
      ? incident.delayMinutes >= 60
        ? t('delayMinutesMax')
        : t('delayMinutes', { count: incident.delayMinutes })
      : null;

  return (
    <div className={cn('flex items-center gap-3 py-2.5', !live && 'opacity-60')}>
      <IncidentIcon kind={incident.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">{t(`kind_${incident.kind}`)}</span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {elapsedLabel(incident.timestamp, now, t)}
          </span>
        </div>
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
          {lineName && <LineBadge name={lineName} className="h-5 min-w-8 px-1.5" />}
          <span className="truncate">
            {[
              hideStation ? undefined : (stationName ?? (lineName ? t('wholeLine') : undefined)),
              detail,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      </div>
    </div>
  );
}
