import { useStations } from '@/api/transit';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { distanceMeters } from '@/lib/geo';
import { safeLocalStorage } from '@/lib/safe-storage';
import { isPreviewBuild } from '@/lib/utils';

export type ReportRejection =
  | { reason: 'too_soon'; waitMinutes: number }
  | { reason: 'too_far'; distanceMeters: number };

const MAX_REPORT_DISTANCE_M = 2000;
/*
 * A fix less precise than this is a guess — a desktop without Wi-Fi is placed from its IP address,
 * often kilometres or a city away — so it can't prove the rider is far from the station. Rejecting
 * on it blocked genuine reports; skipping it only drops a check a precise fix still enforces.
 */
const MAX_TRUSTED_ACCURACY_M = 1000;
const MIN_REPORT_INTERVAL_MS = 15 * 60 * 1000;
const STORAGE_KEY = 'lastReportAt';

function readLastReportAt(): number | null {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

function writeLastReportAt(timestamp: number): void {
  safeLocalStorage.setItem(STORAGE_KEY, String(timestamp));
}

/**
 * Pre-submission guardrails for the report form, kept out of the form itself.
 * `verify` returns the first failing rule, or null when the report may be sent.
 * Disabled entirely in dev so local testing is never blocked.
 */
export function useReportVerification() {
  const { position, accuracy } = useGeolocation();
  const { data: stations } = useStations();

  const verify = (stationId: string): ReportRejection | null => {
    if (import.meta.env.DEV || isPreviewBuild) return null;

    const trustedFix = accuracy === null || accuracy <= MAX_TRUSTED_ACCURACY_M;
    if (position && trustedFix) {
      const station = stations?.[stationId];
      if (station) {
        const distance = distanceMeters(
          position.lat,
          position.lng,
          station.coordinates.latitude,
          station.coordinates.longitude,
        );
        if (distance > MAX_REPORT_DISTANCE_M) {
          return { reason: 'too_far', distanceMeters: distance };
        }
      }
    }

    const lastReportAt = readLastReportAt();
    if (lastReportAt !== null && Date.now() - lastReportAt < MIN_REPORT_INTERVAL_MS) {
      return {
        reason: 'too_soon',
        waitMinutes: Math.max(
          1,
          Math.ceil((lastReportAt + MIN_REPORT_INTERVAL_MS - Date.now()) / 60_000),
        ),
      };
    }

    return null;
  };

  const recordSubmission = () => writeLastReportAt(Date.now());

  return { verify, recordSubmission };
}
