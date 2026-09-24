# Data Layer — Orval → fetch functions + TanStack Query from `openapi.json`

The entire server-state layer is **generated**: Orval 8 reads the committed `openapi.json` and
emits typed fetch functions, TanStack Query v5 hooks, models, and query keys into
`src/api/generated/`. Because the client is `httpClient: 'fetch'`, the SAME generated functions
run in Server Components (direct call, prefetch) and in the browser (hooks) — one contract, both
sides of the boundary. Hand-written code in this layer is exactly one file — the **isomorphic
mutator** — plus the error seam. This file owns the pipeline config, the mutator contract, and
the query/mutation conventions features follow.

Layer rules (`01-architecture-principles.md`): components never call `fetch` or build URLs;
server data has one cache owner per surface; generated files are read-only.

## 1. The Pipeline

```
backend repo ──(export/CI artifact)──▶ openapi.json (committed here)
                                          │  pnpm generate:api
                                          ▼
                              orval.config.ts (this file's §2)
                                          ▼
                     src/api/generated/<tag>/<tag>.ts   (fetch fns + hooks + query keys)
                     src/api/generated/model/*.ts       (request/response types)
                     [optional] *.zod.ts                (runtime schemas)
                                          │ all requests flow through
                                          ▼
                     src/api/mutator/custom-fetch.ts (ONE isomorphic adapter)
                       server side: API_URL direct + forwarded session cookie
                       client side: /api/be rewrite (same-origin, cookie flows)
```

- `openapi.json` is **committed** — the repo builds without the backend running, and CI can verify
  freshness: regenerate and `git diff --exit-code src/api/generated` fails the build if someone
  edited generated code or forgot to regenerate after a spec bump.
- Version floor: **Orval 8 requires Node ≥ 22.18** — the repo pins Node 22 LTS accordingly
  (`12-implementation-checklist.md`).
- The **same-origin rewrite** in `next.config.ts` keeps browser calls first-party (httpOnly
  session cookie flows automatically, no CORS):

```ts
// next.config.ts
async rewrites() {
  return [{ source: '/api/be/:path*', destination: `${process.env.API_URL}/:path*` }];
}
```

## 2. `orval.config.ts` — canonical config

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: './openapi.json',
    output: {
      mode: 'tags-split',                    // one folder per OpenAPI tag → maps to features
      target: './src/api/generated',
      schemas: './src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',                   // fetch fns usable in RSC AND hydrated hooks
      clean: true,                           // generated dir is disposable, never hand-edited
      override: {
        mutator: {
          path: './src/api/mutator/custom-fetch.ts',
          name: 'customFetch',
        },
        fetch: {
          includeHttpResponseReturnType: false, // fns resolve to the DTO, not { data, status, headers }
        },
        query: {
          useSuspenseQuery: true,            // generates useXxxSuspense variants (GET ops)
          useInfinite: true,                 // for paginated list ops you mark per-operation
        },
      },
    },
  },
  // OPTIONAL second output: runtime Zod schemas alongside the client
  apiZod: {
    input: './openapi.json',
    output: {
      mode: 'tags-split',
      client: 'zod',
      target: './src/api/generated',
      fileExtension: '.zod.ts',              // avoids name conflicts with the client output
    },
  },
});
```

```jsonc
// package.json
{ "scripts": { "generate:api": "orval --config ./orval.config.ts" } }
```

Decisions encoded here, and why:

| Choice | Why |
| --- | --- |
| `mode: 'tags-split'` | One generated folder per OpenAPI tag — tags mirror features, so a feature imports exactly its own slice of the API. |
| `httpClient: 'fetch'` + mutator | THE Next.js-specific decision: fetch is isomorphic, so the generated `listEvents()` runs inside an RSC (prefetch/direct render) and inside `useListEvents()` in the browser — one generated layer for both sides. Axios would drag an interceptor stack into server bundles for no gain. |
| `useSuspenseQuery: true` | Generates `useXxxSuspense` **in addition to** classic hooks; the hydration pattern (§4) pairs them with server prefetch. Features choose per surface (§5). |
| Zod output optional | Types already guarantee compile-time safety; add the `.zod.ts` output only when you need RUNTIME validation of responses or want to derive form schemas. |
| `clean: true` | Reinforces machine-ownership: regeneration is total, local edits cannot survive. |
| `fetch.includeHttpResponseReturnType: false` | Orval 8's fetch client otherwise types every function as `{ data, status, headers }` — and the §3 mutator returns the BODY. Leaving the default with that mutator compiles and is wrong at runtime (`result.data` is `undefined`). With it off, the types say "DTO" and non-2xx never resolves (the mutator throws `HttpError`), which is exactly the §3 contract. If you keep the wrapper instead, the mutator must return `{ data, status, headers }` — pick one, never mix. |

## 3. The Mutator — `custom-fetch.ts`, the single isomorphic adapter

Every generated function funnels through this. It is the ONE file that behaves differently per
side of the boundary — deliberately neither `server-only` nor `client-only`:

```ts
// src/api/mutator/custom-fetch.ts
const isServer = typeof window === 'undefined';

