# Data Layer — Orval → TanStack Query from `openapi.json`

The entire server-state layer is **generated**: Orval 8 reads the committed `openapi.json` and
emits typed TanStack Query v5 hooks, models, and query keys into `src/api/generated/`. Hand-written
code in this layer is exactly one file — the **mutator** — plus optional thin helpers. This file
owns the pipeline config, the mutator contract, and the query/mutation conventions features follow.

Layer rules (`01-architecture-principles.md`): components never call `fetch`/`axios` or build URLs;
server data lives only in the query cache; generated files are read-only.

## 1. The Pipeline

```
backend repo ──(export/CI artifact)──▶ openapi.json (committed here)
                                          │  pnpm generate:api
                                          ▼
                              orval.config.ts (this file's §2)
                                          ▼
                     src/api/generated/<tag>/<tag>.ts   (hooks + query keys)
                     src/api/generated/model/*.ts       (request/response types)
                     [optional] *.zod.ts                (runtime schemas)
                                          │ all requests flow through
                                          ▼
                     src/api/mutator/custom-instance.ts (ONE adapter: auth, refresh, errors)
```

- `openapi.json` is **committed** — the repo builds without the backend running, and CI can verify
  freshness: regenerate and `git diff --exit-code src/api/generated` fails the build if someone
  edited generated code or forgot to regenerate after a spec bump.
