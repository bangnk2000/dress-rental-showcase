import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';

import i18nForTests from './i18n';

interface RenderWithProvidersOptions {
  route?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: RenderWithProvidersOptions = {},
) {
  // A fresh QueryClient per test — shared caches leak state between tests.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18nForTests}>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>,
    ),
  };
}
