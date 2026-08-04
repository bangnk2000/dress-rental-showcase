import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { meHttpControllerMe } from '@/api/generated/identity/identity';
import { clearTokens, getRefreshToken } from '@/api/mutator/auth-tokens';
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
    if (!getRefreshToken()) { setRole('anonymous'); return; }
    void meHttpControllerMe().then((me) => setRole(me.role)).catch(() => { clearTokens(); setRole('anonymous'); });
  }, []);
  if (role === 'loading') return <main className="p-10">Đang kiểm tra phiên đăng nhập…</main>;
  if (role === 'anonymous') return <LoginPage onSignedIn={setRole} />;
  if (role === 'staff') return <main className="mx-auto max-w-xl p-10"><h1 className="text-2xl font-bold">Không có quyền truy cập</h1><p className="mt-2">QR Admin chỉ dành cho owner.</p></main>;
  return <QrUrlPage />;
}
