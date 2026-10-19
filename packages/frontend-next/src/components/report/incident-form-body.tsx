import { CircleCheck, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DELAY_MINUTES_OPTIONS, type IncidentKind, useSubmitIncident } from '@/api/incidents';
import { resolveLineId, SubmitReportError } from '@/api/reports';
import { type Line, useLines } from '@/api/transit';
import { NAMESPACE as INCIDENTS_NAMESPACE } from '@/components/incidents/incidents.i18n';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { ToastPill } from '@/components/ui/toast-pill';
import { track } from '@/lib/analytics';
import { captureIssue } from '@/lib/error-monitoring';
import { notifySuccess } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './ReportForm.i18n';
import { useReportSelection } from './ReportSelection.context';

// A line chosen without a station stands for the whole line; any of its variants identifies it.
function lineIdFor(stationId: string | null, lineName: string | null, lines: Line[] | undefined) {
  if (lineName === null) return null;
  if (stationId !== null) return resolveLineId({ stationId, lineName }, lines);
  const candidates = lines?.filter((line) => line.name === lineName) ?? [];
  return (candidates.find((line) => line.id.endsWith('-a')) ?? candidates[0])?.id ?? null;
}

function errorToast(message: string, id: string) {
  toast.custom(
    () => (
      <ToastPill className="bg-destructive flex w-fit items-center gap-2 text-sm font-semibold text-white">
        <TriangleAlert className="size-4" />
        {message}
      </ToastPill>
    ),
    { id },
  );
}

function DelayPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <section className="mt-6 px-4">
      <div className="mb-3">
        <SectionHeading hint={t('optional')}>{t('delayHowLong')}</SectionHeading>
      </div>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('delayHowLong')}>
        {DELAY_MINUTES_OPTIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            role="radio"
            aria-checked={value === minutes}
            onClick={() => onChange(value === minutes ? null : minutes)}
            className={cn(
              'rounded-md border py-2 text-sm font-semibold tabular-nums transition-colors',
              value === minutes
                ? 'border-foreground bg-muted'
                : 'border-border text-muted-foreground hover:bg-muted/60',
            )}
          >
            {minutes >= 60 ? '60+' : minutes} min
          </button>
        ))}
      </div>
    </section>
  );
}

type IncidentFormBodyProps = {
  kind: IncidentKind;
  onSubmitted: () => void;
  renderPlacePickers: (lineSelected: boolean) => ReactNode;
};

export function IncidentFormBody({ kind, onSubmitted, renderPlacePickers }: IncidentFormBodyProps) {
  const { t } = useTranslation(NAMESPACE);
  const { t: tKind } = useTranslation(INCIDENTS_NAMESPACE);
  const { stationId, lineName } = useReportSelection();
  const { data: lines } = useLines();
  const submit = useSubmitIncident();
  const [delayMinutes, setDelayMinutes] = useState<number | null>(null);

  const canSubmit = stationId !== null || lineName !== null;

  const handleSubmit = () => {
    if (!canSubmit) {
      errorToast(t('errorNoPlace'), 'incident-place-required');
      return;
    }
    submit.mutate(
      {
        kind,
        stationId,
        lineId: lineIdFor(stationId, lineName, lines),
        delayMinutes: kind === 'delay' ? delayMinutes : null,
      },
      {
        onSuccess: (incident) => {
          notifySuccess();
          track('incident_submitted', {
            kind,
            stationId: incident.stationId,
            lineId: incident.lineId,
          });
          toast.custom(
            () => (
              <ToastPill className="flex w-fit items-center gap-2 text-sm font-semibold">
                <CircleCheck className="text-ok size-4" />
                {t('incidentSent', { kind: tKind(`kind_${kind}`) })}
              </ToastPill>
            ),
            { id: 'incident-sent' },
          );
          onSubmitted();
        },
        onError: (error) => {
          const status = error instanceof SubmitReportError ? error.status : undefined;
          if (status === 429) {
            errorToast(t('errorIncidentTooSoon'), 'incident-too-soon');
            return;
          }
          captureIssue('Incident submit failed', { status, kind });
          errorToast(t('errorSubmitFailed'), 'incident-submit-error');
        },
      },
    );
  };

  return (
    <>
      {renderPlacePickers(lineName !== null)}
      {kind === 'delay' && <DelayPicker value={delayMinutes} onChange={setDelayMinutes} />}
      <footer className="pb-safe-4 mt-auto px-4 pt-6">
        <Button
          type="button"
          size="lg"
          disabled={submit.isPending}
          aria-disabled={!canSubmit}
          onClick={handleSubmit}
          className={cn(
            'h-12 w-full rounded-lg text-base font-semibold',
            canSubmit
              ? 'bg-foreground text-background hover:bg-foreground/90'
              : 'bg-surface-solid text-muted-foreground border-border border',
          )}
        >
          {t('submitIncident', { kind: tKind(`kind_${kind}`) })}
        </Button>
        <p className="text-muted-foreground mt-2 text-center text-[0.6875rem]">{t('disclaimer')}</p>
      </footer>
    </>
  );
}
