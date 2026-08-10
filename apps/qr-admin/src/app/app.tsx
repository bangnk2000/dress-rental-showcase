import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { meHttpControllerMe } from '@/api/generated/identity/identity';
import { clearTokens, getRefreshToken, subscribeSessionCleared } from '@/api/mutator/auth-tokens';
import { LoginPage } from '@/features/auth';
import { QrUrlPage } from '@/features/qr-url';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}><AppShell /></QueryClientProvider>
  );
}

function AppShell() {
  const [role, setRole] = useState<'loading' | 'anonymous' | 'owner' | 'staff'>('loading');
  useEffect(() => {
    // A stored refresh token is enough to start: the access token lives in memory only, so after a
    // reload this /me arrives without one, takes a 401, and the mutator refreshes and retries it.
    if (!getRefreshToken()) { setRole('anonymous'); return; }
    void meHttpControllerMe().then((me) => setRole(me.role)).catch(() => { clearTokens(); setRole('anonymous'); });
  }, []);
  useEffect(() => {
    // The session can die while this screen is open (refresh token revoked or expired). Falling
    // back to the login form beats leaving the owner on a page where nothing works.
    return subscribeSessionCleared(() => {
      queryClient.clear();
      setRole('anonymous');
    });
  }, []);
  /**
   * The session now survives a reload, which is exactly why ending one has to be possible: a
   * staff member would otherwise be stuck on the denied screen forever, and an owner session on a
   * shared machine would outlive the person who opened it.
   */
  function signOut() {
    clearTokens();
    queryClient.clear();
    setRole('anonymous');
  }

  if (role === 'loading') return <main className="p-10">Đang kiểm tra phiên đăng nhập…</main>;
  if (role === 'anonymous') return <LoginPage onSignedIn={setRole} />;
  if (role === 'staff') return <main className="mx-auto max-w-xl p-10"><h1 className="text-2xl font-bold">Không có quyền truy cập</h1><p className="mt-2">QR Admin chỉ dành cho owner.</p><button className="mt-6 rounded border px-3 py-1 text-sm" onClick={signOut} type="button">Đăng xuất</button></main>;
  return <QrUrlPage onSignOut={signOut} />;
}
