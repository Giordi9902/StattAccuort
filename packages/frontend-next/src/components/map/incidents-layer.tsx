import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Marker } from 'react-map-gl/maplibre';

import { INCIDENT_KINDS, type IncidentKind, isIncidentLive, useIncidents } from '@/api/incidents';
import { useStations } from '@/api/transit';
import { IncidentIcon } from '@/components/incidents/incident-icon';
import { NAMESPACE } from '@/components/incidents/incidents.i18n';
import { useNow } from '@/hooks/useNow';
import { REPORT_RECOMPUTE_INTERVAL_MS } from '@/hooks/useReportsLayer';
import { Route as StationRoute } from '@/routes/_map/station/$stationId';

/*
 * One DOM marker per station with live incidents, one icon per kind. There are few of them at any
 * time, so DOM markers cost nothing and keep the icons crisp. They sit up and to the right of the
 * station so an inspection dot on the same station stays visible. Incidents that name only a line
 * have no single point to sit on; the alerts chip and the line card show them.
 */
export function IncidentsLayer() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const { data: incidents } = useIncidents();
  const { data: stations } = useStations();
  const now = useNow(REPORT_RECOMPUTE_INTERVAL_MS);

  if (!incidents || !stations) return null;

  const kindsByStation = new Map<string, Set<IncidentKind>>();
  for (const incident of incidents) {
    if (incident.stationId === null || !isIncidentLive(incident, now)) continue;
    const kinds = kindsByStation.get(incident.stationId) ?? new Set<IncidentKind>();
    kinds.add(incident.kind);
    kindsByStation.set(incident.stationId, kinds);
  }

  return [...kindsByStation].map(([stationId, kinds]) => {
    const station = stations[stationId];
    if (!station) return null;
    const ordered = INCIDENT_KINDS.filter((kind) => kinds.has(kind));
    return (
      <Marker
        key={stationId}
        longitude={station.coordinates.longitude}
        latitude={station.coordinates.latitude}
        anchor="bottom-left"
        offset={[6, -6]}
      >
        <button
          type="button"
          className="flex gap-0.5 rounded-lg p-0.5 shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          style={{ backgroundColor: 'var(--surface-solid)' }}
          aria-label={`${station.name}: ${ordered.map((kind) => t(`kind_${kind}`)).join(', ')}`}
          onClick={(event) => {
            event.stopPropagation();
            void navigate({ to: StationRoute.to, params: { stationId } });
          }}
        >
          {ordered.map((kind) => (
            <IncidentIcon key={kind} kind={kind} className="size-6 rounded-md" />
          ))}
        </button>
      </Marker>
    );
  });
}
