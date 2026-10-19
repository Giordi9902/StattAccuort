import { Clock, TriangleAlert, Wallet, type LucideIcon } from 'lucide-react';

import type { IncidentKind } from '@/api/incidents';

/*
 * One fixed colour per kind, alongside the inspection red, checked together for colour-blind
 * separation on the dark map. Amber sits closest to the red for deuteranopes, so every marker also
 * carries its kind's icon: colour is never the only cue.
 */
export const INCIDENT_STYLE: Record<IncidentKind, { color: string; Icon: LucideIcon }> = {
  delay: { color: '#b88700', Icon: Clock },
  disruption: { color: '#3b82f6', Icon: TriangleAlert },
  pickpocket: { color: '#0f9f8f', Icon: Wallet },
};
