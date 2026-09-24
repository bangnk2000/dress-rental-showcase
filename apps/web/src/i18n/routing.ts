import { defineRouting } from 'next-intl/routing';

// vi only for now (apps/web/AGENTS.md deviation #2). Adding a language = one locale here + one
// catalog under messages/ — the [locale] segment and every t() call already exist.
export const routing = defineRouting({
  locales: ['vi'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
});
