# Testing Strategy — Vitest + RTL + MSW + Playwright

The test stack: **Vitest 4** (runner, jsdom), **React Testing Library** (client-component
behavior), **MSW 2** (network-level API mocking — the only correct way to test Orval-generated
hooks), and **Playwright** (real-browser e2e). Tests are part of every feature slice
(`02-folder-structure.md` §2) and part of the harness's Definition of Done
(`13-harness-engineering.md`).

**The App Router shift:** RTL cannot render `async` Server Components — so the pyramid's weight
moves. Component tests cover the CLIENT tree (which is where interactivity, forms, and outcome
states live anyway); **Playwright covers everything only the server renders** — thin pages,
streaming, guards, rendering modes, metadata. Plan slices so the interesting behavior sits in
testable client components fed by props/hydration, and keep pages thin enough that e2e coverage
of them is cheap.

## 1. The Test Pyramid, mapped to this stack

| Level | Tool | What it proves | Where |
| --- | --- | --- | --- |
| Unit | Vitest | Pure logic: `lib/` utils, schemas, hook logic | next to the file or in the slice |
| Component | Vitest + RTL + MSW | A feature's CLIENT tree behaves: renders states, submits forms, handles outcomes — against mocked HTTP | `features/<name>/<name>.test.tsx` |
| e2e | Playwright | User flows through the real build: auth + guards, create-read-update, locale switch, RSC pages render real content, rendering modes match intent | `e2e/*.spec.ts` |

The center of gravity is still the **component test with MSW** — it exercises the same generated
hooks, query cache, and mutator the app runs — but e2e is **Required (Standard+)**, not
optional garnish: it is the only level that sees the server half.

## 2. Mock the NETWORK, not the hooks

Never `vi.mock` an Orval-generated module. Generated hooks are the integration you want covered;
mocking them tests your mocks. MSW intercepts at the request level, so the real
`customFetch` → fetch → TanStack Query pipeline runs:

```ts
// src/test/msw/handlers/events.ts
import { http, HttpResponse } from 'msw';

export const eventHandlers = [
  http.get('*/api/be/events', () =>
    HttpResponse.json([{ id: 'evt-1', title: 'Kickoff', capacity: 100, status: 'draft' }]),
  ),
  http.post('*/api/be/events', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'evt-2', ...body }, { status: 201 });
  }),
];
```

```ts
// src/test/setup.ts
import { server } from './msw/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));  // unmocked call = failing test
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- In jsdom the mutator takes its CLIENT path (`/api/be` base) — handlers match that prefix.
- Handlers are **per feature/tag** (`test/msw/handlers/<tag>.ts`) mirroring the generated layer;
  a feature's tests import its own handlers plus `common` ones (auth/session).
- `onUnhandledRequest: 'error'` keeps the API surface honest — a new endpoint without a handler
  fails loudly.
- Response shapes come from **generated models** (`import type { Event } from '@/api/generated/model'`)
  so mocks type-check against the contract; if the Zod output is enabled, `parse` fixture data in
  the handler factory to catch drift.

## 3. `renderWithProviders` — the component-test harness

```tsx
// src/test/render.tsx
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en';

class TestErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    return this.state.error
      ? <div role="alert">{String(this.state.error)}</div>
      : this.props.children;
  }
}

export function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },  // fresh cache per test
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={en}>
        {/* mirror the segment shell: *Suspense hooks and thrown query faults need these */}
        <TestErrorBoundary>
          <Suspense fallback={<div role="status">loading</div>}>{ui}</Suspense>
        </TestErrorBoundary>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
