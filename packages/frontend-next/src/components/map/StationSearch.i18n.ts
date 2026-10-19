import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'stationSearch';

i18n.addResourceBundle('en', NAMESPACE, {
  placeholder: 'Search for a station or line...',
  clear: 'Clear search',
  noResults: 'No stations or lines found',
  openLine: 'Open line {{name}}',
  circularLine: 'Circular line',
});

i18n.addResourceBundle('it', NAMESPACE, {
  placeholder: 'Cerca una stazione o una linea...',
  clear: 'Cancella ricerca',
  noResults: 'Nessuna stazione o linea trovata',
  openLine: 'Apri la linea {{name}}',
  circularLine: 'Linea circolare',
});
