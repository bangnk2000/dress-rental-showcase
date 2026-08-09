import { defineConfig } from '@playwright/test';

/**
 * E2e runs against the REAL stack (infra/e2e-playwright): compose Postgres
 * migrated + seeded, BE on :3000, Vite dev on :5173 — start them before
 * `pnpm --filter fe e2e`. Deliberately OUTSIDE the root gates/init.sh
 * (needs browsers + a running stack; see AGENTS.md deviation 5).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    // vi is the primary UI language and the specs assert vi strings — pin the
    // browser locale so the i18n detector resolves vi, not headless-default en.
    locale: 'vi-VN',
    // Pin the clock to the shop's timezone, like the tablet on the counter. The today board takes
    // its date from the DEVICE while the late fee uses the SHOP day (FR-RENT-09): a browser left on
    // UTC books "today" as yesterday in Hanoi and the rental is born one day late.
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
