# 11 — Example Output: the `invoices` Feature Slice

A fully worked reference slice — the depth/tone benchmark for agent output. Input contract: the
FILLED MINI-EXAMPLE from `10-feature-scaffold-prompt.md` (list + create invoice, authenticated,
namespace `invoices`). Everything below conforms to `01`–`09`; if an agent's slice is materially
thinner or breaks a convention, point it back at the relevant file.

Assumed generated layer (from `openapi.json`, tag `invoices`, via `pnpm generate:api` —
NEVER edited by hand):

```
src/api/generated/invoices/invoices.ts
  → useListInvoicesSuspense(params?)          // GET /api/invoices
  → useCreateInvoice(options?)                // POST /api/invoices
  → getListInvoicesQueryKey(params?)
src/api/generated/model/
  → Invoice { id, customerId, amount, currency, status: 'draft'|'issued'|'paid', createdAt }
  → CreateInvoiceBody { customerId, amount, currency }
```

---

## 1. Public surface — `src/features/invoices/index.ts`

```ts
export { InvoicesRoute } from './components/invoices-route';
```

One export: the route component `app/` composes. Everything else is private to the slice.

## 2. Route component — `src/features/invoices/components/invoices-route.tsx`

```tsx
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { InvoiceList } from './invoice-list';
import { InvoiceForm } from './invoice-form';

export function InvoicesRoute() {
  const { t } = useTranslation('invoices');
  return (
    <div className="space-y-6">
      <PageHeader title={t('list.title')} />
      <InvoiceForm />
      <InvoiceList />
    </div>
  );
}
```

Layout/composition only — data lives in the children. Suspense + error boundary wrap this at the
router (§7), so no loading logic appears here.

## 3. List — `src/features/invoices/components/invoice-list.tsx`

```tsx
import { useTranslation } from 'react-i18next';
import { useListInvoicesSuspense } from '@/api/generated/invoices/invoices';
import { EmptyState } from '@/components/feedback/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { InvoiceStatusBadge } from './invoice-status-badge';

export function InvoiceList() {
  const { t } = useTranslation('invoices');
  const { data: invoices } = useListInvoicesSuspense();   // Suspense: no isPending branching

  if (invoices.length === 0) return <EmptyState message={t('list.empty')} />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('list.columns.customer')}</TableHead>
          <TableHead className="text-right">{t('list.columns.amount')}</TableHead>
          <TableHead>{t('list.columns.status')}</TableHead>
          <TableHead>{t('list.columns.created')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>{invoice.customerId}</TableCell>
            <TableCell className="text-right">
              {formatCurrency(invoice.amount, invoice.currency)}
            </TableCell>
            <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
            <TableCell>{formatDate(invoice.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Notes: generated Suspense hook for route-primary data (`04-data-layer.md` §5); kernel `Table`
primitives; `Intl` formatting via `lib/format.ts` (locale-aware, `06-i18n.md` §2); the empty state
is designed, not accidental (`03-ui-layer.md` §5).

## 4. Status badge — `src/features/invoices/components/invoice-status-badge.tsx`

```tsx
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { Invoice } from '@/api/generated/model';

const variantByStatus = {
  draft: 'secondary',
  issued: 'default',
  paid: 'outline',
} as const;

export function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const { t } = useTranslation('invoices');
  return <Badge variant={variantByStatus[status]}>{t(`status.${status}`)}</Badge>;
}
```

The feature-specific composite wraps the generic kernel primitive (`03-ui-layer.md` §3) — the
domain word "invoice" never enters `components/ui/`.

## 5. Form schema — `src/features/invoices/schemas/invoice-form.schema.ts`

```ts
import { z } from 'zod';

