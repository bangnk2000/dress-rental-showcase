# AGENTS.md — apps/web (architecture contract)

Public, anonymous Next.js 16 (App Router) site of the shop, per the init-nextjs set — entry point
`docs/spec/init-nextjs/README.md` §Usage Flow 1b + `00-system-prompt.md` §Monorepo mode (open
numbered detail files only per the File Map). Monorepo deltas N1–N5:
`docs/spec/init-monorepo-contract/01-workspace-structure.md` §4b. Bootstrap brief:
`docs/design/public-web.md`. The session harness is at the repo ROOT — never create harness files
(or a `CLAUDE.md`) here.

Sibling of `apps/fe` and `apps/qr-admin`: own generated client, own gates, ships as its own Node
process. It MUST NOT import another app's source (root invariant 4).

## Commands (run from repo root)

| Command | What |
| --- | --- |
| `pnpm --filter web dev` | Next dev server on **:3001** (`/api/v1/*` rewritten to `API_URL`, default :3000) |
| `pnpm --filter web build` / `start` | production build (its route table is the rendering truth; also emits `.next/standalone`, the deploy unit) / serve on :3001. Production runs `HOSTNAME=localhost node server.js` from the standalone dir — never bind `127.0.0.1` (`docs/design/public-web.md` §1 Hosting) |
| `pnpm --filter web check` / `lint` / `arch` / `test` | `next typegen && tsc`, eslint (boundaries v7), `scripts/check-architecture.sh` (7 checks), vitest |
| `pnpm --filter web e2e` | Chromium URL/navigation regression tests; starts the built web, or targets `E2E_BASE_URL`; CI web job runs after build; no DB/seed required |
| `pnpm --filter web generate:api` | Orval: `packages/contract/openapi.json` → `src/api/generated/` |
| `pnpm contract` (root) | after ANY BE API change: re-emit the spec and regenerate ALL clients |

Env (`.env.example`): server-only `API_URL`, `SITE_URL`; public `NEXT_PUBLIC_IMAGE_BASE_URL`
(R2 photo origin, inlined at BUILD time — unset = photos served as stored, no resizing) and
`NEXT_PUBLIC_STATIC_IMAGE_BASE_URL` (prod site origin — `/images/*` resized by Cloudflare too;
unset in dev/CI, where no `/cdn-cgi` exists).

## Rules

- Rings: `app/` → `features/<name>/` → kernel (`components/`, `lib/`, `hooks/`, `i18n/`, `types/`)
  + `api/`. No cross-feature imports, nothing imports `app/`. Pages are thin Server Components;
  `"use client"` only at interactive leaves.
- `src/api/generated/**` is READ-ONLY. "The site needs a field/endpoint" = BE change first.
- `src/api/mutator/custom-fetch.ts` is the ONE HTTP door (isomorphic: `API_URL` on the server,
  same-origin `/api/v1` rewrite in the browser; `cache: 'no-store'` default a caller may override
  for a public cached surface). Orval runs with `includeHttpResponseReturnType: false`, so
  generated functions resolve to the DTO.
- `src/api/errors.ts` (`mapApiError`) is the only reader of wire error shapes (ADR 0001).
- **`src/api/public-catalog.ts` is the catalogue door** (`server-only`): the generated
  `GET /public/dresses[/:slug]` functions with `force-cache` + `revalidate: 300` + tag
  `public-dresses` (Next Data Cache, ISR). Pages call it; features take the DTOs as props and import
  only its type aliases. Detail 404 → `null` → `notFound()`. An UNREACHABLE BE during `next build`
  (CI has none) prerenders an empty catalogue instead of failing; at runtime a failed revalidation
  keeps the last good page. Related dresses are computed from the list (`features/catalog`
  `relatedDresses`), never a new endpoint.
- **`src/lib/image-loader.ts` is the only `next/image` loader** (`images.loader: 'custom'`): R2
  photos under `NEXT_PUBLIC_IMAGE_BASE_URL` → Cloudflare Images variants via
  `@dress-rental/image-url`; `/images/*` likewise on `NEXT_PUBLIC_STATIC_IMAGE_BASE_URL` when set
  (else pass through); other hosts always pass through. `og:image` (`src/lib/seo.ts`) uses the
  plain `/images/hero.jpg` — keep it a JPEG every crawler reads. Widths come only from the
  fixed `deviceSizes`/`imageSizes` in `next.config.ts` — add a width there, never ad hoc.
