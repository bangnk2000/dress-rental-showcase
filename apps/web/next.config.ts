import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  typedRoutes: true,
  // The shared package ships TypeScript source (packages/image-url "exports": ./src/index.ts).
  transpilePackages: ['@dress-rental/image-url'],
  // Photos are resized by Cloudflare Images, never by this Node process (src/lib/image-loader.ts).
  // These two lists are EVERY width the loader can be asked for — a fixed, small variant set.
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    deviceSizes: [640, 828, 1200],
    imageSizes: [160, 320],
  },
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
