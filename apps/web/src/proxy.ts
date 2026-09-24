import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

// Locale routing only — the site has no session, so there is no auth redirect to compose.
export default createMiddleware(routing);

export const config = {
  // Skip the BE rewrite, Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
