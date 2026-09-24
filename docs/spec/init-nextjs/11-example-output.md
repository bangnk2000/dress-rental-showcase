# 11 — Example Output: the `events` Feature Slice

A fully worked reference slice — the depth/tone benchmark for agent output. Input contract: the
FILLED MINI-EXAMPLE from `10-feature-scaffold-prompt.md` (list + create event, authenticated,
dynamic + prefetch/hydrate, namespace `events`). Everything below conforms to `01`–`09`; if an
agent's slice is materially thinner or breaks a convention, point it back at the relevant file.

Assumed generated layer (from `openapi.json`, tag `events`, via `pnpm generate:api` —
NEVER edited by hand):

```
src/api/generated/events/events.ts
  → listEvents(params?, options?)             // GET /events — fetch fn, runs on either side
  → useListEventsSuspense(params?)            // client Suspense hook
  → useCreateEvent(options?)                  // POST /events mutation hook
  → getListEventsQueryKey(params?)
src/api/generated/model/
  → Event { id, title, capacity, status: 'draft'|'published'|'closed', startsAt }
  → CreateEventBody { title, capacity }
```

---

## 1. Public surface — `src/features/events/index.ts`

```ts
export { EventsView } from './components/events-view';
```

One export: the client tree the page composes. Everything else is private to the slice.

## 2. Thin page — `src/app/[locale]/(app)/events/page.tsx` (Server Component)

```tsx
import { getTranslations } from 'next-intl/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { listEvents, getListEventsQueryKey } from '@/api/generated/events/events';
import { getQueryClient } from '@/api/query-client.server';
import { EventsView } from '@/features/events';

export async function generateMetadata() {
  const t = await getTranslations('events');
  return { title: t('list.title'), robots: { index: false } };   // authenticated: never indexed
}

export default async function EventsPage() {
  const qc = getQueryClient();
  await qc.prefetchQuery({
    queryKey: getListEventsQueryKey(),
    queryFn: () => listEvents(),          // generated fn; mutator forwards the session cookie
  });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <EventsView />
    </HydrationBoundary>
  );
}
```

Thin by design: metadata + rendering decision (dynamic — the mutator's `no-store` default) +
prefetch with the GENERATED key + compose. The guard lives in `(app)/layout.tsx`
(`05-auth-google.md` §5) — pages under the group never re-check.

`loading.tsx` (skeleton via kernel `<Spinner/>`/list skeleton) and `error.tsx`
(`"use client"`, renders kernel `error-fallback` with `reset`) sit next to it — emitted by plop,
kept one-liner thin.

## 3. Client tree root — `src/features/events/components/events-view.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/page-header';
import { EventList } from './event-list';
import { EventForm } from './event-form';

export function EventsView() {
  const t = useTranslations('events');
  return (
    <div className="space-y-6">
      <PageHeader title={t('list.title')} />
      <EventForm />
      <EventList />
    </div>
  );
}
```

Composition only — data lives in the children. The page's `HydrationBoundary` + segment
`loading.tsx`/`error.tsx` wrap this from above, so no loading logic appears here.

## 4. List — `src/features/events/components/event-list.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useListEventsSuspense } from '@/api/generated/events/events';
import { EmptyState } from '@/components/feedback/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { EventStatusBadge } from './event-status-badge';

