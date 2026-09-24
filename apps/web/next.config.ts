import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Browser calls stay same-origin: the contract's paths already carry /api/v1, so that prefix is
  // what gets forwarded to the BE (server-side calls go to API_URL directly — custom-fetch.ts).
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:3000'}/api/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
