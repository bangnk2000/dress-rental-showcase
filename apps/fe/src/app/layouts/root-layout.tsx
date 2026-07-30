import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';

import { PwaUpdatePrompt } from '@/components/feedback/pwa-update-prompt';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Toaster } from '@/components/ui/sonner';
import { SignOutButton } from '@/features/auth';
import { cn } from '@/lib/utils';

export function RootLayout() {
  const { t } = useTranslation();
  const navItems = [
    { to: '/', label: t('nav.today'), end: true },
    { to: '/dresses', label: t('nav.dresses'), end: false },
    { to: '/rentals', label: t('nav.rentals'), end: false },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3">
          <span className="text-base font-semibold text-primary">{t('app.name')}</span>
          <nav className="flex items-center gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'text-sm transition-colors hover:text-foreground',
                    isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Toaster />
      <PwaUpdatePrompt />
    </div>
  );
}
