import { defineConfig } from '@playwright/test';

// Run after a web build, or target a running Next server with E2E_BASE_URL.
// No database/seed is needed: URL-state assertions work even with an empty catalogue.
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: externalBaseUrl ?? 'http://localhost:3001',
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: externalBaseUrl ? undefined : {
    command: 'pnpm start',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
});
