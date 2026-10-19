import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AdminOverview } from '@/api/admin';
import { cn } from '@/lib/utils';

import { formatBucket, formatBucketSize, formatCount } from './admin-format';
import { NAMESPACE } from './admin.i18n';

type ReportsColumnChartProps = {
  series: AdminOverview['reports']['series'];
  bucketMinutes: number;
  timeZone: string;
};

const CHART_HEIGHT_PX = 160;

// A clean axis maximum (1, 2, 5 × 10ⁿ) at or above the peak, so the top tick is a round number.
function niceMax(peak: number): number {
  if (peak <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= peak) ?? 10;
  return step * magnitude;
}

/*
 * One series, so no legend: the section title names it. Every column slot is the hover target, not
 * just the bar, so a bucket with a single report is as easy to inspect as the peak. The table below
 * carries every value for screen readers.
 */
export function ReportsColumnChart({ series, bucketMinutes, timeZone }: ReportsColumnChartProps) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const [hovered, setHovered] = useState<number | null>(null);
  const lang = i18n.language;

  const peak = Math.max(0, ...series.map((bucket) => bucket.count));
  const axisMax = niceMax(peak);
  const total = series.reduce((sum, bucket) => sum + bucket.count, 0);
  const labelIndexes = new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]);
  const active = hovered === null ? undefined : series[hovered];

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-muted-foreground text-xs">
        {t('bucket', { size: formatBucketSize(bucketMinutes, lang) })}
      </figcaption>
      <div className="flex gap-2">
        <div
          className="text-muted-foreground flex flex-col justify-between text-right text-[0.625rem] tabular-nums"
          style={{ height: CHART_HEIGHT_PX }}
          aria-hidden
        >
          <span>{formatCount(axisMax, lang)}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="border-border-soft pointer-events-none absolute inset-x-0 top-0 border-t" />
          <div
            className="border-border flex items-end gap-[2px] border-b"
            style={{ height: CHART_HEIGHT_PX }}
            onMouseLeave={() => setHovered(null)}
            aria-hidden
          >
            {series.map((bucket, index) => (
              <div
                key={bucket.start}
                className="flex h-full min-w-0 flex-1 items-end justify-center"
                onMouseEnter={() => setHovered(index)}
                onTouchStart={() => setHovered(index)}
              >
                <div
                  className={cn(
                    'w-full max-w-6 rounded-t-[4px] transition-colors',
                    hovered === index ? 'bg-foreground' : 'bg-muted-foreground/65',
                  )}
                  style={{
                    height: `${(bucket.count / axisMax) * 100}%`,
                    // A zero bucket keeps a hairline so the timeline reads as continuous.
                    minHeight: bucket.count > 0 ? 2 : 1,
                  }}
                />
              </div>
            ))}
          </div>
          {active !== undefined && hovered !== null && (
            <div
              className={cn(
                'bg-surface-elev shadow-1 pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-md px-2 py-1 text-xs whitespace-nowrap',
                // Anchored to the column, but kept inside the chart at both ends.
                hovered < series.length / 6
                  ? ''
                  : hovered > (series.length * 5) / 6
                    ? '-translate-x-full'
                    : '-translate-x-1/2',
              )}
              style={{
                left: `${((hovered + 0.5) / series.length) * 100}%`,
              }}
            >
              <div className="text-muted-foreground">
                {formatBucket(active.start, bucketMinutes, lang, timeZone)}
              </div>
              <div className="font-semibold tabular-nums">{formatCount(active.count, lang)}</div>
            </div>
          )}
          <div className="text-muted-foreground relative mt-1 h-4 text-[0.625rem]" aria-hidden>
            {series.map((bucket, index) =>
              labelIndexes.has(index) ? (
                <span
                  key={bucket.start}
                  className={cn(
                    'absolute whitespace-nowrap',
                    index === 0
                      ? ''
                      : index === series.length - 1
                        ? '-translate-x-full'
                        : '-translate-x-1/2',
                  )}
                  style={{
                    left:
                      index === series.length - 1
                        ? '100%'
                        : `${index === 0 ? 0 : ((index + 0.5) / series.length) * 100}%`,
                  }}
                >
                  {formatBucket(bucket.start, bucketMinutes, lang, timeZone)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>
          {t('chartSummary', { total: formatCount(total, lang), peak: formatCount(peak, lang) })}
        </caption>
        <tbody>
          {series.map((bucket) => (
            <tr key={bucket.start}>
              <th scope="row">{formatBucket(bucket.start, bucketMinutes, lang, timeZone)}</th>
              <td>{bucket.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
