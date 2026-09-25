'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { isNavActive, navItems } from './nav-items';

/** Mobile only; md+ it collapses into the header. The page reserves its height (`pb-24`). */
export function BottomTabBar() {
  const t = useTranslations('common.nav');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('label')}
      className="pb-safe fixed inset-x-0 bottom-0 z-50 bg-surface/85 shadow-ambient backdrop-blur-lg md:hidden"
    >
      <div className="grid h-16 grid-cols-3">
        {navItems.map(({ key, href, icon: Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1',
                active ? 'text-primary' : 'text-on-surface-variant',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className={cn('text-label-sm', active && 'font-semibold')}>{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
