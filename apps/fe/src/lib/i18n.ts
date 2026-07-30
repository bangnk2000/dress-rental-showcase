import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

void i18n
  .use(HttpBackend) // lazy-load /locales/<lng>/<ns>.json per namespace
  .use(LanguageDetector) // querystring → localStorage → navigator
  .use(initReactI18next)
  .init({
    fallbackLng: 'vi',
    supportedLngs: ['vi', 'en'],
    load: 'languageOnly',
    defaultNS: 'common',
    ns: ['common'], // feature namespaces load on demand via useTranslation
    interpolation: { escapeValue: false }, // React already escapes
    backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
    detection: { caches: ['localStorage'] },
  });

// a11y/SEO: keep <html lang> in sync with the active language
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
