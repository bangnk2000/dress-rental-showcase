import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';

import { PwaUpdatePrompt } from '@/components/feedback/pwa-update-prompt';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Toaster } from '@/components/ui/sonner';
import { SignOutButton, useSession } from '@/features/auth';
import { appVersionLabel } from '@/lib/app-version';
import { cn } from '@/lib/utils';

export function RootLayout() {
  const { t } = useTranslation();
  const { user } = useSession();
  const navItems = [
    { to: '/', label: t('nav.today'), end: true },
    { to: '/dresses', label: t('nav.dresses'), end: false },
    { to: '/rentals', label: t('nav.rentals'), end: false },
    // Every staff member manages the public listings (FR-CAT-09, owner decision E).
    { to: '/website', label: t('nav.website'), end: false },
    // Account management is owner-only; hiding the link is display — the route AND the BE
    // policy both re-check.
    ...(user?.role === 'owner' ? [{ to: '/users', label: t('nav.users'), end: false }] : []),
  ];

  return (
    <div className="flex min-h-svh flex-col">
      {/* cms-mobile-ux D1: one header, sticky. Below md the nav drops to its own row as an
          edge-to-edge horizontally scrolling strip of ≥44px links; at md+ it sits inline as
          before. ONE nav in the DOM for every width (tests count its links). */}
      <header className="sticky top-0 z-40 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-3 pb-0 md:pb-3">
          <span className="text-base font-semibold text-primary">{t('app.name')}</span>
          <nav className="scrollbar-none order-last -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-2 md:order-none md:mx-0 md:w-auto md:gap-4 md:overflow-visible md:px-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    // Phone: 44px tall tab with an underline marking the current page.
                    'inline-flex min-h-11 shrink-0 items-center border-b-2 px-2 text-sm whitespace-nowrap transition-colors hover:text-foreground',
                    // Desktop: plain inline text link, exactly as before.
                    'md:min-h-0 md:border-b-0 md:px-0',
                    isActive
                      ? 'border-primary font-medium text-foreground'
                      : 'border-transparent text-muted-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            {/* Renders only when authenticated (the button owns that check). */}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      {/* deploy-versioning A11: which build this device runs — one footer for every width. */}
      <footer className="mx-auto w-full max-w-5xl px-4 pb-3 text-xs text-muted-foreground/70">
        {appVersionLabel()}
      </footer>
      <Toaster />
      <PwaUpdatePrompt />
    </div>
  );
}