async function buildHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init);
  if (isServer) {
    // RSC/route-handler call: forward the incoming session cookie to the backend
    const { cookies } = await import('next/headers');           // dynamic: keeps file isomorphic
    headers.set('cookie', (await cookies()).toString());
  }
  return headers;
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const base = isServer ? process.env.API_URL! : '/api/be';     // direct vs same-origin rewrite
  const res = await fetch(`${base}${url}`, {
    cache: 'no-store',              // DEFAULT only — before the spread, so a public surface's
                                    // explicit { cache, next: { tags } } opt-in (below) wins (07 §2)
    ...options,
    headers: await buildHeaders(options.headers),
    signal: options.signal ?? AbortSignal.timeout(15_000),  // hung request → retryable timeout fault
    credentials: 'include',
  });

  if (res.status === 401 && !isServer) onUnauthenticated();     // ONE place; see 05 §4 (not in model 0)
  const body = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new HttpError(res.status, body);           // normalized by mapApiError below
  return body as T;                 // T is the DTO — requires includeHttpResponseReturnType: false (§2)
};

export class HttpError extends Error {
  constructor(public status: number, public body: unknown) { super(`HTTP ${status}`); }
}
```

Rules:

- **This is the ONLY place** that knows about base URLs, cookies, status codes, or timeouts.
  Components read `error` objects from hooks; they never inspect `res.status`.
- In a contract monorepo whose emitted paths already carry the BE prefix (`/api/v1/...`), the
  browser base is `''` and the rewrite forwards that prefix 1:1 — `../init-monorepo-contract/01-workspace-structure.md` §4b N2.
- `cache: 'no-store'` is the DEFAULT: authenticated API data must never enter Next's Data Cache
  (per-user data in a shared cache is a correctness bug, and two caches fighting over freshness
  is the classic one). A PUBLIC surface that wants Next-side caching passes explicit options
  through the generated function's second parameter
  (`listEvents(params, { next: { revalidate: 300, tags: ['events'] }, cache: 'force-cache' })`)
  — an opt-in decision recorded in the slice doc (`07-rendering-caching.md` §2).
- **401 is handled once.** With the backend-owned cookie session (05 §4), client-side 401 →
  `onUnauthenticated()` clears local state and redirects to sign-in; server-side 401 → the
  thrown error reaches the segment boundary / guard which redirects. No refresh logic in
  components, ever.
- **Idempotency-Key**: for mutations the contract marks retryable, generate a UUID per user
  attempt, send it as the `Idempotency-Key` header, and resend the SAME key on retry
  (timeout/network error). Mechanically: generate the key into component STATE when the form
  mounts or resets — one key per attempt; pass it via the hook's request options. A NEW attempt —
  e.g. re-submitting at the new price after `rejected_price_changed` — sets a new key; a RETRY
  calls `mutate` again with the state untouched — the SAME key is resent.

### Error normalization — `mapApiError`, the one seam that reads wire shapes

The API has exactly two non-success shapes (see the backend set's `07-cross-cutting.md`): a
**business outcome** body `{ "status": "<code>", ...payload }` and a **fault envelope**
`{ "error": { "code", "message", "details"?, "correlationId" } }`. This mapper is the only code
that knows that; components branch on its RESULT — never on raw HTTP status codes.

```ts
// src/api/errors.ts
import { HttpError } from '@/api/mutator/custom-fetch';

export type ApiOutcome = { kind: 'outcome'; status: string } & Record<string, unknown>;
export type ApiFault = {
  kind: 'fault';
  code: string; // stable machine code, e.g. 'GENERIC.VALIDATION' — never parse `message`
  message: string;
  details?: { field?: string; rule?: string; message: string }[];
  correlationId?: string;
};

export function mapApiError(e: unknown): ApiOutcome | ApiFault {
  if (e instanceof HttpError) {
    const body = e.body as any;
    if (typeof body?.status === 'string') return { kind: 'outcome', ...body };
    if (body?.error?.code) return { kind: 'fault', ...body.error };
    if (e.status >= 500)
      return { kind: 'fault', code: 'GENERIC.INTERNAL', message: 'Server error' }; // 5xx without envelope
  }
  if (e instanceof DOMException && e.name === 'TimeoutError')
    return { kind: 'fault', code: 'CLIENT.TIMEOUT', message: 'Request timed out' };
  if (e instanceof TypeError)   // fetch network failure
    return { kind: 'fault', code: 'CLIENT.NETWORK', message: 'Network unreachable' };
  return { kind: 'fault', code: 'CLIENT.UNKNOWN', message: 'Unexpected error' };
}

