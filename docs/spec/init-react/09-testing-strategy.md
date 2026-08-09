# Testing Strategy — Vitest + RTL + MSW + Playwright

The test stack: **Vitest 4** (runner, jsdom), **React Testing Library** (component behavior),
**MSW 2** (network-level API mocking — the only correct way to test Orval-generated hooks), and
**Playwright** (real-browser e2e). Tests are part of every feature slice
(`02-folder-structure.md` §2) and part of the harness's Definition of Done
(`13-harness-engineering.md`).

## 1. The Test Pyramid, mapped to this stack

| Level | Tool | What it proves | Where |
| --- | --- | --- | --- |
| Unit | Vitest | Pure logic: `lib/` utils, schemas, stores, hook logic | next to the file or in the slice |
| Component | Vitest + RTL + MSW | A feature behaves: renders states, submits forms, handles errors — against mocked HTTP | `features/<name>/<name>.test.tsx` |
| e2e | Playwright | User flows through the real build: auth, create-read-update, offline shell | `e2e/*.spec.ts` |

The center of gravity is the **component test with MSW**: it exercises the same generated hooks,
query cache, and mutator the app runs — only the network is fake.

## 2. Mock the NETWORK, not the hooks

Never `vi.mock` an Orval-generated module. Generated hooks are the integration you want covered;
mocking them tests your mocks. MSW intercepts at the request level, so the real
`customInstance` → axios → interceptors → TanStack Query pipeline runs:

```ts
// src/test/msw/handlers/invoices.ts
import { http, HttpResponse } from 'msw';

export const invoiceHandlers = [
  http.get('*/api/invoices', () =>
    HttpResponse.json([{ id: 'inv-1', customerId: 'c-1', amount: 120, status: 'draft' }]),
  ),
  http.post('*/api/invoices', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'inv-2', ...body }, { status: 201 });
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

- Handlers are **per feature/tag** (`test/msw/handlers/<tag>.ts`) mirroring the generated layer;
  a feature's tests import its own handlers plus `common` ones (auth/session).
- `onUnhandledRequest: 'error'` keeps the API surface honest — a new endpoint without a handler
  fails loudly.
- Response shapes come from **generated models** (`import type { Invoice } from '@/api/generated/model'`)
  so mocks type-check against the contract; if the Zod output is enabled, `parse` fixture data in
  the handler factory to catch drift.

## 3. `renderWithProviders` — the component-test harness

```tsx
// src/test/render.tsx
class TestErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    return this.state.error
      ? <div role="alert">{String(this.state.error)}</div>
      : this.props.children;
  }
}

export function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },  // fresh cache per test
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18nForTests}>          {/* bundled resources, cimode or 'en' */}
        <MemoryRouter initialEntries={[route]}>
          {/* mirror the route shell: *Suspense hooks and thrown query faults cannot render without these */}
          <TestErrorBoundary>
            <Suspense fallback={<div role="status">loading</div>}>{ui}</Suspense>
          </TestErrorBoundary>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}
```

- **A fresh QueryClient per test** — shared caches leak state between tests, the classic flake.
- i18n in tests uses bundled English resources (no http-backend); asserting on visible English
  text is fine and readable. For key-level assertions use `lng: 'cimode'` (renders keys).
- No `GoogleOAuthProvider` here: components under test consume `useSession()`, so tests wrap a
  fake `SessionProvider` value (signed-in user or anonymous) — Google itself is never in the loop
  (`05-auth-google.md` §6).

A canonical component test:

```tsx
test('creates an invoice and shows it in the list', async () => {
  const user = userEvent.setup();
  renderWithProviders(<InvoicesRoute />);
  await user.type(await screen.findByLabelText(/amount/i), '120');
  await user.click(screen.getByRole('button', { name: /create/i }));
  expect(await screen.findByText(/inv-2/)).toBeInTheDocument();     // list invalidated + refetched
});
```

Assert **behavior through roles/labels** (accessible queries), not implementation (`data-testid`
as last resort); async UI via `findBy*`/`waitFor`, never manual `act` gymnastics.

## 4. What each layer's tests cover

| Target | Must-cover cases |
| --- | --- |
| Form components | valid submit (mutation payload correct), zod errors render (i18n keys resolved), server validation `details[]` maps to field errors, EACH business outcome code in the slice's catalog renders its designed state (never one generic message), double-click sends ONE request (pending disables submit), timeout → retry affordance resends the SAME `Idempotency-Key` when the contract requires it |
| List/detail components | data renders, empty state, error state (handler returns 500 → boundary/fallback), filter params reach the request (assert via handler spy) |
| Session/guards | anonymous → redirected, authenticated → children render, 401-refresh flow (first call 401, refresh handler, retry 200) at the mutator level |
| Stores/hooks | pure logic in isolation, no rendering needed |
| lib/ utils, schemas | plain Vitest unit tests, table-driven |

## 5. Playwright e2e — thin and user-shaped

- **A handful of flows, not a matrix**: sign-in (via the test bypass endpoint — never automate
  Google's real UI), the product's core create/read/update loop, language switch persists, and —
  if PWA is in scope — `context.setOffline(true)` serves the shell and API screens degrade to
  error states (`07-pwa.md` §5).
- Runs against the **production build** (`pnpm build && pnpm preview`) in CI, with either a real
  test backend or MSW in browser mode (pick one and record it in AGENTS.md; a real staging
  backend catches contract drift better).
- Selectors: `getByRole`/`getByLabel` — same accessibility-first discipline as RTL.

## 6. Coverage & CI gates

- Coverage gate in CI (Vitest `--coverage`, threshold per project scale — e.g. 80% on
  `src/features/**` and `src/lib/**`; `api/generated` and `components/ui` are EXCLUDED — generated
  and vendored code pollute the signal).
- The gate sequence is `08-ai-agent-first.md` §3d: check → lint → arch → test → build → e2e. The
  harness (`13-harness-engineering.md`) requires test evidence in `feature_list.json` before a
  feature is "pass".
- Component tests must pass **without network access** (MSW guarantees it) — CI needs no backend
  for the unit/component stages.

## 7. Smells — agent self-check

- `vi.mock('@/api/generated/...')` — mock the network (MSW), not the data layer.
- A shared module-level QueryClient across tests; or `retry` left on (slow, flaky timeouts).
- Tests asserting on class names/DOM structure instead of roles, labels, and visible text.
- `waitFor(() => {})` sleeps, arbitrary `setTimeout`s, or `--run --no-isolate` flakiness papering.
- MSW handlers returning shapes not derived from generated models (contract drift hides here).
- e2e automating Google's real sign-in UI (brittle, rate-limited, ToS-gray) instead of the bypass.
- A feature marked "pass" in feature_list.json whose slice has no test file at all.
