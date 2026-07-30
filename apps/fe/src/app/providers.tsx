import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';

import { isServerOrNetworkError } from '@/api/errors';
import { SessionProvider } from '@/features/auth';
import i18n from '@/lib/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // deliberate: no request storms on remount/refocus
      retry: 1,
      throwOnError: (error) => isServerOrNetworkError(error), // 5xx/network → error boundary
    },
    mutations: {
      onError: () => {
        toast.error(i18n.t('errors.mutationFailed'));
      },
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
