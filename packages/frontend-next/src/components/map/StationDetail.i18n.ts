import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'stationDetail';

i18n.addResourceBundle('en', NAMESPACE, {
  reportSighting: 'Report sighting',
  close: 'Close',
  stationReportsLast24Hours_one: '{{count}} inspection · 24h',
  stationReportsLast24Hours_other: '{{count}} inspections · 24h',
  lineReports: 'Explore a line',
  lineReportsDescription: 'See current activity, usual patterns, and hotspots.',
  lineReportsLast24Hours_one: '{{count}} inspection',
  lineReportsLast24Hours_other: '{{count}} inspections',
  inLastHour: '{{count}} in the last hour',
  stationRank: '#{{position}} of {{population}} stations',
  stationReportsLast30Days_one: '{{count}} inspection · 30d',
  stationReportsLast30Days_other: '{{count}} inspections · 30d',
});

i18n.addResourceBundle('it', NAMESPACE, {
  reportSighting: 'Segnala un controllo',
  close: 'Chiudi',
  stationReportsLast24Hours_one: '{{count}} controllo · 24h',
  stationReportsLast24Hours_other: '{{count}} controlli · 24h',
  lineReports: 'Esplora una linea',
  lineReportsDescription: 'Guarda l’attività attuale, gli andamenti abituali e i punti caldi.',
  lineReportsLast24Hours_one: '{{count}} controllo',
  lineReportsLast24Hours_other: '{{count}} controlli',
  inLastHour: "{{count}} nell'ultima ora",
  stationRank: '#{{position}} su {{population}} stazioni',
  stationReportsLast30Days_one: '{{count}} controllo · 30g',
  stationReportsLast30Days_other: '{{count}} controlli · 30g',
});
