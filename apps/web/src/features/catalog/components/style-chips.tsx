'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { styleFilterKeys, type StyleFilter } from '../lib/filters';

/**
 * mobile: horizontal scroll with an edge fade · md: wrap (design/responsive.md §4 + §6).
 * `scroll` keeps ONE scrolling row at every width (home header row, where wrapping breaks the layout).
 */
export function StyleChips({
  value,
  onChange,
  className,
  scroll = false,
}: {
  value: StyleFilter;
  onChange: (next: StyleFilter) => void;
  className?: string;
  scroll?: boolean;
}) {
  const t = useTranslations('catalog.filter');
  return (
    <div className={cn('relative -mx-margin-mobile md:mx-0', scroll && 'min-w-0', className)}>
      <div
        role="group"
        aria-label={t('label')}
        className={cn(
          'flex snap-x snap-proximity gap-2 overflow-x-auto px-margin-mobile scrollbar-none md:px-0',
          !scroll && 'md:flex-wrap md:overflow-visible',
        )}
      >
        {styleFilterKeys.map((key) => {
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
      <div className={cn('pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-surface', !scroll && 'md:hidden')} />
    </div>
  );
}
