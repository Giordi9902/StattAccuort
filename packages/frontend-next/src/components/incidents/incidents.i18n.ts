import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'incidents';

i18n.addResourceBundle('en', NAMESPACE, {
  kind_inspection: 'Inspectors',
  kind_delay: 'Delay',
  kind_disruption: 'Disruption',
  kind_pickpocket: 'Pickpockets',
  delayMinutes: '~{{count}} min late',
  delayMinutesMax: '60+ min late',
  wholeLine: 'whole line',
  now: 'just now',
  minutesAgo: '{{count}} min ago',
  hoursAgo: '{{count}} h ago',
  active: 'Active alerts',
  activeCount_one: '{{count}} alert',
  activeCount_other: '{{count}} alerts',
  earlier: 'Earlier today',
  empty: 'No alerts in the last 24 hours.',
  sectionTitle: 'Alerts',
  reportProblem: 'Report a problem',
});

i18n.addResourceBundle('it', NAMESPACE, {
  kind_inspection: 'Controllori',
  kind_delay: 'Ritardo',
  kind_disruption: 'Disservizio',
  kind_pickpocket: 'Borseggiatori',
  delayMinutes: '~{{count}} min di ritardo',
  delayMinutesMax: 'oltre 60 min di ritardo',
  wholeLine: 'tutta la linea',
  now: 'adesso',
  minutesAgo: '{{count}} min fa',
  hoursAgo: '{{count}} h fa',
  active: 'Avvisi attivi',
  activeCount_one: '{{count}} avviso',
  activeCount_other: '{{count}} avvisi',
  earlier: 'Prima, oggi',
  empty: 'Nessun avviso nelle ultime 24 ore.',
  sectionTitle: 'Avvisi',
  reportProblem: 'Segnala un problema',
});
