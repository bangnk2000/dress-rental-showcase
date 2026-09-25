/**
 * Test i18n: a separate instance with the REAL vi resources bundled inline —
 * no http-backend, no detector, deterministic and synchronous. Assertions on
 * visible Vietnamese text stay aligned with the actual locale files.
 */
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import auth from '../../public/locales/vi/auth.json';
import common from '../../public/locales/vi/common.json';
import dresses from '../../public/locales/vi/dresses.json';
import media from '../../public/locales/vi/media.json';
import rentals from '../../public/locales/vi/rentals.json';
import today from '../../public/locales/vi/today.json';
import users from '../../public/locales/vi/users.json';

const i18nForTests = createInstance();

void i18nForTests.use(initReactI18next).init({
  lng: 'vi',
  fallbackLng: 'vi',
  defaultNS: 'common',
  ns: ['common', 'auth', 'dresses', 'media', 'rentals', 'today', 'users'],
  resources: {
    vi: { common, auth, dresses, media, rentals, today, users },
  },
  interpolation: { escapeValue: false },
  initAsync: false, // synchronous init — no act() noise from the ready flip
});

export default i18nForTests;