export const invoiceFormSchema = z.object({
  customerId: z.string().min(1, 'invoices:form.errors.customerRequired'),
  amount: z.coerce.number().positive('invoices:form.errors.amountPositive'),
  currency: z.string().length(3, 'invoices:form.errors.currencyInvalid'),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
```

FORM schema, not API schema: messages are i18n keys; `z.coerce` handles `<input>` strings. The
request type stays `CreateInvoiceBody` from the generated models — mapped in `onSubmit`.

## 6. Form — `src/features/invoices/components/invoice-form.tsx`

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateInvoice, getListInvoicesQueryKey } from '@/api/generated/invoices/invoices';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { invoiceFormSchema, type InvoiceFormValues } from '../schemas/invoice-form.schema';

export function InvoiceForm() {
  const { t } = useTranslation('invoices');
  const queryClient = useQueryClient();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: { customerId: '', amount: 0, currency: 'USD' },
  });

  const createInvoice = useCreateInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        form.reset();
        toast({ description: t('form.created') });
      },
      onError: () => form.setError('root', { message: 'invoices:form.errors.createFailed' }),
    },
  });

  const onSubmit = (values: InvoiceFormValues) => createInvoice.mutate({ data: values });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-4">
        <FormField
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.customer')}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />   {/* resolves the i18n key from the schema */}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.amount')}</FormLabel>
              <FormControl><Input type="number" inputMode="decimal" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={createInvoice.isPending}>
          {createInvoice.isPending ? t('form.creating') : t('form.create')}
        </Button>
      </form>
    </Form>
  );
}
```

Notes: submit state from `isPending`, never a `useState` flag; invalidation through the
**generated** key function; expected failure → root form error (rendered via `t()`), unexpected
render failures → route boundary. Currency kept minimal for the example.

## 7. Router wiring — edit in `src/app/router.tsx`

```tsx
const InvoicesRoute = lazy(() =>
  import('@/features/invoices').then((m) => ({ default: m.InvoicesRoute })),
);
...
{
  path: '/invoices',
  element: (
    <RequireAuth>
      <RouteBoundary>              {/* error boundary + <Suspense fallback={<Spinner/>}> */}
        <InvoicesRoute />
      </RouteBoundary>
    </RequireAuth>
  ),
}
```

Lazy import through the **public surface** (`@/features/invoices`); guard per the input contract;
one boundary handles Suspense (data + i18n namespace) and errors together.

## 8. Locales — `public/locales/en/invoices.json` (mirror in `vi/`)

```json
{
  "list": {
    "title": "Invoices",
    "empty": "No invoices yet. Create your first one above.",
    "columns": { "customer": "Customer", "amount": "Amount", "status": "Status", "created": "Created" }
  },
  "status": { "draft": "Draft", "issued": "Issued", "paid": "Paid" },
  "form": {
    "customer": "Customer",
    "amount": "Amount",
    "create": "Create invoice",
    "creating": "Creating…",
    "created": "Invoice created.",
    "errors": {
      "customerRequired": "Customer is required",
      "amountPositive": "Amount must be greater than zero",
      "currencyInvalid": "Currency must be a 3-letter code",
      "createFailed": "Could not create the invoice. Please try again."
    }
  }
}
```

Plus one line in `src/types/i18next.d.ts`:

```ts
invoices: typeof import('../../public/locales/en/invoices.json');
```

## 9. MSW handlers — `src/test/msw/handlers/invoices.ts`

```ts
import { http, HttpResponse } from 'msw';
import type { Invoice } from '@/api/generated/model';

const invoices: Invoice[] = [
  { id: 'inv-1', customerId: 'acme', amount: 120, currency: 'USD', status: 'draft',
    createdAt: '2026-07-01T10:00:00Z' },
];

export const invoiceHandlers = [
  http.get('*/api/invoices', () => HttpResponse.json(invoices)),
  http.post('*/api/invoices', async ({ request }) => {
    const body = (await request.json()) as Omit<Invoice, 'id' | 'status' | 'createdAt'>;
    const created: Invoice = { id: 'inv-2', status: 'draft',
      createdAt: '2026-07-02T10:00:00Z', ...body };
    invoices.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
];
```

Shapes typed from **generated models** — the mock cannot drift from the contract silently.

## 10. Test — `src/features/invoices/invoices.test.tsx`

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { InvoicesRoute } from './components/invoices-route';

test('renders the invoice list', async () => {
  renderWithProviders(<InvoicesRoute />);
  expect(await screen.findByText('acme')).toBeInTheDocument();
});

test('shows the empty state when there are no invoices', async () => {
  server.use(http.get('*/api/invoices', () => HttpResponse.json([])));
  renderWithProviders(<InvoicesRoute />);
  expect(await screen.findByText(/no invoices yet/i)).toBeInTheDocument();
});

test('validates the form before submitting', async () => {
  const user = userEvent.setup();
  renderWithProviders(<InvoicesRoute />);
  await user.click(await screen.findByRole('button', { name: /create invoice/i }));
  expect(await screen.findByText(/customer is required/i)).toBeInTheDocument();
});

test('creates an invoice and refreshes the list', async () => {
  const user = userEvent.setup();
  renderWithProviders(<InvoicesRoute />);
  await user.type(await screen.findByLabelText(/customer/i), 'globex');
  await user.clear(screen.getByLabelText(/amount/i));
  await user.type(screen.getByLabelText(/amount/i), '250');
  await user.click(screen.getByRole('button', { name: /create invoice/i }));
  expect(await screen.findByText('globex')).toBeInTheDocument();  // invalidation → refetch
});
```

The real pipeline runs (generated hook → mutator → axios → MSW); accessible queries only; the
last test proves the invalidation wiring, not just the POST.

## 11. Harness bookkeeping — `feature_list.json` entry (on completion)

```json
{
  "id": "invoices",
  "name": "Invoices — list + create",
  "description": "Authenticated /invoices route: suspense-loaded list, validated create form, list invalidation",
  "status": "pass",
  "evidence": "pnpm check/lint/arch/test green (4 slice tests). Verified in pnpm dev: anonymous → redirected to /sign-in; create → toast + list refresh without reload; empty state renders on fresh account.",
  "testedAt": "2026-07-06T00:00:00Z"
}
```

Evidence names what was **run and observed** — a build passing is not evidence that a route works
(`13-harness-engineering.md` §3).

---

## Why this slice is "on-rails"

- **One folder** (plus router line + locales + harness entry) — Common Closure holds.
- **Zero hand-written HTTP** — both operations go through generated hooks; the only key used is
  the generated key function.
- **Every string** is namespaced; the badge shows enum-to-i18n mapping.
- **Three non-happy states designed**: route boundary (error), `EmptyState` (empty), route
  Suspense fallback (loading).
- **Tests mock the network, not the code**, and cover all four behaviors the capability promises.
- Deleting the feature = deleting the folder + one router line + one locale file + one d.ts line —
  the architecture's deletability test passes.
