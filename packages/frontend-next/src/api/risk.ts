import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './transit';

// Mirrors RISK_FACTORS in packages/api-worker/src/modules/risk/risk-model.ts.
export const RISK_FACTORS = ['inspection', 'delay', 'disruption', 'pickpocket'] as const;
export type RiskFactor = (typeof RISK_FACTORS)[number];

/*
 * `risk` combines every factor; `factors` holds each one, so the map can recombine the subset the
 * rider picked without another request. Factors under 0.01 are left out.
 */
export type SegmentRisk = { risk: number; factors?: Partial<Record<RiskFactor, number>> };
export type RiskData = { segments_risk: Record<string, SegmentRisk> };

export const RISK_COLORS = {
  clear: '#13C184',
  moderate: '#FACB3F',
  high: '#F05044',
  severe: '#A92725',
} as const;

export type RiskLevel = keyof typeof RISK_COLORS;

export const riskLevel = (risk: number): RiskLevel => {
  if (risk <= 0.2) return 'clear';
  if (risk <= 0.5) return 'moderate';
  if (risk <= 0.9) return 'high';
  return 'severe';
};

export const riskColor = (risk: number | undefined): string => RISK_COLORS[riskLevel(risk ?? 0)];

/** Same probabilistic OR as the API: each factor can only raise the total, never past 1. */
export function segmentRisk(
  entry: SegmentRisk | undefined,
  hiddenFactors: ReadonlySet<RiskFactor>,
): number {
  if (entry === undefined) return 0;
  if (entry.factors === undefined || hiddenFactors.size === 0) return entry.risk;
  let remaining = 1;
  for (const factor of RISK_FACTORS) {
    if (hiddenFactors.has(factor)) continue;
    remaining *= 1 - (entry.factors[factor] ?? 0);
  }
  return 1 - remaining;
}

export const riskQueryOptions = () =>
  ({
    queryKey: ['risk'] as const,
    queryFn: () => fetchJson<RiskData>('/v0/risk'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    // PWA cold-start freshness is handled once by invalidating on cache restore (see `main.tsx`);
    // `refetchOnReconnect` still refreshes risk when the network comes back.
    refetchOnReconnect: true,
    staleTime: 30_000,
  }) as const;

export const useRisk = () => useQuery(riskQueryOptions());
