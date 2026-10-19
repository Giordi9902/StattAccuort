import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'languageSwitcher';

i18n.addResourceBundle('en', NAMESPACE, {
  language: 'Language',
  label: 'Switch language',
  auto: 'Auto',
  en: 'English',
  it: 'Italian',
});

i18n.addResourceBundle('it', NAMESPACE, {
  language: 'Lingua',
  label: 'Cambia lingua',
  auto: 'Automatica',
  en: 'Inglese',
  it: 'Italiano',
});
