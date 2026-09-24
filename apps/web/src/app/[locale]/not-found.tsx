import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-space-lg px-margin-mobile text-center md:px-margin">
      <h1 className="font-display text-headline-lg-mobile text-on-surface md:text-headline-lg">{t('notFound.title')}</h1>
      {/* Ghost/tertiary action — DESIGN.md §Buttons */}
      <Link
        href="/"
        className="text-label-lg uppercase text-primary underline decoration-tertiary-fixed-dim decoration-1 underline-offset-4"
      >
        {t('notFound.backHome')}
      </Link>
    </main>
  );
}
