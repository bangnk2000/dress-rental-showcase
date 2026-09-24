# UI Layer — Tailwind CSS v4 + shadcn/ui (App Router)

How this codebase builds UI: **Tailwind CSS v4** (CSS-first configuration via
`@tailwindcss/postcss`), **shadcn/ui** for owned, editable primitives, `next/font` +
`next/image` for framework-native assets, and a small set of composition rules that keep feature
UI consistent — including which pieces stay server-rendered. For where files live, see
`02-folder-structure.md`; for forms talking to the API, see `04-data-layer.md`.

## 1. Tailwind v4 — CSS-first, PostCSS wiring

Tailwind v4 removed `tailwind.config.js` as the primary configuration surface. Configuration is
**in CSS**. In Next.js the integration is the PostCSS plugin (there is no Vite plugin here):

```bash
pnpm add tailwindcss @tailwindcss/postcss
```

```js
// postcss.config.mjs — the ONLY PostCSS config
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```css
/* src/app/globals.css — the ONLY Tailwind entry, imported once in app/layout.tsx */
@import "tailwindcss";
```

Rules that follow from v4's model:

- **The three v3 directives are gone.** `@tailwind base/components/utilities` → a single
  `@import "tailwindcss"`. Never emit the v3 form.
- **Design tokens live in `@theme`.** Colors, fonts, breakpoints, radii are CSS variables declared
  in the stylesheet; utilities are generated from them:

```css
@theme {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;  /* next/font variable */
  --breakpoint-3xl: 1920px;
  --color-brand-500: oklch(0.62 0.19 259);   /* → bg-brand-500, text-brand-500, … */
}
```

- **A legacy JS config is an escape hatch only** (`@config`); do not introduce one in a new
  project. Content detection is automatic — no `content: []` array.
- Theme values are **CSS variables at runtime** — do not duplicate token values in TS constants.

**Fonts via `next/font`** (self-hosted, zero layout shift), wired into the token above:

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// <html lang={locale} className={inter.variable}>
```

**Images via `next/image`** — width/height (or `fill`) always set; remote hosts registered in
`next.config.ts` `images.remotePatterns`. Raw `<img>` for API-served images is a lint warning.

## 2. shadcn/ui — owned primitives, not a dependency

shadcn/ui is a **generator, not a library**: the CLI copies component source into
`src/components/ui/`, where it is repo-owned and editable. The current CLI (`shadcn`, 4.x) fully
supports Tailwind v4 + React 19 + App Router (it detects Next and targets `globals.css`).

**Init once:**

```bash
pnpm dlx shadcn@latest init      # creates components.json, lib/utils.ts (cn), CSS variables
pnpm dlx shadcn@latest add button dialog form input select table sonner
```

`components.json` pins the CLI's targets — keep it aligned with `02-folder-structure.md`:

```jsonc
{
  "style": "new-york",
  "rsc": true,
  "tailwind": { "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "ui": "@/components/ui", "utils": "@/lib/utils" }
}
```

Conventions:

- **`rsc: true` matters**: interactive primitives are emitted with `"use client"` already in
  place; presentational ones stay server-compatible. Do not add `"use client"` to a generated
  file that ships without it.
- **`cn()` for conditional classes** (`clsx` + `tailwind-merge`, created by init at
  `lib/utils.ts`). Never concatenate class strings by hand.
- **Theming via CSS variables** (`--background`, `--primary`, …) declared in `globals.css` with a
  `.dark` block; dark mode = toggling the `dark` class on `<html>` (a tiny theme provider owns
  this — render it in `app/providers.tsx`; suppress hydration warnings on `<html>` per the
  standard next-themes pattern if used). Components reference semantic tokens (`bg-background`,
  `text-primary`) — never raw palette values — so re-theming touches one file.
