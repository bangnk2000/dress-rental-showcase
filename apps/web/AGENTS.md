# AGENTS.md — apps/web (architecture contract)

Public, anonymous Next.js 16 (App Router) site of the shop, per the init-nextjs set — entry point
`docs/spec/init-nextjs/README.md` §Usage Flow 1b + `00-system-prompt.md` §Monorepo mode (open
numbered detail files only per the File Map). Monorepo deltas N1–N5:
`docs/spec/init-monorepo-contract/01-workspace-structure.md` §4b. Bootstrap brief:
`docs/design/public-web.md`. **Session harness lives at the repo ROOT** (`../../AGENTS.md`,
`feature_list.json`, `init.sh`) — never create harness files (or a `CLAUDE.md`) here.

Sibling of `apps/fe` and `apps/qr-admin`: own generated client, own gates, ships as its own Node
process. It MUST NOT import another app's source (root invariant 4).

## Commands (run from repo root)

| Command | What |
| --- | --- |
| `pnpm --filter web dev` | Next dev server on **:3001** (`/api/v1/*` rewritten to `API_URL`, default :3000) |
| `pnpm --filter web build` / `start` | production build (its route table is the rendering truth) / serve on :3001 |
| `pnpm --filter web check` / `lint` / `arch` / `test` | `next typegen && tsc`, eslint (boundaries v7), `scripts/check-architecture.sh` (7 checks), vitest |
| `pnpm --filter web generate:api` | Orval: `packages/contract/openapi.json` → `src/api/generated/` |
| `pnpm contract` (root) | after ANY BE API change: re-emit the spec and regenerate ALL clients |

Env (server-only, `.env.example`): `API_URL`, `SITE_URL`. No `NEXT_PUBLIC_*` yet.

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

## Deviations from the stack spec (deliberate, keep consistent)

1. **No session (model 0)** — no Auth.js, no `(app)` group, no cookie forwarding, no
   `onUnauthenticated`; a 401 is an ordinary fault. Adding customer sign-in is design-tier.
2. **vi only** — `routing.locales = ['vi']`; the `[locale]` segment and `t()` exist so adding a
   language is config + one catalog.
3. **No shadcn components, no `components.json` yet** — nothing renders UI worth a primitive;
   `lib/utils.ts` `cn()` is ready. Fonts ARE loaded (`next/font/google`, Playfair Display +
   Plus Jakarta Sans, `vietnamese` subset), so `next build` needs network to Google Fonts.
4. **No plop generator, no MSW, no Playwright yet** — no feature slice or server data exists.
   GAP to close with the first slice: plop (or a hand-copied slice shape), MSW handlers +
   `renderWithProviders`, and a Playwright spec for the RSC/SEO half (09).
5. **`src/proxy.ts` is not a boundaries element** — v7 element patterns match folders; the proxy
   imports only `src/i18n`. Classify it via `boundaries/files` if it ever grows.
6. **`global-error.tsx` copy is inline** — it replaces the root layout, so no intl provider exists
   there.

## Where do I add a public page?

1. Trace it to an FR-WEB-id (add one to the SRS first); a new public/SEO surface is design-tier →
   slice design doc (14 §2, incl. §1a rendering & caching) approved before code.
2. Needs data? The BE has no anonymous endpoints yet (`docs/design/public-web.md` §4) — BE slice
   first → `pnpm contract` → this app.
3. Slice under `src/features/<name>/` + a thin segment under `src/app/[locale]/(public)/`; one
   namespace `messages/vi/<name>.json` + one line in `messages/vi.ts`; add it to `sitemap.ts`.
4. Claim the entry in root `feature_list.json`; done = check/lint/arch/test/build green + the
   build route table + runtime proof on `pnpm --filter web start`.
