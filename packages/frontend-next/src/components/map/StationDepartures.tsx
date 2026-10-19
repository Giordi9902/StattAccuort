import { useTranslation } from 'react-i18next';

import { type Departure, useDepartures } from '@/api/departures';
import { LineBadge } from '@/components/transit/LineBadge';
import { CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { useNow } from '@/hooks/useNow';
import { currentCity } from '@/lib/city';

import { NAMESPACE } from './StationDepartures.i18n';

const MINUTE_MS = 60_000;
// Past an hour, a clock time reads better than "in 74 min".
const RELATIVE_LIMIT_MINUTES = 60;

const clockFormat = new Intl.DateTimeFormat(currentCity.lang, {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: currentCity.timezone,
});

function DepartureRow({ departure, nowMs }: { departure: Departure; nowMs: number }) {
  const { t } = useTranslation(NAMESPACE);
  const scheduledMs = Date.parse(departure.time);
  const expectedMs = scheduledMs + (departure.delayMinutes ?? 0) * MINUTE_MS;
  const minutes = Math.max(0, Math.round((expectedMs - nowMs) / MINUTE_MS));
  const when =
    minutes === 0
      ? t('now')
      : minutes <= RELATIVE_LIMIT_MINUTES
        ? t('inMinutes', { count: minutes })
        : clockFormat.format(expectedMs);

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      {departure.lineName !== '' ? (
        <LineBadge name={departure.lineName} className="h-6 min-w-10" />
      ) : (
        <span className="min-w-10" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{departure.destination}</p>
        <p className="text-muted-foreground text-xs">
          {clockFormat.format(scheduledMs)}
          {departure.platform !== null && ` · ${t('platform', { platform: departure.platform })}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{when}</p>
        {departure.delayMinutes !== null && (
          <p className="text-destructive text-xs font-semibold">
            {t('delay', { count: departure.delayMinutes })}
          </p>
        )}
      </div>
    </li>
  );
}

type StationDeparturesProps = {
  stationId: string;
};

export function StationDepartures({ stationId }: StationDeparturesProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data, isError } = useDepartures(stationId);
  const nowMs = useNow(MINUTE_MS / 2);

  if (!data) {
    if (!isError) return null;
    return (
      <CardContent>
        <p className="text-muted-foreground text-xs">{t('error')}</p>
      </CardContent>
    );
  }

  const hasSchedule = data.departures.some((d) => d.source === 'schedule');
  const hasLive = data.departures.some((d) => d.source === 'live');
  const sourceNote =
    hasSchedule && hasLive
      ? t('sourceBoth')
      : hasLive
        ? t('sourceLive')
        : hasSchedule
          ? t('sourceSchedule')
          : null;

  return (
    <CardContent className="space-y-2">
      <SectionHeading className="text-muted-foreground">{t('title')}</SectionHeading>
      {data.unavailable ? (
        <p className="text-muted-foreground text-sm">{t('unavailable')}</p>
      ) : data.departures.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('empty')}</p>
      ) : (
        <ul className="divide-border max-h-[30dvh] divide-y overflow-y-auto overscroll-contain rounded-md border">
          {data.departures.map((departure) => (
            <DepartureRow
              key={`${departure.source}|${departure.lineName}|${departure.destination}|${departure.time}`}
              departure={departure}
              nowMs={nowMs}
            />
          ))}
        </ul>
      )}
      {sourceNote !== null && (
        <p className="text-muted-foreground text-[0.6875rem]">{sourceNote}</p>
      )}
    </CardContent>
  );
}
