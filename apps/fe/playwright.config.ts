import { defineConfig } from '@playwright/test';

/**
 * E2e runs against the REAL stack (infra/e2e-playwright, automated by infra/e2e-ci): a migrated +
 * seeded database, the BE on :3000, and the FE's PRODUCTION build served on :4173 — Playwright
 * starts the two servers itself, so `pnpm --filter fe e2e` is the SAME command locally and in CI.
 *
 * Two deliberate boundaries:
 * - The database is never started here. Creating, migrating and seeding one is an explicit act
 *   (README step 3, or the `e2e` CI job) — tests do not silently provision infrastructure.
 * - `E2E_BASE_URL` means "I run the servers myself": nothing is started, the run just points at
 *   them (the three-terminal flow in the README still works exactly as documented).
 *
 * Still OUTSIDE the root gates and init.sh: this needs installed browsers plus a live database
 * (apps/fe/AGENTS.md deviation 5). CI runs it as its own job.
 */
const externalBaseUrl = process.env.E2E_BASE_URL;
const previewPort = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${previewPort}`,
    // vi is the primary UI language and the specs assert vi strings — pin the
    // browser locale so the i18n detector resolves vi, not headless-default en.
    locale: 'vi-VN',
    // Pin the clock to the shop's timezone, like the tablet on the counter. The today board takes
    // its date from the DEVICE while the late fee uses the SHOP day (FR-RENT-09): a browser left on
    // UTC books "today" as yesterday in Hanoi and the rental is born one day late.
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
  },
  // `list` for the terminal, `html` so a failed CI run has something to download besides the raw
  // trace (the `e2e` job uploads both on failure). Never auto-open: this also runs headless.
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // Serving `dist` rather than the dev server is the point: the browser proof then covers the
  // artifact that actually ships — service worker included, which `devOptions.enabled: false`
  // keeps out of dev. `vite preview` proxies /api to :3000 like the dev server (vite.config.ts).
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          // `pnpm --filter be …` executes in apps/be, so Nest's ConfigModule resolves apps/be/.env
          // there; in CI the same variables come from the job env instead.
          command: 'pnpm --filter be build && pnpm --filter be start',
          // No health route exists: /dresses answers 401 without a token, which Playwright accepts
          // as "the server is up".
          url: 'http://localhost:3000/api/v1/dresses',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: `pnpm build && pnpm exec vite preview --port ${previewPort} --strictPort`,
          url: `http://localhost:${previewPort}`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ],
});
