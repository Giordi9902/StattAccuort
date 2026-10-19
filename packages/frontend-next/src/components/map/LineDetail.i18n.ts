import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'lineDetail';

i18n.addResourceBundle('en', NAMESPACE, {
  close: 'Close',
  typical: 'Typical {{weekday}} · this line',
  typicalCity: 'Typical {{weekday}} · {{city}}',
  currentActivity: 'Current activity',
  reportsLast24Hours_one: '{{count}} inspection · last 24h',
  reportsLast24Hours_other: '{{count}} inspections · last 24h',
  reportsInLastHour_one: '{{count}} in the last hour',
  reportsInLastHour_other: '{{count}} in the last hour',
  noneInLastHour: 'None in the last hour',
  reportedSightings: 'Reported sightings',
  peak: 'peak {{hour}}:00',
  quietAfter: 'usually quiet after {{hour}}:00',
  usualHotspots: 'Usual hotspots',
  quieterStations_one: '{{count}} quieter station',
  quieterStations_other: '{{count}} quieter stations',
  noHotspots: 'No inspections yet',
  reportSighting: 'Report sighting on the {{line}}',
  chartLabel: 'Reports by hour for a typical {{weekday}}',
});

i18n.addResourceBundle('it', NAMESPACE, {
  close: 'Chiudi',
  typical: '{{weekday}} tipico · questa linea',
  typicalCity: '{{weekday}} tipico · {{city}}',
  currentActivity: 'Attività attuale',
  reportsLast24Hours_one: '{{count}} controllo · ultime 24h',
  reportsLast24Hours_other: '{{count}} controlli · ultime 24h',
  reportsInLastHour_one: "{{count}} nell'ultima ora",
  reportsInLastHour_other: "{{count}} nell'ultima ora",
  noneInLastHour: "Nessuna nell'ultima ora",
  reportedSightings: 'Controlli segnalati',
  peak: 'picco alle {{hour}}:00',
  quietAfter: 'di solito tranquillo dopo le {{hour}}:00',
  usualHotspots: 'Punti caldi abituali',
  quieterStations_one: '{{count}} stazione più tranquilla',
  quieterStations_other: '{{count}} stazioni più tranquille',
  noHotspots: 'Ancora nessun controllo',
  reportSighting: 'Segnala un controllo sulla linea {{line}}',
  chartLabel: 'Segnalazioni per ora in un {{weekday}} tipico',
});
