import { Suspense } from 'react';
import { RouterProvider } from 'react-router/dom';

import { Spinner } from '@/components/feedback/spinner';

import { Providers } from './providers';
import { router } from './router';

export function App() {
  return (
    <Providers>
      {/* Top-level Suspense: i18n namespaces load over http on first paint / language switch */}
      <Suspense fallback={<Spinner className="min-h-svh" />}>
        <RouterProvider router={router} />
      </Suspense>
    </Providers>
  );
}
