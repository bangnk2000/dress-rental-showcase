import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/components/ui/button';

/**
 * registerType: 'prompt' — a new service worker waits until the user confirms,
 * so a deploy never reloads a session mid-form. Rendered once in the root layout.
 */
export function PwaUpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  // Phone: full width minus 1rem gutters, above the home indicator (cms-mobile-ux D6) — and above
  // a page's fixed bottom bar, which publishes its height as --bottom-bar-h (rental-form-ux §4):
  // this prompt has no dismiss, so covering that bar's submit would force a reload mid-form.

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+var(--bottom-bar-h,0px))] z-50 flex items-center gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg sm:right-4 sm:left-auto"
    >
      <p className="min-w-0 flex-1 text-sm">{t('pwa.updateAvailable')}</p>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        {t('pwa.reload')}
      </Button>
    </div>
  );
}
