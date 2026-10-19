import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { currentCitySlug } from '@/lib/city';

import { API_URL } from './transit';

// Mirrors AdminOverview in packages/api-worker/src/modules/admin/admin-contract.ts.
export const ADMIN_WINDOWS = ['1h', '24h', '7d', '30d'] as const;
export type AdminWindow = (typeof ADMIN_WINDOWS)[number];

type Ranked = { id: string; name: string; count: number };

export type AdminOverview = {
  generatedAt: string;
  window: { name: AdminWindow; start: string; end: string; bucketMinutes: number };
  reports: {
    total: number;
    previousTotal: number;
    devices: number;
    bySource: { source: string; count: number }[];
    series: { start: string; count: number }[];
    topStations: Ranked[];
    topLines: Ranked[];
    topDevices: { device: string; count: number; stations: number }[];
    lastReportAt: string | null;
  };
  incidents: { kind: string; count: number }[];
  data: {
    stations: number;
    lines: number;
    segments: number;
    eavBoards: number;
    timetableFirstDate: string | null;
    timetableLastDate: string | null;
  };
  database: { version: string; sizeBytes: number; connections: number; maxConnections: number };
  instance: {
    instanceId: string;
    nodeVersion: string;
    uptimeSeconds: number;
    rssBytes: number;
    heapUsedBytes: number;
    requests: number;
    serverErrors: number;
    rateLimited: number;
  };
};

export class AdminAuthError extends Error {
  readonly status: 401 | 503;

  constructor(status: 401 | 503) {
    super(`Admin request rejected: ${status}`);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

const TOKEN_KEY = 'admin-token';

// Session storage: the token is gone with the tab, and storage may be unavailable (private mode).
export function readAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeAdminToken(token: string | null) {
  try {
    if (token === null) sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // The dashboard still works for this page view; the token just isn't remembered.
  }
}

export async function fetchAdminOverview(
  token: string,
  window: AdminWindow,
): Promise<AdminOverview> {
  const url = new URL(`${API_URL}/v0/admin/overview`);
  url.searchParams.set('city', currentCitySlug);
  url.searchParams.set('window', window);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401 || response.status === 503) throw new AdminAuthError(response.status);
  if (!response.ok) throw new Error(`Admin overview failed: ${response.status}`);
  return response.json();
}

export const adminOverviewQueryOptions = (token: string, window: AdminWindow) =>
  queryOptions({
    // The key holds the token only in memory (see `meta`); signing out removes every ['admin'] query.
    queryKey: ['admin', 'overview', window, token],
    queryFn: () => fetchAdminOverview(token, window),
    staleTime: 30_000,
    refetchInterval: 60_000,
    // Keep the previous window on screen while the next one loads.
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => !(error instanceof AdminAuthError) && failureCount < 2,
    // Never written to the persisted query cache: it is operator data behind a token.
    meta: { persist: false },
  });
