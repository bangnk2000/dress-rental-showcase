import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getMeHttpControllerMeQueryKey,
  loginHttpControllerLogin,
  meHttpControllerMe,
} from '@/api/generated/identity/identity';
import type { MeResponseDto } from '@/api/generated/model';
import {
  clearTokens,
  getRefreshToken,
  refreshSession,
  setTokens,
  subscribeSessionCleared,
} from '@/api/mutator/auth-tokens';

import { SessionContext, type SessionStatus } from './session-context';

interface SessionState {
  status: SessionStatus;
  user: MeResponseDto | null;
}

const ANONYMOUS: SessionState = { status: 'anonymous', user: null };

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'loading', user: null });

  /**
   * The me QUERY lives in the TanStack cache (generated key + fn); the session
   * context only keeps the snapshot it needs for status/guards.
   */
  const fetchMe = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: getMeHttpControllerMeQueryKey(),
        queryFn: ({ signal }) => meHttpControllerMe(undefined, signal),
      }),
    [queryClient],
  );

  // Boot: silent refresh when a refresh token is stored, then hydrate /auth/me.
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      if (getRefreshToken() === null) {
        if (!cancelled) setState(ANONYMOUS);
        return;
      }
      const refreshed = await refreshSession();
      if (!refreshed) {
        clearTokens();
        if (!cancelled) setState(ANONYMOUS);
        return;
      }
      try {
        const user = await fetchMe();
        if (!cancelled) setState({ status: 'authenticated', user });
      } catch {
        clearTokens();
        if (!cancelled) setState(ANONYMOUS);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  // Hard sign-out from the mutator (401 refresh-and-retry failed) → drop everything.
  useEffect(
    () =>
      subscribeSessionCleared(() => {
        setState(ANONYMOUS);
        queryClient.clear();
      }),
    [queryClient],
  );

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      const pair = await loginHttpControllerLogin(input);
      setTokens(pair);
      const user = await fetchMe();
      setState({ status: 'authenticated', user });
    },
    [fetchMe],
  );

  // The contract has no revoke endpoint — sign-out is local only: drop tokens
  // and the (user-scoped) query cache.
  const signOut = useCallback(async () => {
    clearTokens();
    queryClient.clear();
    setState(ANONYMOUS);
  }, [queryClient]);

  const value = useMemo(
    () => ({ status: state.status, user: state.user, signIn, signOut }),
    [state, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
