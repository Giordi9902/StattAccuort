import { Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { INCIDENT_KINDS } from '@/api/incidents';
import { INCIDENT_STYLE } from '@/components/incidents/incident-kinds';
import { NAMESPACE as INCIDENTS_NAMESPACE } from '@/components/incidents/incidents.i18n';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { ReportKind } from '@/routes/report';

import { NAMESPACE } from './ReportForm.i18n';

const KINDS: ReportKind[] = ['inspection', ...INCIDENT_KINDS];
const INSPECTION_COLOR = '#d63b3b';

type ReportKindPickerProps = {
  value: ReportKind;
  onChange: (kind: ReportKind) => void;
};

export function ReportKindPicker({ value, onChange }: ReportKindPickerProps) {
  const { t } = useTranslation(NAMESPACE);
  const { t: tKind } = useTranslation(INCIDENTS_NAMESPACE);

  return (
    <section className="px-4 pb-4" aria-label={t('whatToReport')}>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('whatToReport')}>
        {KINDS.map((kind) => {
          const selected = kind === value;
          const { color, Icon } =
            kind === 'inspection'
              ? { color: INSPECTION_COLOR, Icon: Ticket }
              : INCIDENT_STYLE[kind];
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                if (selected) return;
                track('report_kind_selected', { kind });
                onChange(kind);
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 text-[0.6875rem] font-semibold transition-colors',
                selected
                  ? 'border-foreground bg-muted text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted/60',
              )}
            >
              <span
                className="flex size-8 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: color }}
                aria-hidden
              >
                <Icon className="size-4.5" />
              </span>
              <span className="leading-tight">{tKind(`kind_${kind}`)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
