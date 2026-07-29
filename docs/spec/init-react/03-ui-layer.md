# UI Layer — Tailwind CSS v4 + shadcn/ui

How this codebase builds UI: **Tailwind CSS v4** (CSS-first configuration) for styling,
**shadcn/ui** for owned, editable primitives, and a small set of composition rules that keep
feature UI consistent. For where files live, see `02-folder-structure.md`; for forms talking to
the API, see `04-data-layer.md`.

## 1. Tailwind v4 — CSS-first, no JS config

Tailwind v4 removed `tailwind.config.js` as the primary configuration surface. Configuration is
**in CSS**, and the Vite integration is a first-party plugin — no PostCSS setup.

**Install & wire (three steps, nothing else):**

```bash
pnpm add tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss(), /* VitePWA(...) — 07-pwa.md */],
});
```

```css
/* src/app/index.css — the ONLY Tailwind entry */
@import "tailwindcss";
```

Rules that follow from v4's model:

- **The three v3 directives are gone.** `@tailwind base/components/utilities` → a single
  `@import "tailwindcss"`. Never emit the v3 form.
- **Design tokens live in `@theme`.** Colors, fonts, breakpoints, radii are CSS variables declared
  in the stylesheet; utilities are generated from them:

```css
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --breakpoint-3xl: 1920px;
  --color-brand-500: oklch(0.62 0.19 259);   /* → bg-brand-500, text-brand-500, … */
}
```

- **A legacy JS config is an escape hatch only** (`@config "./tailwind.config.js"`); do not
  introduce one in a new project. Content detection is automatic — no `content: []` array.
- Theme values are **CSS variables at runtime**, so JS can read them
  (`getComputedStyle(...).getPropertyValue('--color-brand-500')`) — do not duplicate token values
  in TS constants.

## 2. shadcn/ui — owned primitives, not a dependency

shadcn/ui is a **generator, not a library**: the CLI copies component source into
`src/components/ui/`, where it is repo-owned and editable. The current CLI (`shadcn`, 4.x) fully
supports Tailwind v4 + React 19.

**Init once:**

```bash
pnpm dlx shadcn@latest init      # creates components.json, lib/utils.ts (cn), CSS variables
pnpm dlx shadcn@latest add button dialog form input select table toast
```

`components.json` pins the CLI's targets — keep it aligned with `02-folder-structure.md`:

```jsonc
{
  "style": "new-york",
  "tailwind": { "css": "src/app/index.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "ui": "@/components/ui", "utils": "@/lib/utils" }
}
```

Conventions:

- **`cn()` for conditional classes** (`clsx` + `tailwind-merge`, created by init at
  `lib/utils.ts`). Never concatenate class strings by hand.
- **Theming via CSS variables** (`--background`, `--primary`, …) declared in `index.css` with a
  `.dark` block; dark mode = toggling the `dark` class on `<html>` (a tiny `theme.store.ts` or
  provider owns this). Components reference semantic tokens (`bg-background`, `text-primary`) —
  never raw palette values — so re-theming touches one file.