```

- **A fresh QueryClient per test** — shared caches leak state between tests, the classic flake.
- Bundled English messages; asserting on visible English text is fine and readable.
- Next's router/navigation hooks (`useRouter`, `useSearchParams` via the i18n wrappers) are
  mocked once in `setup.ts` (`vi.mock('@/i18n/navigation', …)` with a spyable router) — features
  import ONLY the wrapper (06 §4), so one mock covers the codebase.
- The unit under test is the feature's CLIENT tree (`<EventsView/>`), not the async page — the
  page's prefetch wiring is covered by e2e. Rendering the client tree WITHOUT hydration data is
  correct: the Suspense hook fetches via MSW, same as a hard client-side navigation.

A canonical component test:

```tsx
test('creates an event and shows it in the list', async () => {
  const user = userEvent.setup();
  renderWithProviders(<EventsView />);
  await user.type(await screen.findByLabelText(/title/i), 'Demo day');
  await user.click(screen.getByRole('button', { name: /create/i }));
  expect(await screen.findByText(/demo day/i)).toBeInTheDocument();  // list invalidated + refetched
});
```

Assert **behavior through roles/labels** (accessible queries), not implementation (`data-testid`
as last resort); async UI via `findBy*`/`waitFor`, never manual `act` gymnastics.

## 4. What each layer's tests cover

| Target | Must-cover cases |
| --- | --- |
| Form components | valid submit (mutation payload correct), zod errors render (i18n keys resolved), server validation `details[]` maps to field errors, EACH business outcome code in the slice's catalog renders its designed state (never one generic message), double-click sends ONE request (pending disables submit), timeout → retry affordance resends the SAME `Idempotency-Key` when the contract requires it |
| List/detail client trees | data renders, empty state, error state (handler returns 500 → boundary/fallback), filter params reach the request (assert via handler spy) |
| Auth-dependent UI | render with a session prop / mocked `useSession` for both states; the real guard/redirect chain is e2e (§5) |
| Hooks / stores | pure logic in isolation, no rendering needed |
| lib/ utils, schemas | plain Vitest unit tests, table-driven |

## 5. Playwright e2e — the server half's only witness

- **A handful of flows, not a matrix**: sign-in via the session-minting fixture (never automate
  Google's real UI — `05-auth-google.md` §6), guard behavior (anonymous → redirected to
  sign-in → back to `?from=`), the product's core create/read/update loop, locale switch
  persists + URLs keep their prefix.
- **RSC coverage**: for each public page — response HTML contains the real content
  (`page.content()` assertions, not just visible text after JS), localized `<title>` via
  `generateMetadata`.
- **Rendering-mode regression**: after `pnpm build`, compare the printed route table against the
  intended modes (a one-line grep in CI; `07-rendering-caching.md` §1) — catches the
  accidentally-dynamic page.
- Runs against the **production build** (`pnpm build && pnpm start`) in CI, with either a real
  test backend or route-level mocking (pick one and record it in AGENTS.md; a real staging
  backend catches contract drift better).
- Selectors: `getByRole`/`getByLabel` — same accessibility-first discipline as RTL.

## 6. Coverage & CI gates

- Coverage gate in CI (Vitest `--coverage`, threshold per project scale — e.g. 80% on
  `src/features/**` and `src/lib/**`; `api/generated`, `components/ui`, and `src/app/**` are
  EXCLUDED — generated code, vendored code, and thin pages covered by e2e all pollute the signal).
- The gate sequence is `08-ai-agent-first.md` §3d: check → lint → arch → test → build → e2e. The
  harness (`13-harness-engineering.md`) requires test evidence in `feature_list.json` before a
  feature is "pass".
- Component tests must pass **without network access** (MSW guarantees it) — CI needs no backend
  for the unit/component stages.

## 7. Smells — agent self-check

- `vi.mock('@/api/generated/...')` — mock the network (MSW), not the data layer.
- An attempt to render an async page/RSC in RTL (it cannot) — move the logic into a testable
  client component or cover it in e2e.
- A shared module-level QueryClient across tests; or `retry` left on (slow, flaky timeouts).
- Tests asserting on class names/DOM structure instead of roles, labels, and visible text.
- `waitFor(() => {})` sleeps, arbitrary `setTimeout`s, or isolation flags papering over flakes.
- MSW handlers returning shapes not derived from generated models (contract drift hides here).
- e2e automating Google's real sign-in UI (brittle, rate-limited, ToS-gray) instead of the fixture.
- Public-page content asserted only after hydration (misses an SEO regression RSC exists to prevent).
- A feature marked "pass" in feature_list.json whose slice has no test file at all.
