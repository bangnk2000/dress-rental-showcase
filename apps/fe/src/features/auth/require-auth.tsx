import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { Spinner } from '@/components/feedback/spinner';

import { useSession } from './use-session';

/**
 * Route guard — wraps protected subtrees in app/router.tsx. Anonymous visitors
 * are bounced to /sign-in and come back to `state.from` after signing in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return <Spinner className="min-h-svh" />;
  }
  if (status === 'anonymous') {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
