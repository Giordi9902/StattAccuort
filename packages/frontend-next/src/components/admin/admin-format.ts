const MINUTE_S = 60;
const HOUR_S = 3600;
const DAY_S = 86_400;

export function formatCount(value: number, lang: string): string {
  return new Intl.NumberFormat(lang, { notation: value >= 10_000 ? 'compact' : 'standard' }).format(
    value,
  );
}

export function formatBytes(bytes: number, lang: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(lang, {
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

export function formatDuration(seconds: number, lang: string): string {
  const [value, unit] =
    seconds >= DAY_S
      ? [seconds / DAY_S, 'day']
      : seconds >= HOUR_S
        ? [seconds / HOUR_S, 'hour']
        : [Math.max(seconds / MINUTE_S, 0), 'minute'];
  return new Intl.NumberFormat(lang, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 0,
  }).format(Math.floor(value));
}

export function formatRelative(iso: string, now: number, lang: string): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const format = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < HOUR_S) return format.format(Math.round(seconds / MINUTE_S), 'minute');
  if (abs < DAY_S) return format.format(Math.round(seconds / HOUR_S), 'hour');
  return format.format(Math.round(seconds / DAY_S), 'day');
}

/** A bucket's start, at the precision its size calls for. */
export function formatBucket(iso: string, bucketMinutes: number, lang: string, timeZone: string) {
  const options: Intl.DateTimeFormatOptions =
    bucketMinutes >= 1440
      ? { day: 'numeric', month: 'short' }
      : bucketMinutes >= 360
        ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat(lang, { ...options, timeZone }).format(new Date(iso));
}

export function formatDate(isoDate: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${isoDate}T12:00:00`),
  );
}

export function formatBucketSize(bucketMinutes: number, lang: string): string {
  const [value, unit] =
    bucketMinutes >= 1440
      ? [bucketMinutes / 1440, 'day']
      : bucketMinutes >= 60
        ? [bucketMinutes / 60, 'hour']
        : [bucketMinutes, 'minute'];
  return new Intl.NumberFormat(lang, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}