export function EventList() {
  const t = useTranslations('events');
  const { data: events } = useListEventsSuspense();   // hydrated from the page's prefetch — no spinner

  if (events.length === 0) return <EmptyState message={t('list.empty')} />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('list.columns.title')}</TableHead>
          <TableHead className="text-right">{t('list.columns.capacity')}</TableHead>
          <TableHead>{t('list.columns.status')}</TableHead>
          <TableHead>{t('list.columns.startsAt')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell>{event.title}</TableCell>
            <TableCell className="text-right">{event.capacity}</TableCell>
            <TableCell><EventStatusBadge status={event.status} /></TableCell>
            <TableCell>{formatDate(event.startsAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Notes: the Suspense hook renders instantly from hydrated data on first paint AND owns freshness
afterwards (`04-data-layer.md` §4–5); kernel `Table` primitives; `Intl` formatting via
`lib/format.ts`; the empty state is designed, not accidental (`03-ui-layer.md` §5).

## 5. Status badge — `src/features/events/components/event-status-badge.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { Event } from '@/api/generated/model';

const variantByStatus = {
  draft: 'secondary',
  published: 'default',
  closed: 'outline',
} as const;

export function EventStatusBadge({ status }: { status: Event['status'] }) {
  const t = useTranslations('events');
  return <Badge variant={variantByStatus[status]}>{t(`status.${status}`)}</Badge>;
}
```

The feature-specific composite wraps the generic kernel primitive (`03-ui-layer.md` §3) — the
domain word "event" never enters `components/ui/`.

## 6. Form schema — `src/features/events/schemas/event-form.schema.ts`

```ts
import { z } from 'zod';

export const eventFormSchema = z.object({
  title: z.string().min(1, 'events.form.errors.titleRequired'),
  capacity: z.coerce.number().positive('events.form.errors.capacityPositive'),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;
```

FORM schema, not API schema: messages are i18n keys; `z.coerce` handles `<input>` strings. The
request type stays `CreateEventBody` from the generated models — form values match the DTO 1:1
here; when they diverge, map explicitly in `onSubmit` (03 §4).

## 7. Form — `src/features/events/components/event-form.tsx`

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateEvent, getListEventsQueryKey } from '@/api/generated/events/events';
import { mapApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { eventFormSchema, type EventFormValues } from '../schemas/event-form.schema';

export function EventForm() {
  const t = useTranslations('events');
  const queryClient = useQueryClient();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: { title: '', capacity: 0 },
  });

  const createEvent = useCreateEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        form.reset();
        toast(t('form.created'));
      },
      onError: (e) => {
        const err = mapApiError(e); // src/api/errors.ts (04-data-layer.md §3)
        // each business outcome renders its designed state — never one generic message
        if (err.kind === 'outcome' && err.status === 'rejected_duplicate_event') {
          form.setError('title', { message: 'events.form.errors.duplicateEvent' });
          return;
        }
        form.setError('root', { message: 'events.form.errors.createFailed' });
      },
    },
  });

  const onSubmit = (values: EventFormValues) => createEvent.mutate({ data: values });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.title')}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />   {/* resolves the i18n key from the schema */}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.capacity')}</FormLabel>
              <FormControl><Input type="number" inputMode="numeric" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {t(form.formState.errors.root.message as string)}
          </p>
        )}
        <Button type="submit" disabled={createEvent.isPending}>
          {createEvent.isPending ? t('form.creating') : t('form.create')}
        </Button>
      </form>
    </Form>
  );
}
```

Notes: submit state from `isPending`, never a `useState` flag; invalidation through the
**generated** key function — the same key the page prefetched, so hydration and invalidation
never drift; expected failure → designed outcome state, unexpected render failures → segment
`error.tsx`.

## 8. Locales — `messages/en/events.json` (mirror in `vi/`)

```json
{
  "list": {
    "title": "Events",
    "empty": "No events yet. Create your first one above.",
    "columns": { "title": "Title", "capacity": "Capacity", "status": "Status", "startsAt": "Starts" }
  },
  "status": { "draft": "Draft", "published": "Published", "closed": "Closed" },
  "form": {
    "title": "Title",
    "capacity": "Capacity",
    "create": "Create event",
    "creating": "Creating…",
    "created": "Event created.",
    "errors": {
      "titleRequired": "Title is required",
      "capacityPositive": "Capacity must be greater than zero",
      "duplicateEvent": "An event with this title already exists.",
      "createFailed": "Could not create the event. Please try again."
    }
  }
}
```

Plus one line per language aggregate:

```ts
// messages/en.ts
import events from './en/events.json';
export default { common, events /* … */ };
```

## 9. MSW handlers — `src/test/msw/handlers/events.ts`

```ts
import { http, HttpResponse } from 'msw';
import type { Event } from '@/api/generated/model';

const events: Event[] = [
  { id: 'evt-1', title: 'Kickoff', capacity: 100, status: 'draft',
    startsAt: '2026-09-01T10:00:00Z' },
];

export const eventHandlers = [
  http.get('*/api/be/events', () => HttpResponse.json(events)),
  http.post('*/api/be/events', async ({ request }) => {
    const body = (await request.json()) as Omit<Event, 'id' | 'status' | 'startsAt'>;
    const created: Event = { id: 'evt-2', status: 'draft',
      startsAt: '2026-09-02T10:00:00Z', ...body };
    events.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
];
```

Shapes typed from **generated models** — the mock cannot drift from the contract silently. Paths
match the mutator's CLIENT base (`/api/be`, `09` §2). Business-outcome responses (`422` with
`{ status: '<code>' }`) are mocked per test via `server.use`; the default handlers stay happy-path.

## 10. Test — `src/features/events/events.test.tsx`

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { EventsView } from './components/events-view';

test('renders the event list', async () => {
  renderWithProviders(<EventsView />);
  expect(await screen.findByText('Kickoff')).toBeInTheDocument();
});

test('shows the empty state when there are no events', async () => {
  server.use(http.get('*/api/be/events', () => HttpResponse.json([])));
  renderWithProviders(<EventsView />);
  expect(await screen.findByText(/no events yet/i)).toBeInTheDocument();
});

test('validates the form before submitting', async () => {
  const user = userEvent.setup();
  renderWithProviders(<EventsView />);
  await user.click(await screen.findByRole('button', { name: /create event/i }));
  expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
});

test('creates an event and refreshes the list', async () => {
  const user = userEvent.setup();
  renderWithProviders(<EventsView />);
  await user.type(await screen.findByLabelText(/title/i), 'Demo day');
  await user.clear(screen.getByLabelText(/capacity/i));
  await user.type(screen.getByLabelText(/capacity/i), '50');
  await user.click(screen.getByRole('button', { name: /create event/i }));
  expect(await screen.findByText('Demo day')).toBeInTheDocument();  // invalidation → refetch
});

test('renders the duplicate-event outcome on its field, not a generic message', async () => {
  server.use(http.post('*/api/be/events', () =>
    HttpResponse.json({ status: 'rejected_duplicate_event' }, { status: 422 })));
  const user = userEvent.setup();
  renderWithProviders(<EventsView />);
  await user.type(await screen.findByLabelText(/title/i), 'Kickoff');
  await user.clear(screen.getByLabelText(/capacity/i));
  await user.type(screen.getByLabelText(/capacity/i), '100');
  await user.click(screen.getByRole('button', { name: /create event/i }));
  expect(await screen.findByText(/already exists/i)).toBeInTheDocument(); // designed outcome state
});
```

The real pipeline runs (generated hook → customFetch → MSW); the client tree renders WITHOUT
hydration data (the Suspense hook fetches — same as client-side navigation, `09` §3); accessible
queries only; the invalidation test proves the wiring, the outcome test proves each business
rejection gets its designed state — never one generic message. The PAGE (prefetch, metadata,
guard) is covered by the e2e spec `e2e/create-event.spec.ts` (`09` §5), not RTL.

## 11. Harness bookkeeping — `feature_list.json` entry (on completion)

```json
{
  "id": "events",
  "name": "Events — list + create",
  "description": "Authenticated /events segment: prefetch+hydrated list, validated create form, list invalidation",
  "status": "pass",
  "evidence": "pnpm check/lint/arch/test green (5 slice tests) + build route table shows /[locale]/events ƒ dynamic as declared. Verified in pnpm dev: anonymous → redirected to /sign-in and back via ?from=; create → toast + list refresh without reload; duplicate → field error (outcome rejected_duplicate_event); empty state renders on fresh account.",
  "testedAt": "2026-08-10T00:00:00Z"
}
```

Evidence names what was **run and observed** — a build passing is not evidence that a route works
(`13-harness-engineering.md` §2).

---

## Why this slice is "on-rails"

- **One folder + one thin segment folder** (plus locales + harness entry) — Common Closure holds;
  deleting the feature = deleting two folders + one locale file + one import line per language.
- **Zero hand-written HTTP** — the page prefetches with the generated function, the client tree
  reads the generated Suspense hook, the mutation invalidates the generated key: one key source,
  both sides of the boundary.
- **The server/client split is visible**: the page is a Server Component (metadata, prefetch);
  `"use client"` appears exactly at the interactive tree root and leaves.
- **Every string** is namespaced; the badge shows enum-to-i18n mapping.
- **Three non-happy states designed**: segment `error.tsx` (error), `EmptyState` (empty),
  segment `loading.tsx` (loading) — plus one designed state per business outcome
  (`rejected_duplicate_event` → field error, never a generic toast).
- **Tests mock the network, not the code**, and cover all five behaviors the capability promises;
  the server half (guard, prefetch, metadata, rendering mode) has a named e2e owner.
