'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { occasionFilterKeys, type OccasionFilter } from '../lib/filters';

/** mobile: horizontal scroll with an edge fade · md: wrap (design/responsive.md §4 + §6). */
export function OccasionChips({
  value,
  onChange,
  className,
}: {
  value: OccasionFilter;
  onChange: (next: OccasionFilter) => void;
  className?: string;
}) {
  const t = useTranslations('catalog.filter');
  return (
    <div className={cn('relative -mx-margin-mobile md:mx-0', className)}>
      <div
        role="group"
        aria-label={t('label')}
        className="flex snap-x snap-proximity gap-2 overflow-x-auto px-margin-mobile scrollbar-none md:flex-wrap md:overflow-visible md:px-0"
      >
        {occasionFilterKeys.map((key) => {
          const active = key === value;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              className={cn(
                'hit relative shrink-0 snap-start rounded-full px-4 py-2 text-label-sm',
                active
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-secondary-container/50',
              )}
            >
              {t(key)}
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-surface md:hidden" />
    </div>
  );
}