- Site shell (header, nav, bottom tab bar, footer, open badge) is kernel: `src/components/site/`;
  shop facts (phone, Zalo, maps, hours) are config in `src/lib/shop.ts`, copy in `common.shop`.
- Every user-facing string goes through next-intl (`messages/vi/<namespace>.json`, aggregated in
  `messages/vi.ts`; `vi` is the schema locale). Features navigate via `@/i18n/navigation`.
  Route params are narrowed with `resolveLocale` (`src/i18n/locale.ts`) — never cast.
- Visual design = `DESIGN.md` (this folder) → tokens in `src/app/globals.css` `@theme`; the token
  mapping is in `docs/design/public-web.md` §5. Components use the FRONTMATTER role tokens
  (`bg-primary`, `text-on-surface`, `bg-surface-container`, `text-headline-md`, `p-gutter`,
  `shadow-ambient`). The hexes in DESIGN.md prose are seed colors and are never used directly;
  no hex or arbitrary value in a component. Change a value in `DESIGN.md` first, then the token.
  Dark theme = the `prefers-color-scheme: dark` block in `globals.css` overriding the SAME token
  names — a component never branches on theme (no `dark:` variants for colors). Buttons are
  pills (`rounded-full`, as are filter chips and badges — owner, 2026-09-25). Icons = `lucide-react`
  only; no icon font or CDN (`docs/design/public-web.md` §5).
- Every new public segment states its rendering mode + cache owner in its design doc, and the
  `pnpm --filter web build` route table must show it.

## Public collection search

FR-WEB-06, `features/catalog` (`CatalogBrowser`, `useCatalogSearch`, `CatalogUrlSync`): URL
`q`/`style` is owned client-side — the page never reads server `searchParams`, so ISR 300 s stays
intact; native history writes pass null user data so Next keeps its internal state. Debounce,
history push/replace, timer cleanup and evidence: `docs/design/web/search-dresses.md` §8.

## Deviations from the stack spec (deliberate, keep consistent)

1. **No session (model 0)** — no Auth.js, no `(app)` group, no cookie forwarding, no
   `onUnauthenticated`; a 401 is an ordinary fault. Adding customer sign-in is design-tier.
2. **vi only** — `routing.locales = ['vi']`; the `[locale]` segment and `t()` exist so adding a
   language is config + one catalog.
3. **No shadcn components, no `components.json` yet** — nothing renders UI worth a primitive;
   `lib/utils.ts` `cn()` is ready. Fonts ARE loaded (`next/font/google`, Playfair Display +
   Plus Jakarta Sans, `vietnamese` subset), so `next build` needs network to Google Fonts.
4. **No plop generator, no MSW; focused Playwright URL/navigation coverage** — slices are
   hand-copied (`features/<name>/index.ts` + `components/` + colocated `*.test.tsx`).
   `renderWithProviders` (`src/test/render.tsx`) wraps the real vi catalogue; `src/test/setup.ts`
   stubs `@/i18n/navigation` and `next/image`. HTTP is read only by RSC pages, so feature tests pass
   DTO fixtures (`src/test/fixtures/`) and `src/api/public-catalog.test.ts` mocks the generated
   functions. `e2e/catalog-navigation.spec.ts` runs in CI `web` against the production build.
   GAP still open: broader RSC/SEO browser coverage (09).
5. **`src/proxy.ts` is not a boundaries element** — v7 element patterns match folders; the proxy
   imports only `src/i18n`. Classify it via `boundaries/files` if it ever grows.
6. **`global-error.tsx` copy is inline** — it replaces the root layout, so no intl provider exists
   there.

## Where do I add a public page?

1. Trace it to an FR-WEB-id (add one to the SRS first); a new public/SEO surface is design-tier →
   slice design doc (14 §2, incl. §1a rendering & caching) approved before code.
2. Needs data? Only `GET /public/dresses[/:slug]` is anonymous today — anything else is a BE slice
   first → `pnpm contract` → this app, read through a door like `src/api/public-catalog.ts`.
3. Slice under `src/features/<name>/` + a thin segment under `src/app/[locale]/(public)/`; one
   namespace `messages/vi/<name>.json` + one line in `messages/vi.ts`; add it to `sitemap.ts`.
4. Claim the entry in root `feature_list.json`; done = check/lint/arch/test/build green + the
   build route table + runtime proof on `pnpm --filter web start`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
