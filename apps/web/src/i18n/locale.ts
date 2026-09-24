import { notFound } from 'next/navigation';
import { hasLocale, type Locale } from 'next-intl';

import { routing } from './routing';

/** Narrows a `[locale]` route param to a supported Locale; anything else is a 404. */
export function resolveLocale(value: string): Locale {
  if (!hasLocale(routing.locales, value)) notFound();
  return value;
}
