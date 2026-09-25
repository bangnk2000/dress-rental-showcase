'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { isShopOpen } from '@/lib/shop';
import { cn } from '@/lib/utils';

/**
 * "Đang mở cửa" / "Đã đóng cửa" on the shop's clock. Pages are static, so this is only known in the
 * browser: nothing renders until mount, then it re-checks every minute (docs/design/web/public-pages.md §3.2).
 */
export function ShopOpenBadge({ className }: { className?: string }) {
  const t = useTranslations('common.shop');
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setOpen(isShopOpen(new Date()));
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (open === null) return null;
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-3 py-1 text-label-sm uppercase',
        open ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-highest text-on-surface-variant',
        className,
      )}
    >
      {open ? t('open') : t('closed')}
    </span>
  );
}
