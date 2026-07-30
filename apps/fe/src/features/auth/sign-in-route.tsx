import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';

import { Spinner } from '@/components/feedback/spinner';

import { LoginForm } from './components/login-form';
import { useSession } from './use-session';

export function SignInRoute() {
  const { t } = useTranslation('auth');
  const { status } = useSession();
  const location = useLocation();
  // RequireAuth stashed the bounced-from location in state; default is home.
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  if (status === 'loading') {
    return <Spinner className="min-h-64" />;
  }
  // Covers both: already signed in visiting /sign-in (from = '/') and the
  // just-signed-in flip — the session change itself performs the redirect.
  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="flex justify-center py-10">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-1 pb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