// The boundary predicate for QUERIES (§4 defaults). The seam MAY read statuses —
// that is its job; components may not, they see only `kind` and `code`.
const BOUNDARY_CODES = ['GENERIC.INTERNAL', 'GENERIC.HTTP', 'CLIENT.NETWORK', 'CLIENT.TIMEOUT', 'CLIENT.UNKNOWN'];
export function isServerOrNetworkError(error: unknown): boolean {
  const e = mapApiError(error);
  return e.kind === 'fault' && BOUNDARY_CODES.includes(e.code);
}
```

- An **outcome** renders per the slice's state matrix: every outcome code in the use-case spec
  catalog has a designed state (`rejected_*` usually keeps the form and shows what to do next).
  Outcomes NEVER throw to the error boundary — they are results, not failures.
- A **fault** with `details[]` maps to per-field `form.setError`. The remaining faults split by
  CALL TYPE, not by code: on a **query**, `throwOnError: isServerOrNetworkError` (§4 defaults)
  sends them to the segment `error.tsx` — the screen cannot render without the data; on a
  **mutation**, the same faults render locally as a retry affordance (resend with the SAME
  `Idempotency-Key`) — never throw a mutation error to the boundary from `onError`. In an RSC,
  a thrown generated-call error reaches the same `error.tsx`.

**Success outcomes** never pass through `mapApiError` — success arrives as `data` in `onSuccess`.
One success outcome → plain DTO (the 201 itself implies accepted). Several success outcomes → the
response DTO carries `status` and `onSuccess` branches on `data.status`. In a slice's `outcomes`
input: success codes are implemented in `onSuccess`, rejection codes in `onError` via `mapApiError`.

Terminology: prose says "outcome code"; on the wire it is the `status` field (`ApiOutcome.status`)
— `code` is a FAULT field; never read `err.code` on an outcome.

## 4. Query Conventions (TanStack Query v5 + hydration)

**Two QueryClients, one pattern** — the client island and the per-request server client:

```tsx
// app/providers.tsx ("use client")
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // deliberate: no refetch storm right after hydration
      retry: 1,
      throwOnError: (error) => isServerOrNetworkError(error), // faults on QUERIES → error.tsx
    },
    // no global mutations.onError — mutations handle failures locally (§3)
  },
}));
```

```ts
// src/api/query-client.server.ts (server-only helper)
import 'server-only';
import { cache } from 'react';
import { QueryClient } from '@tanstack/react-query';
export const getQueryClient = cache(() => new QueryClient());   // one per request, never shared
```

**The hydration pattern** — the default for authenticated, interactive screens
(`07-rendering-caching.md` §1): the thin page prefetches with the GENERATED key + function, then
the client component takes ownership with the Suspense hook:

```tsx
// app/(app)/events/page.tsx (Server Component — thin)
export default async function EventsPage() {
  const qc = getQueryClient();
  await qc.prefetchQuery({
    queryKey: getListEventsQueryKey(),
    queryFn: () => listEvents(),          // generated fetch fn, runs server-side via the mutator
  });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <EventsView />                       {/* feature's client tree */}
    </HydrationBoundary>
  );
}
```

- **Query keys are generated.** Orval emits a key function per operation
  (`getListEventsQueryKey(params)`) — use those for prefetch/`invalidateQueries`/`setQueryData`.
  Do NOT hand-roll a parallel key factory; two sources of key truth is how caches rot — and a
  prefetch whose key drifts from the hook's silently double-fetches.
- **Invalidation is the default consistency mechanism.** A mutation invalidates the queries it
  affects, from the same generated key functions. Optimistic updates
  (`onMutate` + `setQueryData` + rollback) only where latency genuinely hurts UX
  (`01-architecture-principles.md` §8). If a PUBLIC cached page shows the same data, the
  backend-triggered or action-triggered `revalidateTag` covers it (`07-rendering-caching.md` §4).
- **Projections may lag.** When a list is a projection the contract marks eventually consistent,
  invalidate-and-refetch may not show the new row yet. Seed the cache from the command response
  (`setQueryData`) or render an optimistic entry — never assume read-after-write for such lists,
  and design the "still processing" affordance in the slice doc.

```ts
const qc = useQueryClient();
const createEvent = useCreateEvent({
  mutation: {
    onSuccess: () => qc.invalidateQueries({ queryKey: getListEventsQueryKey() }),
  },
});
```

- **Parameterize through the hook**, never filter client-side what the API can filter:
  `useListEvents({ status: 'upcoming', page })` — the params become part of the generated key, so
  each filter combination caches independently. Filters live in the URL (`useSearchParams`).
- **`select` for derived shapes** (memoized, keeps re-renders tight).

## 5. Pick the pattern per surface

| Surface | Pattern | Why |
| --- | --- | --- |
| Public, SEO-relevant read (landing, event detail page) | RSC direct call: `const event = await getEvent(id)` — no hydration, optional Next cache tags | HTML rendered on the server, indexable; no client JS for static content (`07-rendering-caching.md`) |
| Authenticated screen's primary data | Server prefetch + `HydrationBoundary` + `useListEventsSuspense()` in the client tree | First paint has data (no spinner), then the client cache owns freshness, invalidation works |
| Independent widget (sidebar count, chart) | classic `useXxx()` + local skeleton | Widget failure/loading must not block the page |
| Paginated/infinite list | generated `useXxxInfinite` (marked per-operation) | v5 infinite semantics with typed page params |
| Form submit | generated `useXxx` mutation (client) | `isPending` drives the submit button; errors map to the form (`03-ui-layer.md` §4) |

Suspense hooks pair with the segment's `error.tsx`/`loading.tsx` — `QueryErrorResetBoundary`
wires the retry button to query reset where a local boundary is used instead.

## 6. When there is no OpenAPI spec (yet)

The generated layer is the architecture; the generator is replaceable. If the backend has no spec:

1. Write the OpenAPI spec first if the backend team is willing — it is the cheapest contract you
   will ever buy. (The sibling `init-nestjs-hexagonal` backend emits one from `@nestjs/swagger`.)
2. Otherwise hand-write a minimal `src/api/` in the SAME shape Orval would emit (per-tag files, a
   fetch function + hook per operation, key functions, everything through `customFetch`) so a
   later spec swap is mechanical.
Never let features bypass the layer "temporarily".

## 7. Server Actions — the sanctioned alternative, not the default

With an external NestJS backend and a generated contract layer, **client mutations through
generated hooks are the default** — they keep the outcome-handling seam (`mapApiError` →
designed states) and the invalidation story in one place. Reach for a Server Action ONLY when
the write must touch server-only state, and record the choice in the slice design doc (14 §2):

- Setting/clearing httpOnly cookies (sign-in/sign-out handshakes — `05-auth-google.md`).
- `revalidateTag`/`revalidatePath` after a mutation that a PUBLIC cached page displays.
- Progressive enhancement: a form that must submit before hydration (`useActionState`).

An action that calls the backend still goes through the generated fetch function
(`'use server'; await createEvent(payload)`) — the mutator forwards the cookie; the action never
hand-rolls a fetch. Map failures with the same `mapApiError` and return
`{ status | fieldErrors }` shapes to the client — actions do not throw outcomes.

## 8. CI & regeneration workflow

- `pnpm generate:api` after every spec change; commit spec + generated output together.
- CI job: `pnpm generate:api && git diff --exit-code src/api/generated openapi.json` — catches
  hand-edits and stale output (part of `scripts/check-architecture.sh`, see
  `13-harness-engineering.md`).
- Backend spec drift: prefer a CI artifact/URL sync step (`curl $API/openapi.json > openapi.json`)
  reviewed as a normal PR — API changes should be visible in the frontend diff, not discovered at
  runtime. The full two-repo discipline (pinned SHA + `.contract-version` + `contract:pull` +
  breaking-change gate) is specified in
  [`../init-monorepo-contract/05-polyrepo-variant.md`](../init-monorepo-contract/05-polyrepo-variant.md);
  in a monorepo the whole problem disappears (`../init-monorepo-contract/`).

## 9. Smells — agent self-check

- Any edit under `src/api/generated/**` (regenerate instead), or `clean: true` removed to protect
  a hand edit.
- `fetch`/`axios` called outside `src/api/` **[CI]**; a URL built in a component or an action.
- A hand-rolled query key (`['events', id]`) where a generated key function exists; a prefetch
  key that drifts from the hook's key (silent double-fetch).
- Authenticated API data entering Next's Data Cache (`cache: 'force-cache'`/tags on a per-user
  call), or the `no-store` default removed from the mutator.
- `useEffect`-copying hook data into state/stores; server data in zustand.
- A mutation without invalidation (or a deliberate, commented reason); a public cached page
  showing mutated data with no `revalidateTag` story.
- `staleTime` left at 0 by omission (refetch storm right after hydration) — the default above is
  a decision, not a leftover.
- A Server Action used for a plain authenticated mutation a generated hook covers, or an action
  hand-rolling `fetch` past the mutator.
- Refresh/redirect logic duplicated outside the mutator/auth seam, or a component switching on
  HTTP status codes.
- Zod output generated "for completeness" but never imported (YAGNI — delete the config block).
