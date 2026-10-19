import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportDetail';

i18n.addResourceBundle('en', NAMESPACE, {
  close: 'Close',
  openStationDetails: 'Open details for {{station}}',
  now: 'Just now',
  minutesAgo: '{{count}} min ago',
  moreThan45Min: 'More than 45 min ago',
  hoursAgo_one: '1 hour ago',
  hoursAgo_other: '{{count}} hours ago',
  times: 'times',
  thisWeek: 'this week',
  oneStationAway: 'one station away',
  stationsAway: '{{count}} stations away',
  inviteText: 'Data may be inaccurate.',
  syncText: 'Reports synced with {{group}}',
});

i18n.addResourceBundle('it', NAMESPACE, {
  close: 'Chiudi',
  openStationDetails: 'Apri i dettagli di {{station}}',
  now: 'Adesso',
  minutesAgo: '{{count}} min fa',
  moreThan45Min: 'Più di 45 min fa',
  hoursAgo_one: '1 ora fa',
  hoursAgo_other: '{{count}} ore fa',
  times: 'volte',
  thisWeek: 'questa settimana',
  oneStationAway: 'a una stazione di distanza',
  stationsAway: 'a {{count}} stazioni di distanza',
  inviteText: 'I dati potrebbero non essere precisi.',
  syncText: 'Segnalazioni sincronizzate con {{group}}',
});
