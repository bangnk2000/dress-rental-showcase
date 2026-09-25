'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { isNavActive, navItems } from './nav-items';

/** md+ inline links — the mobile bottom tab bar collapses into these (design/responsive.md §3). */
export function SiteNav() {
  const t = useTranslations('common.nav');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('label')}
      className="hidden md:flex md:items-center md:gap-space-lg xl:absolute xl:left-1/2 xl:-translate-x-1/2"
    >
      {navItems.map(({ key, href }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'hit relative border-b-2 py-1 text-label-lg',
              active
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-on-surface-variant hover:text-primary',
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
