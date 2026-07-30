import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import { useSession } from '../use-session';

/**
 * Sign-out affordance, wired into the root layout header. Renders nothing
 * while the session is anonymous/loading — the layout can mount it
 * unconditionally.
 */
export function SignOutButton() {
  const { t } = useTranslation('auth');
  const { status, signOut } = useSession();

  if (status !== 'authenticated') return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        void signOut();
      }}
    >
      {t('signOut')}
    </Button>
  );
}
