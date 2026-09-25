import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';

import messages from '../../messages/vi';

/**
 * Client-leaf render with the real vi catalogue. `@/i18n/navigation` and `next/image` are
 * replaced in setup.ts (no Next router or image loader in jsdom). No QueryClient/MSW yet: the
 * catalogue is an in-process mock, not HTTP (docs/design/web/public-pages.md).
 */
export function renderWithProviders(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="vi" messages={messages} timeZone="Asia/Ho_Chi_Minh">
      {ui}
    </NextIntlClientProvider>,
  );
}
