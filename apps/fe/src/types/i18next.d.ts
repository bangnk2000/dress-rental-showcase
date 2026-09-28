/**
 * Type-safe i18n keys — the Vietnamese files are the key schema (vi-first).
 * Every namespace registers here; a typo'd key or missing namespace becomes
 * a TS error, not a blank string in production.
 */
import type auth from '../../public/locales/vi/auth.json';
import type common from '../../public/locales/vi/common.json';
import type dresses from '../../public/locales/vi/dresses.json';
import type media from '../../public/locales/vi/media.json';
import type rentals from '../../public/locales/vi/rentals.json';
import type today from '../../public/locales/vi/today.json';
import type users from '../../public/locales/vi/users.json';
import type listings from '../../public/locales/vi/listings.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      auth: typeof auth;
      dresses: typeof dresses;
      media: typeof media;
      rentals: typeof rentals;
      today: typeof today;
      users: typeof users;
      listings: typeof listings;
    };
  }
}
