import { Capacitor } from '@capacitor/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { currentCitySlug } from '@/lib/city';

import { SubmitReportError } from './reports';
import { API_URL, fetchJson } from './transit';

// Mirrors packages/api-worker/src/modules/incidents/incidents-contract.ts.
export const INCIDENT_KINDS = ['delay', 'disruption', 'pickpocket'] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];
export const DELAY_MINUTES_OPTIONS = [5, 15, 30, 60] as const;

export type Incident = {
  incidentId: number;
  kind: IncidentKind;
  stationId: string | null;
  lineId: string | null;
  delayMinutes: number | null;
  timestamp: string;
  expiresAt: string;
};

export const isIncidentLive = (incident: Incident, nowMs: number): boolean =>
  new Date(incident.expiresAt).getTime() > nowMs;

const DAY_MS = 24 * 60 * 60 * 1000;

/*
 * Without from/to the API returns the window in which any incident can still be live, so this one
 * query feeds the map, the chip and the detail cards. It polls like the live reports slice.
 */
export const liveIncidentsQueryOptions = () => ({
  queryKey: ['incidents', 'live'] as const,
  queryFn: () => fetchJson<Incident[]>('/v0/incidents'),
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  staleTime: 30_000,
});

export const useIncidents = () => useQuery(liveIncidentsQueryOptions());

export const dayIncidentsQueryOptions = () => ({
  queryKey: ['incidents', 'day'] as const,
  queryFn: () => {
    const now = Date.now();
    const params = new URLSearchParams({
      from: new Date(now - DAY_MS).toISOString(),
      to: new Date(now).toISOString(),
    });
    return fetchJson<Incident[]>(`/v0/incidents?${params.toString()}`);
  },
  refetchOnWindowFocus: true,
  staleTime: 60_000,
});

export type SubmitIncidentInput = {
  kind: IncidentKind;
  stationId: string | null;
  lineId: string | null;
  delayMinutes: number | null;
};

export function useSubmitIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitIncidentInput): Promise<Incident> => {
      const url = new URL(`${API_URL}/v0/incidents`);
      url.searchParams.set('city', currentCitySlug);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ff-platform': Capacitor.getPlatform() },
        body: JSON.stringify({
          ...input,
          source: Capacitor.isNativePlatform() ? 'mobile_app' : 'web_app',
        }),
      });
      if (!response.ok) throw new SubmitReportError(response.status);
      return response.json();
    },
    onSuccess: (incident) => {
      queryClient.setQueryData<Incident[]>(['incidents', 'live'], (current) =>
        current === undefined ? [incident] : [incident, ...current],
      );
      void queryClient.invalidateQueries({ queryKey: ['incidents'] });
      // Incidents feed the risk layer too.
      void queryClient.invalidateQueries({ queryKey: ['risk'] });
    },
  });
}
