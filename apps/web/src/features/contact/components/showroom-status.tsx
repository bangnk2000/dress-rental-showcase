'use client';

import { useTranslations } from 'next-intl';

import { useShopOpen } from '@/components/site/shop-open-badge';
import { cn } from '@/lib/utils';

/** Photo-caption status line on the shop clock; empty in the static HTML until the browser knows. */
export function ShowroomStatus() {
  const t = useTranslations('contact.photo');
  const open = useShopOpen();

  if (open === null) return null;
  return (
    <p className="flex items-center gap-1.5 text-label-sm uppercase">
      <span className={cn('h-2 w-2 rounded-full', open ? 'bg-secondary-container' : 'bg-outline')} />
      {open ? t('status') : t('statusClosed')}
    </p>
  );
}
