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

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <p className="text-sm">{t('pwa.updateAvailable')}</p>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        {t('pwa.reload')}
      </Button>
    </div>
  );
}
