import { useQuery } from '@tanstack/react-query';
import type { Feature, FeatureCollection, LineString } from 'geojson';

import { currentCitySlug } from '@/lib/city';
import { distanceMeters } from '@/lib/geo';
import { requireEnv } from '@/lib/utils';

function resolveApiUrl(configured: string): string {
  if (!import.meta.env.DEV || typeof window === 'undefined') return configured;
  try {
    const url = new URL(configured);
    url.hostname = window.location.hostname;
    return url.origin;
  } catch {
    return configured;
  }
}

export const API_URL = resolveApiUrl(requireEnv('VITE_API_URL'));

type StationId = string;

type StationResponse = {
  name: string;
  coordinates: { latitude: number; longitude: number };
  lines: string[];
};

export type Station = StationResponse & { id: StationId };
export type Stations = Record<StationId, Station>;

export type LineType =
  | 'subway'
  | 'suburban'
  | 'light_rail'
  | 'train'
  | 'funicular'
  | 'tram'
  | 'bus';

// Display ordering for line types (metro → suburban rail → light rail → train → funicular → tram →
// bus). Every rail type and the funicular must rank above tram: line-style.ts treats everything from
// tram down as surface transit, and a funicular is rapid transit to riders (Naples' run between metro
// stations).
export const LINE_TYPE_PRIORITY: Record<LineType, number> = {
  subway: 0,
  suburban: 1,
  light_rail: 2,
  train: 3,
  funicular: 4,
  tram: 5,
  bus: 6,
};

// Canonical display order: by line type, then ascending within a group (L1 before L2).
export function compareLineOrder(
  a: { name: string; type?: LineType },
  b: { name: string; type?: LineType },
): number {
  if (a.type && b.type && LINE_TYPE_PRIORITY[a.type] !== LINE_TYPE_PRIORITY[b.type]) {
    return LINE_TYPE_PRIORITY[a.type] - LINE_TYPE_PRIORITY[b.type];
  }
  const byNumber =
    parseInt(a.name.replace(/\D/g, ''), 10) - parseInt(b.name.replace(/\D/g, ''), 10);
  // NaN when a name has no digits (Naples' "Cumana", "Circumflegrea"), which would make the sort
  // order engine-dependent.
  return Number.isNaN(byNumber) || byNumber === 0
    ? a.name.localeCompare(b.name, undefined, { numeric: true })
    : byNumber;
}

export type Line = {
  id: string;
  name: string;
  type: LineType;
  isCircular: boolean;
  color: string;
  stations: StationId[];
};

export type SegmentProperties = {
  id: number;
  line: string;
  from: StationId;
  to: StationId;
  color: string;
};

export type Segment = Feature<LineString, SegmentProperties>;
export type Segments = FeatureCollection<LineString, SegmentProperties>;

export function resolveStationLineNames(
  lineIds: Station['lines'],
  lines: Line[] | undefined,
): string[] {
  const nameById = new Map<string, string>();
  if (lines) for (const line of lines) nameById.set(line.id, line.name);

  const seen = new Set<string>();
  const names: string[] = [];
  for (const id of lineIds) {
    const name = nameById.get(id) ?? id;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Every API call carries the resolved city so the worker scopes it to the right DB/cache.
  const url = new URL(`${API_URL}${path}`);
  url.searchParams.set('city', currentCitySlug);
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed: ${response.status}`);
  }
  return response.json();
}

/*
 * Transit reference data is edge-cached for 30 days, so we must force the
 * client (browser HTTP cache / native WebView cache) to revalidate rather than
 * blindly serve its stored copy: an id-changing reseed otherwise leaves a
 * client painting risk colours onto stale geometry until the cached entry
 * expires. `no-cache` revalidates with an If-None-Match — a cheap 304 when
 * unchanged, the fresh body (new ETag) right after a reseed.
 */
const REVALIDATE: RequestInit = { cache: 'no-cache' };

export async function fetchStations(): Promise<Stations> {
  const response = await fetchJson<Record<StationId, StationResponse>>(
    '/v0/transit/stations',
    REVALIDATE,
  );
  const stations: Stations = {};
  for (const [id, station] of Object.entries(response)) stations[id] = { ...station, id };
  return stations;
}

export const stationsQueryOptions = () => ({
  queryKey: ['transit', 'stations'] as const,
  queryFn: fetchStations,
});

export const linesQueryOptions = () => ({
  queryKey: ['transit', 'lines'] as const,
  queryFn: () => fetchJson<Line[]>('/v0/transit/lines', REVALIDATE),
});

export const segmentsQueryOptions = () => ({
  queryKey: ['transit', 'segments'] as const,
  queryFn: () => fetchJson<Segments>('/v0/transit/segments', REVALIDATE),
});

export const useStations = () => useQuery(stationsQueryOptions());

export const useLines = () => useQuery(linesQueryOptions());

export const useSegments = () => useQuery(segmentsQueryOptions());

function closestStationId(
  stations: Stations,
  position: { lat: number; lng: number },
): string | null {
  let bestId: string | null = null;
  let bestDistance = Infinity;
  for (const station of Object.values(stations)) {
    const d = distanceMeters(
      position.lat,
      position.lng,
      station.coordinates.latitude,
      station.coordinates.longitude,
    );
    if (d < bestDistance) {
      bestDistance = d;
      bestId = station.id;
    }
  }
  return bestId;
}

export const useStationDistance = (
  toStationId: string,
  position: { lat: number; lng: number } | null,
) => {
  const { data: stations } = useStations();
  const fromStationId = position && stations ? closestStationId(stations, position) : null;

  return useQuery({
    queryKey: ['transit', 'distance', fromStationId, toStationId],
    queryFn: () => {
      const params = new URLSearchParams({ from: fromStationId!, to: toStationId });
      return fetchJson<{ distance: number }>(`/v0/transit/distance?${params.toString()}`).then(
        (data) => data.distance,
      );
    },
    enabled: fromStationId !== null && toStationId.length > 0,
  });
};