- Version floor: **Orval 8 requires Node ≥ 22.18** (higher than Vite 8's 20.19+) — the repo pins
  Node 22 LTS accordingly (`12-implementation-checklist.md`).

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
      httpClient: 'axios',                   // default is 'fetch' in Orval 8 — set explicitly
      clean: true,                           // generated dir is disposable, never hand-edited
      override: {
        mutator: {
          path: './src/api/mutator/custom-instance.ts',
          name: 'customInstance',
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
| `httpClient: 'axios'` + mutator | Orval 8 defaults the query clients to `fetch`; we pick axios because interceptors are the cleanest seam for auth-refresh (§3). Set it explicitly — do not rely on the default. |
| `useSuspenseQuery: true` | Generates `useXxxSuspense` **in addition to** classic hooks; globally this applies to GET operations (per-operation `override.operations.<id>.query.useSuspenseQuery` can force others). Features choose per surface (§5). |
| Zod output optional | Types already guarantee compile-time safety; add the `.zod.ts` output only when you need RUNTIME validation of responses (untrusted/3rd-party backend) or want to derive form schemas. Orval's Zod baseline is **Zod 4** (`override.zod.version` supports 3/'auto'). |
| `clean: true` | Reinforces machine-ownership: regeneration is total, local edits cannot survive. |

> Version note: Orval detects the installed TanStack Query major from `package.json` and generates
> v5-style hooks; `override.query.version` exists to force it, but with `@tanstack/react-query@^5`
> installed you should not need it.

## 3. The Mutator — `custom-instance.ts`, the single adapter

Every generated hook funnels through this function. Its **required** signature (Orval calls it with
the request config; the optional second parameter carries per-call overrides):

```ts
// src/api/mutator/custom-instance.ts
import Axios, { AxiosError, type AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15_000, // a hung request becomes a retryable timeout fault, not an infinite spinner
});

// ── auth header ─────────────────────────────────────────────────────────────
AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = getAccessToken();                    // features/auth session module (05-auth-google.md)
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── 401 → refresh-and-retry, once ───────────────────────────────────────────
AXIOS_INSTANCE.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as AxiosRequestConfig & { _retried?: boolean };
  if (error.response?.status === 401 && !original._retried) {
    original._retried = true;
    const refreshed = await refreshSession();        // dedupe concurrent refreshes inside
    if (refreshed) return AXIOS_INSTANCE(original);
    clearSession();                                  // hard sign-out; router redirects
  }
  throw error;
});

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const controller = new AbortController();
  const promise = AXIOS_INSTANCE({ ...config, ...options, signal: controller.signal })
    .then(({ data }) => data);
  // TanStack Query cancellation support
  (promise as any).cancel = () => controller.abort();
  return promise;
};
```

Rules:

- **This is the ONLY place** that knows about tokens, refresh, base URLs, or status codes.
  Components read `error` objects from hooks; they never inspect `error.response.status`.
- Refresh must be **deduplicated** (one in-flight refresh promise shared by concurrent 401s) and
  **non-recursive** (the `_retried` flag; the refresh call itself must not go through this
  interceptor path or must be exempt).
- If the auth model is a **httpOnly session cookie** instead of bearer tokens
  (`05-auth-google.md` §4), the request interceptor disappears and
  `withCredentials: true` replaces it — the mutator is still the single seam.
- Do NOT add `ErrorType`/`BodyType` type-alias exports to the mutator "because Orval needs them" —
  it does not; add type helpers only if your own code wants them.
- **Idempotency-Key**: for mutations the contract marks retryable, generate a UUID per user
  attempt, send it as the `Idempotency-Key` header, and resend the SAME key on retry
  (timeout/network error). Mechanically: generate the key into component STATE when the form
  mounts or resets — one key per attempt; pass it via the hook's `request` option
  (`{ headers: { 'Idempotency-Key': key } }`), which is captured at hook render. A NEW attempt —
  e.g. re-submitting at the new price after `rejected_price_changed` — sets a new key (the
  re-render re-captures it); a RETRY calls `mutate` again with the state untouched — the SAME
  key is resent. No interceptor magic.

### Error normalization — `mapApiError`, the one seam that reads wire shapes

The API has exactly two non-success shapes (see the backend set's `07-cross-cutting.md`): a
**business outcome** body `{ "status": "<code>", ...payload }` and a **fault envelope**
`{ "error": { "code", "message", "details"?, "correlationId" } }`. This mapper is the only code
that knows that; components branch on its RESULT — never on raw HTTP status codes.

```ts
// src/api/errors.ts
import { AxiosError } from 'axios';

export type ApiOutcome = { kind: 'outcome'; status: string } & Record<string, unknown>;
export type ApiFault = {
  kind: 'fault';
  code: string; // stable machine code, e.g. 'GENERIC.VALIDATION' — never parse `message`
  message: string;
  details?: { field?: string; rule?: string; message: string }[];
  correlationId?: string;
};

export function mapApiError(e: unknown): ApiOutcome | ApiFault {
  if (e instanceof AxiosError) {
    const body = e.response?.data;
    if (typeof body?.status === 'string') return { kind: 'outcome', ...body };
    if (body?.error?.code) return { kind: 'fault', ...body.error };
    if (e.code === 'ECONNABORTED') return { kind: 'fault', code: 'CLIENT.TIMEOUT', message: 'Request timed out' };
    if (!e.response) return { kind: 'fault', code: 'CLIENT.NETWORK', message: 'Network unreachable' };
    if (e.response.status >= 500)
      return { kind: 'fault', code: 'GENERIC.INTERNAL', message: 'Server error' }; // 5xx without envelope (proxy/gateway HTML)
  }
  return { kind: 'fault', code: 'CLIENT.UNKNOWN', message: 'Unexpected error' };
}

// The boundary predicate for QUERIES (§4 defaults). The seam MAY read `e.response.status` —
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
  sends them to the route error boundary — the screen cannot render without the data; on a
  **mutation**, the same faults render locally as a retry affordance (resend with the SAME
  `Idempotency-Key`) — never throw a mutation error to the boundary from `onError`.

**Success outcomes** never pass through `mapApiError` — success arrives as `data` in `onSuccess`.
One success outcome → plain DTO (the 201 itself implies accepted). Several success outcomes → the
response DTO carries `status` and `onSuccess` branches on `data.status`. In a slice's `outcomes`
input: success codes are implemented in `onSuccess`, rejection codes in `onError` via `mapApiError`.

Terminology: prose says "outcome code"; on the wire it is the `status` field (`ApiOutcome.status`)
— `code` is a FAULT field; never read `err.code` on an outcome.

## 4. Query Conventions (TanStack Query v5)

**QueryClient defaults** — set once in `app/providers.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // deliberate: no request storms on remount/refocus
      retry: 1,
      throwOnError: (error) => isServerOrNetworkError(error), // server/network faults on QUERIES → boundary (mutations handle theirs locally — §3)
    },
    // no global mutations.onError — mutations handle failures locally (§3)
  },
});
```

- **Query keys are generated.** Orval emits a key function per operation
  (`getListInvoicesQueryKey(params)`) — use those for `invalidateQueries`/`setQueryData`. Do NOT
  hand-roll a parallel key factory; two sources of key truth is how caches rot.
- **Invalidation is the default consistency mechanism.** A mutation invalidates the queries it
  affects, from the same generated key functions. Optimistic updates
  (`onMutate` + `setQueryData` + rollback) only where latency genuinely hurts UX
  (`01-architecture-principles.md` §8).
- **Projections may lag.** When a list is a projection the contract marks eventually consistent,
  invalidate-and-refetch may not show the new row yet. Seed the cache from the command response
  (`setQueryData`) or render an optimistic entry — never assume read-after-write for such lists,
  and design the "still processing" affordance in the slice doc.

```ts
const qc = useQueryClient();
const createInvoice = useCreateInvoice({
  mutation: {
    onSuccess: () => qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() }),
  },
});
```

- **Parameterize through the hook**, never filter client-side what the API can filter:
  `useListInvoices({ status: 'overdue', page })` — the params become part of the generated key, so
  each filter combination caches independently.
- **`select` for derived shapes** (memoized, keeps re-renders tight); components should not
  re-map arrays inline on every render for large lists.
- **Prefetching** belongs to `app/` (route loaders / hover intent):
  `queryClient.prefetchQuery({ queryKey: getGetInvoiceQueryKey(id), queryFn: ... })` using the
  generated functions.

## 5. Suspense vs classic — pick per surface

| Surface | Pattern | Why |
| --- | --- | --- |
| Route's primary data | `useListInvoicesSuspense()` inside `<Suspense>` + error boundary at the route | No `isPending` branching in the component; loading/error UX standardized at the route (`03-ui-layer.md` §5) |
| Independent widget (sidebar count, chart) | classic `useXxx()` + local skeleton | Widget failure/loading must not block the page |
| Paginated/infinite list | generated `useXxxInfinite` (marked per-operation) | v5 infinite semantics with typed page params |
| Form submit | generated `useXxx` mutation | `isPending` drives the submit button; errors map to the form (`03-ui-layer.md` §4) |

Suspense hooks pair with the route error boundary — `QueryErrorResetBoundary` (or the router's
error element) wires the retry button to query reset.

## 6. When there is no OpenAPI spec (yet)

The generated layer is the architecture; the generator is replaceable. If the backend has no spec:

1. Write the OpenAPI spec first if the backend team is willing — it is the cheapest contract you
   will ever buy. (The sibling `init-nestjs-hexagonal` backend emits one from `@nestjs/swagger`.)
2. Otherwise hand-write a minimal `src/api/` in the SAME shape Orval would emit (per-tag files, a
   hook per operation, key functions, everything through `customInstance`) so a later spec swap is
   mechanical.
Never let features bypass the layer "temporarily".

## 7. CI & regeneration workflow

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

## 8. Smells — agent self-check

- Any edit under `src/api/generated/**` (regenerate instead), or `clean: true` removed to protect
  a hand edit.
- `axios`/`fetch` imported outside `src/api/` **[CI]**; a URL built in a component.
- A hand-rolled query key (`['invoices', id]`) where a generated key function exists.
- `useEffect`-copying hook data into state/stores; server data in zustand.
- A mutation without invalidation (or a deliberate, commented reason).
- `staleTime` left at 0 by omission (request storms) — the default above is a decision, not a leftover.
- Refresh logic duplicated outside the mutator, or a component switching on HTTP status codes.
- Zod output generated "for completeness" but never imported (YAGNI — delete the config block).
