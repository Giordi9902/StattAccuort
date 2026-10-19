import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { prefetchLineInsights } from '@/api/insights';
import { DAY_MS, useReports } from '@/api/reports';
import { resolveStationLineNames, type Station, useLines } from '@/api/transit';
import { LiveIncidents } from '@/components/incidents/live-incidents';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useModalViewDuration } from '@/hooks/useModalViewDuration';
import { Route as ReportRoute } from '@/routes/report';

import { DetailCard } from './DetailCard';
import { StationDepartures } from './StationDepartures';
import { NAMESPACE } from './StationDetail.i18n';
import { StationLineReports } from './StationLineReports';
import { StationHistoricalInsights } from './StationHistoricalInsights';
import { stationLiveData } from './station-detail-data';

type StationDetailProps = {
  station: Station;
  onClose: () => void;
};

export function StationDetail({ station, onClose }: StationDetailProps) {
  const { t } = useTranslation(NAMESPACE);
  const queryClient = useQueryClient();
  const { data: lines } = useLines();
  const { data: reports, isSuccess: hasLiveReports } = useReports(DAY_MS);
  const { lineReports } = stationLiveData(station, lines, reports);
  // A line-wide incident on any line through this station concerns its riders too. Compared by
  // line name: the incident names one variant, the station may sit on another.
  const stationLineNames = new Set(lines ? resolveStationLineNames(station.lines, lines) : []);
  const lineNameById = new Map(lines?.map((line) => [line.id, line.name]));
  useModalViewDuration('station');

  useEffect(() => {
    if (!lines) return;
    prefetchLineInsights(queryClient, resolveStationLineNames(station.lines, lines));
  }, [lines, queryClient, station.lines]);

  return (
    <DetailCard
      title={station.name}
      closeLabel={t('close')}
      onClose={onClose}
      cardClassName="max-h-[calc(100dvh-6rem)]"
    >
      <StationHistoricalInsights stationId={station.id} />
      <StationDepartures stationId={station.id} />
      <LiveIncidents
        matches={(incident) =>
          incident.stationId === station.id ||
          (incident.stationId === null &&
            incident.lineId !== null &&
            stationLineNames.has(lineNameById.get(incident.lineId) ?? ''))
        }
        reportSearch={{ stationId: station.id }}
        hideStationFor={station.id}
      />
      {hasLiveReports && lineReports.length > 0 && <StationLineReports lineReports={lineReports} />}
      <CardContent className="mt-2">
        <Button
          asChild
          variant="default"
          className="bg-destructive hover:bg-destructive/90 h-11 w-full text-sm font-semibold text-white"
        >
          <Link to={ReportRoute.to} search={{ stationId: station.id }}>
            {t('reportSighting')}
          </Link>
        </Button>
      </CardContent>
    </DetailCard>
  );
}
