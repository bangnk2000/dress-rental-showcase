import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import messages from '../../messages/vi';

/**
 * Client-leaf render with the real vi catalogue. `@/i18n/navigation` and `next/image` are
 * replaced in setup.ts (no Next router or image loader in jsdom). No QueryClient/MSW: the catalogue
 * is read by RSC pages and handed to features as props, so feature tests pass fixtures
 * (`src/test/fixtures/`) and `src/api/public-catalog.test.ts` mocks the generated client.
 */
export function renderWithProviders(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale="vi" messages={messages} timeZone="Asia/Ho_Chi_Minh">
        {children}
      </NextIntlClientProvider>
    ),
  });
}