- **Editing a ui/ component is allowed** (that's the point) but it must stay *generic*: no feature
  imports, no domain naming, no `t()` calls with feature namespaces. Feature-specific variants
  wrap the primitive inside the feature (`invoice-status-badge.tsx` wraps `badge.tsx`).
- **Do not re-generate over local edits.** Re-running `add` for an existing component overwrites;
  diff before accepting.

Known v4 gotchas the agent must respect (from the official shadcn Tailwind-v4 guidance):

- Tailwind v4 removed the default pointer **cursor on buttons** (`cursor: default` now); if the
  design expects `cursor-pointer`, set it once in `index.css` `@layer base`.
- Default **border color** is now `currentColor` — components relying on v3's gray default need an
  explicit `border-border` token (shadcn's generated CSS handles this; keep it).
- New-project palette is **oklch-based**; keep custom brand colors in oklch for perceptual
  consistency.

## 3. Composition Rules

- **Primitives up, composites down.** `components/ui/` = primitives (button, dialog);
  `components/layout|feedback/` = generic composites (page-header, empty-state); feature composites
  live in the feature. If a composite has zero product knowledge and two features want it, promote
  it to the kernel.
- **Variants over forks.** Extend a primitive with `cva` variants (shadcn's pattern) rather than
  copying it. One `button.tsx` with variants beats three button files.
- **Layout is the route's job.** Features render content; spacing/grid/shell live in
  `app/layouts/` and route components. A feature component should render correctly in any
  reasonably-sized container.
- **Accessibility is inherited, don't break it.** shadcn primitives wrap Radix (focus, ARIA,
  keyboard). When editing, keep the Radix wiring; when building custom interactive components,
  start from a Radix primitive, not a `div onClick`.
- **Icons**: `lucide-react` (shadcn's default), imported per-icon.

## 4. Forms — react-hook-form + zod + shadcn `form.tsx`

The standard form stack (shadcn's `form.tsx` is built for it):

```tsx
// features/invoices/schemas/invoice-form.schema.ts
export const invoiceFormSchema = z.object({
  customerId: z.string().min(1, 'invoices:form.errors.customerRequired'),
  amount: z.coerce.number().positive('invoices:form.errors.amountPositive'),
});
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
```

```tsx
// features/invoices/components/invoice-form.tsx
const form = useForm<InvoiceFormValues>({
  resolver: zodResolver(invoiceFormSchema),
  defaultValues: { customerId: '', amount: 0 },
});
const createInvoice = useCreateInvoice();          // Orval-generated (04-data-layer.md)

function onSubmit(values: InvoiceFormValues) {
  createInvoice.mutate({ data: values }, {
    onError: (e) => form.setError('root', { message: mapApiError(e) }),
  });
}
```

Rules:

- **Two schema layers, two jobs.** `*.schema.ts` in the feature validates the FORM (messages are
  i18n keys, coercions from input strings). The API's types/optional Zod schemas are generated by
  Orval and validate the CONTRACT. Do not merge them — form shape ≠ request shape is normal; map
  in `onSubmit`.
- Error messages in schemas are **i18n keys**, rendered through `t()` at the `<FormMessage>` site
  (`06-i18n.md`).
- Server-side validation errors (400/409 payloads) map back to `form.setError` per field where the
  API provides field paths; otherwise to the root error.
- Submitting state comes from the mutation (`createInvoice.isPending`) — never a `useState` flag.

## 5. Loading, Empty, and Error Surfaces

Every data-bearing screen designs three non-happy states, using kernel components:

| State | Source | Render |
| --- | --- | --- |
| Loading | Suspense fallback (route-level) or `isPending` (widget-level) | `<Spinner/>` or a skeleton matching layout |
| Empty | Query succeeded, zero items | `components/feedback/empty-state.tsx` with a CTA |
| Error | Error boundary (unexpected) / mutation error (expected) | `error-fallback.tsx` with retry (`resetErrorBoundary` + query `refetch`) |

The choice of Suspense vs `isPending` per surface is made in the data layer — see
`04-data-layer.md` §5.

## 6. Smells — agent self-check

- A `tailwind.config.js` created, or `@tailwind base` emitted (v3 idioms in a v4 codebase).
- Raw hex/rgb in class names (`bg-[#4f46e5]`) where an `@theme`/semantic token belongs.
- Class strings concatenated with `+`/template literals instead of `cn()`.
- A `components/ui/` file importing from `features/` or calling a feature's `t()` namespace.
- A form with hand-rolled `useState` per field, or a submit-spinner flag not derived from the
  mutation.
- Interactive behavior on non-interactive elements (`div onClick`) instead of a Radix/shadcn
  primitive.
- The same component fetching data AND deciding page layout (layout belongs to routes).
