import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'it',
    supportedLngs: ['it', 'en'],
    // Without this, a detected code like 'it-IT' or 'it-CH' (which most browsers and iOS report
    // instead of plain 'it') doesn't exactly match supportedLngs and silently falls back. This
    // strips the region before matching, so any 'it-*' resolves to 'it'.
    load: 'languageOnly',
    defaultNS: false,
    interpolation: { escapeValue: false },
    detection: {
      // Keep detection to what this app actually uses: a persisted user choice (mirrored via
      // lib/language.ts) or the device/browser locale. No querystring/cookie lookup — this app
      // has no `?lng=` entry point and no cookie-consent story for one.
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
};

syncHtmlLang(i18n.resolvedLanguage ?? 'it');
i18n.on('languageChanged', syncHtmlLang);

export { i18n };