- **Editing a ui/ component is allowed** (that's the point) but it must stay *generic*: no feature
  imports, no domain naming, no feature-namespaced translation calls (resolving an
  already-namespaced KEY passed in is key passthrough, not namespace coupling). Feature-specific
  variants wrap the primitive inside the feature (`event-status-badge.tsx` wraps `badge.tsx`).
- **Do not re-generate over local edits.** Re-running `add` for an existing component overwrites;
  diff before accepting.

Known v4 gotchas the agent must respect:

- Tailwind v4 removed the default pointer **cursor on buttons**; if the design expects
  `cursor-pointer`, set it once in `globals.css` `@layer base`.
- Default **border color** is now `currentColor` — components relying on v3's gray default need an
  explicit `border-border` token (shadcn's generated CSS handles this; keep it).
- New-project palette is **oklch-based**; keep custom brand colors in oklch.

## 3. Composition Rules

- **Primitives up, composites down.** `components/ui/` = primitives (button, dialog);
  `components/layout|feedback/` = generic composites (page-header, empty-state); feature
  composites live in the feature. If a composite has zero product knowledge and two features
  want it, promote it to the kernel.
- **Server-first composition.** Static structure (headers, cards, tables of server-fetched data)
  renders in Server Components; `"use client"` goes on the interactive leaf (the form, the
  filter bar, the dialog trigger) — not on the page. See `01-architecture-principles.md` §5.
- **Variants over forks.** Extend a primitive with `cva` variants (shadcn's pattern) rather than
  copying it. One `button.tsx` with variants beats three button files.
- **Layout is the segment's job.** Features render content; spacing/grid/shell live in route
  `layout.tsx` files and thin pages. A feature component should render correctly in any
  reasonably-sized container.
- **Accessibility is inherited, don't break it.** shadcn primitives wrap Radix (focus, ARIA,
  keyboard). When editing, keep the Radix wiring; when building custom interactive components,
  start from a Radix primitive, not a `div onClick`.
- **Navigation uses the i18n wrappers**: `Link`/`useRouter` from `src/i18n/navigation.ts`
  (`06-i18n.md` §4), never `next/link` directly in features — locale prefixes break otherwise.
- **Icons**: `lucide-react` (shadcn's default), imported per-icon.

## 4. Forms — react-hook-form + zod + shadcn `form.tsx`

Forms are client components (`"use client"`). The standard stack (shadcn's `form.tsx` is built
for it):

```tsx
// features/events/schemas/event-form.schema.ts
export const eventFormSchema = z.object({
  title: z.string().min(1, 'events.form.errors.titleRequired'),
  capacity: z.coerce.number().positive('events.form.errors.capacityPositive'),
});
export type EventFormValues = z.infer<typeof eventFormSchema>;
```

```tsx
// features/events/components/event-form.tsx  ("use client")
import { mapApiError } from '@/api/errors';
// other imports elided

const form = useForm<EventFormValues>({
  resolver: zodResolver(eventFormSchema),
  defaultValues: { title: '', capacity: 0 },
});
const createEvent = useCreateEvent();              // Orval-generated (04-data-layer.md)

function onSubmit(values: EventFormValues) {
  createEvent.mutate({ data: values }, {
    onError: (e) => {
      const err = mapApiError(e);            // src/api/errors.ts — the one seam (04 §3)
      if (err.kind === 'outcome') {
        // one branch per outcome code — never a generic collapse (designed states: 14 §2 template §4)
        if (err.status === 'rejected_duplicate_event') {
          form.setError('title', { message: t('form.errors.duplicateEvent') });
        }
      } else if (err.details) {
        for (const d of err.details) form.setError(d.field ?? 'root', { message: d.message });
      } else {
        form.setError('root', { message: t('form.errors.createFailed') });
      }
    },
  });
}
```

Root-level errors need explicit rendering — shadcn `<FormMessage>` only renders per-FIELD errors
(see 11's form for the `errors.root` line).

Rules:

- **Two schema layers, two jobs.** `*.schema.ts` in the feature validates the FORM (messages are
  i18n keys, coercions from input strings). The API's types/optional Zod schemas are generated by
  Orval and validate the CONTRACT. Do not merge them — form shape ≠ request shape is normal; map
  in `onSubmit`.
- Error messages in schemas are **i18n keys**, rendered through `t()` at the `<FormMessage>` site
  (`06-i18n.md`; requires the one-line FormMessage tweak from 12 Phase 2).
- Validation faults carry `details[]` in the envelope (04 §3) — map them to per-field
  `form.setError`; otherwise to the root error.
- Submitting state comes from the mutation (`createEvent.isPending`) — never a `useState` flag.
- Server Actions + `useActionState` are the sanctioned ALTERNATIVE for forms that must work
  before hydration (04 §7) — a decision recorded in the slice design doc, not a default.

## 5. Loading, Empty, and Error Surfaces

Every data-bearing screen designs three non-happy states, using kernel components:

| State | Source | Render |
| --- | --- | --- |
| Loading | `loading.tsx` / `<Suspense>` fallback (segment-level) or `isPending` (widget-level) | `<Spinner/>` or a skeleton matching layout |
| Empty | Query succeeded, zero items | `components/feedback/empty-state.tsx` with a CTA |
| Error | `error.tsx` (unexpected — client boundary by contract) / mutation error (expected) | `error-fallback.tsx` with retry (`reset()` + query `refetch`) |

Mutations additionally design: submitting (double-submit blocked) and ONE state per business
outcome code in the slice's catalog (14 §2 template §4).

The choice of streamed RSC vs hydrated Suspense hook vs classic `isPending` per surface is made
in the data layer — see `04-data-layer.md` §5.

## 6. Smells — agent self-check

- A `tailwind.config.js` created, or `@tailwind base` emitted (v3 idioms in a v4 codebase).
- Raw hex/rgb in class names (`bg-[#4f46e5]`) where an `@theme`/semantic token belongs.
- Class strings concatenated with `+`/template literals instead of `cn()`.
- A `components/ui/` file importing from `features/` or hardcoding a feature namespace.
- `"use client"` added to a presentational component (or a page) that has no interactivity.
- A font `<link>` tag or raw `<img>` where `next/font`/`next/image` belong.
- `next/link` imported in a feature instead of the `i18n/navigation` wrapper.
- A form with hand-rolled `useState` per field, or a submit-spinner flag not derived from the
  mutation.
- Interactive behavior on non-interactive elements (`div onClick`) instead of a Radix/shadcn
  primitive.
- The same component fetching data AND deciding page layout (layout belongs to segments).
