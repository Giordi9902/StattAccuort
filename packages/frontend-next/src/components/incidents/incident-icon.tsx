import type { IncidentKind } from '@/api/incidents';
import { cn } from '@/lib/utils';

import { INCIDENT_STYLE } from './incident-kinds';

export function IncidentIcon({ kind, className }: { kind: IncidentKind; className?: string }) {
  const { color, Icon } = INCIDENT_STYLE[kind];
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md text-white',
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}
