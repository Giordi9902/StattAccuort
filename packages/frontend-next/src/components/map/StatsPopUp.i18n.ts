import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'statsPopUp';

i18n.addResourceBundle('en', NAMESPACE, {
  reports: 'inspections',
  todayInCity: 'today in {{city}}',
  over: 'Over',
  reporters: 'reporters',
  inCity: 'in {{city}}',
});

i18n.addResourceBundle('it', NAMESPACE, {
  reports: 'controlli',
  todayInCity: 'oggi a {{city}}',
  over: 'Oltre',
  reporters: 'segnalatori',
  inCity: 'a {{city}}',
});
