# PWA — vite-plugin-pwa

Installability + offline shell via **vite-plugin-pwa 1.x** (Workbox under the hood). The
non-negotiable rule for an SPA fronting an API: **the app shell is precached; API data is NOT** —
server state freshness belongs to TanStack Query (`04-data-layer.md`), not the service worker.
Skip this entire file if offline/installable is not a real requirement
(`01-architecture-principles.md` §8) — a half-configured SW causes stale-cache bugs that outcost it.

## 1. Strategy Decisions (make them explicitly)

| Decision | Default here | Alternative & when |
| --- | --- | --- |
| SW generation | `strategies: 'generateSW'` — Workbox builds the SW from config | `injectManifest` only when you need custom SW code (push notifications, background sync) |
| Update UX | `registerType: 'prompt'` — user-visible "New version available → Reload" toast | `autoUpdate` for internal tools where a surprise reload is acceptable |
| API routes | **NetworkOnly** (or NetworkFirst with short timeout for read-only GETs you can tolerate stale) | Cache-first NEVER for API JSON — the query cache already handles staleness with real invalidation semantics |
| Locales/fonts/images | Runtime caching, StaleWhileRevalidate / CacheFirst with expiration | Precache only what every session needs |

## 2. Canonical config — `vite.config.ts`

```ts
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'prompt',
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: {
    name: 'Invoice App',
    short_name: 'Invoices',
    description: '…',
    theme_color: '#0f172a',            // keep in sync with @theme tokens (03-ui-layer.md)
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],   // the app shell
    navigateFallback: '/index.html',                      // SPA routing offline
    navigateFallbackDenylist: [/^\/api\//],               // API paths are not routes
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/api\/.*/,
        handler: 'NetworkOnly',                           // API: the query cache owns freshness
      },
      {
        urlPattern: /\/locales\/.*\.json$/,
        handler: 'StaleWhileRevalidate',                  // i18n namespaces (06-i18n.md §5)
        options: { cacheName: 'locales' },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|webp|avif)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 },
        },
      },
    ],
  },
  devOptions: { enabled: false },      // flip to true ONLY while actively debugging SW behavior
})
```

## 3. Rules behind the config

- **Precache = hashed build assets + shell.** `globPatterns` captures the built app; every deploy
  produces a new precache manifest and the SW updates atomically. Never widen the glob to data.
- **`navigateFallback` makes deep links work offline** — any unknown navigation serves the shell,
  and the SPA router takes over. The denylist keeps `/api/*` (and OAuth callback paths, if any)
  out of that behavior.
- **API = NetworkOnly.** Two caches with different staleness rules (Workbox + TanStack Query)
  fighting over the same JSON is the classic PWA bug: users "see old data" and no invalidation
  fixes it, because the SW served it before the query ever ran. If a genuinely read-only,
  staleness-tolerant GET needs offline support, carve out ONE NetworkFirst route with
  `networkTimeoutSeconds` and an explicit cache name — as a decision, not a default.
- **Locales are runtime-cached, not precached** — precaching every `<lng>/<ns>.json` bloats
  installs for languages the user never opens (`06-i18n.md` §5).
- **Auth interplay:** never cache authenticated API responses in the SW; sign-out clears the query
  cache (`05-auth-google.md` §4) but SW caches would survive — another reason for NetworkOnly.

## 4. The Update Prompt (registerType: 'prompt')

```tsx
// app/layouts/root-layout.tsx (or a dedicated pwa-update-prompt.tsx in components/feedback/)
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <Toast>
      {t('common:pwa.updateAvailable')}
      <Button onClick={() => updateServiceWorker(true)}>{t('common:pwa.reload')}</Button>
    </Toast>
  );
}
```

- `virtual:pwa-register/react` is the plugin's React binding; add
  `"types": ["vite-plugin-pwa/react"]` (and `vite/client`) to `tsconfig` so the virtual module and
  `import.meta.env` are typed.
- With `prompt`, a new SW waits until the user confirms — no mid-session reload losing form input.
  This component is part of the app shell (`02-folder-structure.md`), rendered once in the root
  layout.

## 5. Dev & verification

- **Dev server does not run the real SW** by default — and that's correct; `devOptions.enabled`
  exists for debugging only. Real verification is against a build:
  `pnpm build && pnpm preview`, then DevTools → Application → Service Workers / Lighthouse PWA
  audit.
- Test the two ugly paths every time PWA config changes (this is in `clean-state-checklist.md`,
  `13-harness-engineering.md`): (1) deploy → old tab gets the update prompt → reload gets new
  assets; (2) offline → deep link serves the shell, API-dependent screens show their error/empty
  states (not infinite spinners — the query layer must treat network failure as an error state).
- E2E: a Playwright spec with `context.setOffline(true)` covers the offline shell
  (`09-testing-strategy.md`).

## 6. Smells — agent self-check

- API responses in `runtimeCaching` with CacheFirst/SWR handlers, or missing from the
  `navigateFallbackDenylist`.
- `registerType` unset (defaulting by accident) — the update UX must be a stated decision.
- `devOptions.enabled: true` committed.
- Manifest icons missing the `maskable` variant, or `theme_color` diverging from the design tokens.
- Precache glob including `locales/**` or data files.
- A PWA layer added to a project with no offline/installability requirement (YAGNI).
- Update prompt implemented but unregistered (not rendered in the root layout) — updates then
  never activate until tab close, which users read as "the deploy didn't work".
