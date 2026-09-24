# Rendering & Caching — Per-Segment Decisions, One Cache Owner, SEO

The subsystem that makes Next.js worth its weight — and its sharpest footgun. Every route
segment gets an EXPLICIT rendering decision, every data surface gets ONE cache owner, and the
public pages get their SEO surface (metadata, sitemap, OG). Decisions land in the slice design
doc (`14-design-first.md` §2 template §1a) and section 2 of the `00-system-prompt.md` output —
never by accident.

This file replaces the SPA sibling's PWA chapter: for an API-fronting product app, installability
/offline is **deliberately out of scope by default** (§6) — rendering and caching are where
Next.js actually earns its keep.

## 1. The Per-Segment Rendering Decision (make it explicitly)

| Mode | What it means | Use for | Mechanics |
| --- | --- | --- | --- |
| **Static** | Rendered at build; served from CDN | Marketing/landing pages, docs, anything with no per-request data | Default when a segment reads no dynamic API (no `cookies()`, no uncached fetch) |
| **Cached + revalidated** | Rendered once, shared across users, refreshed by tag or interval | PUBLIC data pages: event catalog, event detail — SEO-relevant, same for everyone | RSC direct call with explicit cache opts: `listEvents(params, { cache: 'force-cache', next: { revalidate: 300, tags: ['events'] } })` (04 §3) |
| **Dynamic + streamed** | Rendered per request, HTML streams as data resolves | EVERYTHING authenticated: dashboards, forms, per-user lists | The mutator's `cache: 'no-store'` default makes this automatic; `loading.tsx`/`<Suspense>` provide the streaming fallback; prefetch + hydrate for interactivity (04 §4) |

Rules:

- **Authenticated ⇒ dynamic. No exceptions.** Per-user data in a shared cache (Full Route or
  Data Cache) is a cross-user leak, not a performance win. The mutator enforces the safe default;
  only PUBLIC surfaces may opt in to caching, and only with named tags.
- **The decision is written down** per segment (section 2 of the scaffold output; the slice doc).
  "Whatever Next inferred" is not a decision — an accidental `cookies()` call silently flips a
  page dynamic, and an accidentally-cached fetch silently serves stale data.
- Verify, don't assume: `pnpm build` prints each route's mode (static ○ / dynamic ƒ) — the
  clean-state checklist compares that output against the intended table
  (`13-harness-engineering.md` §6).

## 2. One Cache Owner per Surface

Next has several caches (Router Cache client-side; Full Route Cache + Data Cache server-side;
React `cache()` per request). The discipline that keeps them from fighting TanStack Query:

| Surface | Cache owner | Everyone else |
| --- | --- | --- |
| Authenticated, interactive data | **TanStack Query cache** (hydrated, invalidated by mutations — 04 §4) | Next Data Cache OFF (`no-store` default); Router Cache holds only the RSC payload with default semantics |
| Public, shared data | **Next Data Cache** via tags + `revalidate` | TanStack Query not involved — the surface is an RSC render, no hooks |
| Per-request dedup (same call twice in one render tree) | React `cache()` / fetch dedup — automatic | Not a freshness mechanism; just dedup |

The classic bug this prevents: a list cached by Next AND owned by TanStack Query — the mutation
invalidates the query cache, the page still serves the stale Next-cached payload, and "no
invalidation fixes it". One surface, one owner, stated in the slice doc's data map.

## 3. Streaming & Boundaries

- Every data-bearing segment ships `loading.tsx` (or an inline `<Suspense>` around the slow
  subtree) — the shell paints immediately, data streams in. A skeleton matching layout beats a
  spinner (`03-ui-layer.md` §5).
- Every segment ships `error.tsx` (client component by contract, receives `error` + `reset`).
  Query faults thrown by `throwOnError` and RSC fetch failures land here (04 §3);
  `global-error.tsx` is the last resort.
- Slow-but-secondary widgets get their OWN `<Suspense>` boundary so they never block the
  primary content — mirror of the "independent widget" row in 04 §5.
- Partial Prerendering / Cache Components (`use cache`) are the framework's direction for mixing
  static shells with dynamic holes: adopt them as a DELIBERATE, recorded decision when the
  public surface earns it — not by default. Verify the current stability tier at init time.

## 4. Revalidation — keeping public caches honest

A public cached surface needs an explicit answer to "when does it update?":

- **Time-based**: `next: { revalidate: <seconds> }` — for catalogs where minutes-stale is fine.
- **Tag-based** (preferred for correctness): tag the read
  (`next: { tags: ['events'] }`), then `revalidateTag('events')` when the data changes. Triggers:
  - a **route handler webhook** the backend calls after relevant writes
    (`app/api/revalidate/route.ts`, secret-protected), or
  - a **Server Action** when the mutation originates in this app (04 §7).
- An authenticated mutation that also changes a public page does BOTH: invalidate the query cache
  (client freshness) and `revalidateTag` (public cache) — the slice doc's data map lists the two
  explicitly.
- `revalidatePath` is the blunt fallback — prefer tags; paths multiply with locales
  (`/en/events`, `/vi/events`).

## 5. SEO Surface — public pages only

- **Metadata API**: every public segment exports `generateMetadata` — localized title/description
  via `getTranslations` (06 §2), `alternates.languages` (hreflang) from the routing config,
  canonical URLs, OG/Twitter cards. Authenticated segments get a plain static title and
  `robots: { index: false }`.
- **`sitemap.ts` + `robots.ts`** at the app root, generated from the PUBLIC route inventory
  (locale variants included). Keep them derived from the routing config — hand-listed URLs rot.
- **OG images**: static files in `public/` or `opengraph-image.tsx` per segment when dynamic
  cards earn their keep.
- SEO checks are part of the polish pass for public slices (14 §4): rendered HTML contains the
  real content (view-source, not DevTools), titles are localized, hreflang present.

## 6. What this file deliberately does NOT cover

- **PWA/offline**: skip unless installability is a REAL requirement. If it ever is, use
  `serwist` with the same non-negotiable rule as the SPA sibling: precache the shell, NEVER
  cache API JSON in the service worker — the query cache owns freshness. Record the decision in
  AGENTS.md; a half-configured SW causes stale-cache bugs that outcost it.
- **Edge runtime**: default to Node runtime everywhere; opt a route into Edge only with a
  measured reason.

## 7. Smells — agent self-check

- A per-user/authenticated call with `force-cache` or tags (cross-user leak), or the mutator's
  `no-store` default weakened "for performance".
- A public cached page with no revalidation story (no tag, no interval — stale forever), or a
  mutation touching data a cached page shows with no `revalidateTag` in its data map.
- `pnpm build` route table diverging from the intended rendering table — a page silently flipped
  dynamic (stray `cookies()`) or static (missing dynamic data).
- A data-bearing segment with no `loading.tsx`/Suspense (blank page while streaming) or no
  `error.tsx` (faults bubble to `global-error`).
- The same data owned by Next's Data Cache AND TanStack Query.
- Public pages without `generateMetadata`/hreflang; authenticated pages indexable.
- `revalidatePath('/')`-style blanket invalidation where a tag was the honest scope.
- A service worker or Edge runtime adopted without a recorded requirement (YAGNI).
