import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'stationDepartures';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Next departures',
  now: 'now',
  inMinutes: 'in {{count}} min',
  delay: '+{{count}} min',
  platform: 'Platf. {{platform}}',
  sourceSchedule: 'Scheduled times (ANM)',
  sourceLive: 'Live (EAV)',
  sourceBoth: 'Scheduled times (ANM) and live (EAV)',
  empty: 'No departures in the next 90 minutes.',
  unavailable: 'Timetables not available for this station.',
  error: 'Departures could not be loaded.',
});

i18n.addResourceBundle('it', NAMESPACE, {
  title: 'Prossimi passaggi',
  now: 'ora',
  inMinutes: 'tra {{count}} min',
  delay: '+{{count}} min',
  platform: 'Bin. {{platform}}',
  sourceSchedule: 'Orari programmati (ANM)',
  sourceLive: 'Tempo reale (EAV)',
  sourceBoth: 'Orari programmati (ANM) e tempo reale (EAV)',
  empty: 'Nessun passaggio nei prossimi 90 minuti.',
  unavailable: 'Orari non disponibili per questa stazione.',
  error: 'Impossibile caricare i passaggi.',
});
