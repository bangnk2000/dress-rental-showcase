'use client';

import { useTranslations } from 'next-intl';

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common');
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-space-lg px-margin-mobile text-center md:px-margin">
      <h1 className="font-display text-headline-lg-mobile text-on-surface md:text-headline-lg">{t('error.title')}</h1>
      {/* Primary action — DESIGN.md §Buttons */}
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-primary px-space-lg py-space-sm text-label-lg uppercase text-on-primary transition-colors hover:bg-primary-hover"
      >
        {t('error.retry')}
      </button>
    </main>
  );
}
