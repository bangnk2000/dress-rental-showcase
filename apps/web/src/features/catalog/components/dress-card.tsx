import Image from 'next/image';
import { useTranslations } from 'next-intl';

import type { PublicDressSummary } from '@/api/public-catalog';
import { Link } from '@/i18n/navigation';
import { formatVnd, formatVndCompact } from '@/lib/format';
import { cn } from '@/lib/utils';

import { badgeClassName } from '../lib/badge';
import { SaveDressButton } from './save-dress-button';

/** The whole card is one link (stretched ::after on the name); the heart sits above it (z-10). */
export function DressCard({ dress, className }: { dress: PublicDressSummary; className?: string }) {
  const t = useTranslations('catalog');
  const tc = useTranslations('common.price');
  return (
    <li className={cn('group relative flex-col overflow-hidden rounded-md bg-surface-container-lowest shadow-ambient', className)}>
      <div className="relative aspect-3/4 overflow-hidden bg-surface-container">
        <Image
          src={dress.cover.src}
          alt={dress.cover.alt}
          fill
          sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span
          className={cn(
            'absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-label-sm font-semibold',
            badgeClassName(dress.badge),
          )}
        >
          {t(`badge.${dress.badge}`)}
        </span>
        <SaveDressButton
          name={dress.name}
          className="hit reveal-on-hover absolute right-2.5 top-2.5 z-10 h-7 w-7"
          iconClassName="h-4 w-4"
        />
      </div>
      <div className="flex flex-1 flex-col justify-between p-3 md:p-space-md">
        <div>
          <p className="mb-0.5 text-label-sm uppercase text-outline">{dress.styles.map((s) => t(`filter.${s}`)).join(', ')}</p>
          <h3 className="line-clamp-1 text-body-md font-semibold text-on-surface">
            <Link
              href={`/bo-suu-tap/${dress.slug}`}
              className="after:absolute after:inset-0 group-hover:text-primary"
            >
              {dress.name}
            </Link>
          </h3>
          <p className="mb-2 line-clamp-1 text-body-sm text-on-surface-variant">{dress.tagline}</p>
        </div>
        <div className="flex items-baseline justify-between border-t border-surface-container pt-2">
          <p className="whitespace-nowrap">
            <span className="text-label-lg tracking-normal text-primary">{formatVnd(dress.rentalPrice)}</span>
            <span className="text-label-sm tracking-normal text-outline"> {tc('perRental')}</span>
          </p>
          {dress.retailPrice !== null && (
            <span className="text-label-sm text-outline-variant line-through">{formatVndCompact(dress.retailPrice)}</span>
          )}
        </div>
      </div>
    </li>
  );
}
