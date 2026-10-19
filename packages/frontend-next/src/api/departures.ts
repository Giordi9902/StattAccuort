import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './transit';

export type Departure = {
  lineId: string | null;
  lineName: string;
  destination: string;
  /** Scheduled departure, ISO 8601. */
  time: string;
  /** Minutes late per a live board; null for timetabled data or an on-time train. */
  delayMinutes: number | null;
  source: 'schedule' | 'live';
  platform: string | null;
};

export type Departures = {
  departures: Departure[];
  /** No timetable source covers this station, as opposed to nothing leaving soon. */
  unavailable: boolean;
};

const REFRESH_MS = 30_000;

// Live boards change by the minute, so poll while the station card is open; react-query stops
// the interval once the card unmounts.
export const useDepartures = (stationId: string) =>
  useQuery({
    queryKey: ['departures', stationId] as const,
    queryFn: () =>
      fetchJson<Departures>(`/v0/departures/${encodeURIComponent(stationId)}`, {
        cache: 'no-store',
      }),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });
