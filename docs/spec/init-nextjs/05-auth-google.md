# Auth — Google Sign-In via Auth.js (next-auth v5)

How this codebase authenticates users with Google and manages the app session afterwards. The
library is **Auth.js / next-auth v5** — the OAuth handshake runs on the SERVER (the client
secret legitimately lives in server env, unlike an SPA), and the session is an httpOnly cookie.
The load-bearing decision is **who owns the session** — the NestJS backend or Auth.js — and
everything else follows.

Layout: `src/auth.ts` (config) + `app/api/auth/[...nextauth]/route.ts` (handlers) +
`features/auth/` (sign-in button, user menu) + ONE integration point in the API mutator
(`04-data-layer.md` §3) + optimistic redirects in `src/proxy.ts`.

## 1. Setup

```bash
pnpm add next-auth@beta        # the v5 line; verify the current tag at init time
npx auth secret                # generates AUTH_SECRET into .env.local
```

```ts
// src/auth.ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],          // reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from env
  callbacks: {
    // model A (backend session): exchange the Google ID token ONCE at sign-in (§2)
    // model B (Auth.js session): enrich the JWT with roles from the backend here
  },
});
```

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

Env: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — **server-only**, never
`NEXT_PUBLIC_*`. Google Cloud Console → OAuth client (Web application): authorized redirect URI
`https://<host>/api/auth/callback/google` (+ the localhost variant for dev).

## 2. Choose the Session Owner (decision table)

| Model | How it works | Mutator impact (`04-data-layer.md` §3) | When |
| --- | --- | --- | --- |
| **A — Backend-owned session** (recommended with the NestJS sibling) | Auth.js runs the Google handshake; in the `signIn` callback the Google ID token is POSTed ONCE to the backend's `/auth/google` (generated hook), which verifies it (JWKS) and sets ITS OWN httpOnly session cookie; Auth.js keeps only a thin mirror for UI (`session.user`) | None beyond the default: the browser sends the backend cookie via the same-origin rewrite; server-side calls forward it via `cookies()` | Backend already owns users/roles/authorization — one source of session truth, FE and any other client authenticate the same way |
| **B — Auth.js-owned session** (JWT strategy) | Auth.js issues its own encrypted JWT session cookie; the backend TRUSTS it — verifies the JWT via shared `AUTH_SECRET` or a JWKS endpoint you expose | The mutator attaches the session JWT as `Authorization: Bearer` (read server-side from the session, client-side via a thin token endpoint) | No backend session machinery, or several backends trusting one identity |
| **0 — No session** (public, anonymous site) | No Auth.js, no `src/auth.ts`, no `(app)` group; `proxy.ts` does locale routing only | The mutator forwards no cookie and has no `onUnauthenticated`; a 401 is an ordinary fault through `mapApiError`. Only operations the BE exposes WITHOUT auth are callable — list the missing public reads as contract gaps (14 §1) | Marketing / catalogue sites whose staff surface lives in another app. Adding sign-in later = pick A or B then, as a design-tier change |

Rules common to A and B:

- **The Google token is NOT your session.** Google's ID token is verified once at sign-in and
  discarded; the app session (cookie A or JWT B) is what authenticates API calls. Never store
  Google's ID token and replay it as an API credential.
- Pick ONE model, record it in `AGENTS.md`, and let the mutator + `auth.ts` be the only files
  that know the mechanics.
- Sign-out = backend revoke (model A) / Auth.js `signOut()` + clear the query cache
  (`queryClient.clear()` — the cache holds user-scoped data).

## 3. The Sign-In Slice

```tsx
// features/auth/components/google-sign-in-button.tsx  (server component is fine)
import { signIn } from '@/auth';

export function GoogleSignInButton() {
  return (
    <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/dashboard' }); }}>
      <Button type="submit">{/* t('auth.signInWithGoogle') */}</Button>
    </form>
  );
}
```

- The handshake is a server-side redirect flow — no Google JS SDK, no popup wiring, works before
  hydration. This is the Next.js improvement over the SPA's `@react-oauth/google` client flow.
- Session state for UI: server components call `await auth()`; client components that truly need
  it use `useSession` from `next-auth/react` (wrap the subtree in `<SessionProvider>` only if
  used — most UI reads the session server-side and passes plain props down).
- The user PROFILE from your API is **server state** → generated `useGetMe()` hook, cached like
  everything else; `session.user` carries only identity basics.

## 4. Where 401 Handling Lives

One seam, per `04-data-layer.md` §3:

- **Client-side 401** (session expired mid-use): the mutator's `onUnauthenticated()` clears the
  query cache and redirects to `/sign-in?from=<path>`. No component ever inspects 401.
- **Server-side 401** (RSC call with a dead cookie): the thrown `HttpError` reaches the segment
  guard/boundary; the page-level guard (§5) redirects before rendering private UI.
- Model A refresh: the backend rotates its own cookie (its concern). Model B: Auth.js session
  refresh is configured in `auth.ts` (`maxAge`, `updateAge`) — not in components.

## 5. Route Protection — optimistic in proxy, authoritative at the data seam

```ts
// src/proxy.ts (Next 16; middleware.ts on 15) — OPTIMISTIC redirect for UX only
import { auth } from '@/auth';
export default auth((req) => {
  const isAppRoute = req.nextUrl.pathname.startsWith('/dashboard') /* or the (app) matcher */;
  if (isAppRoute && !req.auth)
    return Response.redirect(new URL(`/sign-in?from=${req.nextUrl.pathname}`, req.nextUrl));
});
export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
```

```tsx
// app/(app)/layout.tsx — the server-side check for the authenticated group
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/sign-in');
  return <AppShell user={session.user}>{children}</AppShell>;
}
```

- **Middleware is UX, not security.** It runs on cached/optimistic state and can be bypassed;
  the authoritative checks are (a) the server-side `auth()` in the protected group's layout/pages
  and — decisively — (b) the BACKEND authorizing every API call via the session it owns. The
  frontend check only decides what to render.
- Role gating: `session.user.role` drives what renders (`<RequireRole>` wrapper or plain
  conditionals in server components); the API enforces the real permission.
- After sign-in, redirect back to `?from=` (the classic pattern).

## 6. Testing & local dev

- **Never automate Google's real UI.** In Playwright, mint a session directly: model A — a
  test-only backend endpoint issues the session cookie; model B — programmatically create the
  Auth.js session cookie in a fixture. Then test YOUR flows (guards, redirects, sign-out).
- Unit tests: client components read session via props or a mocked `useSession`; server guard
  logic is covered by e2e (RTL cannot render async RSC — `09-testing-strategy.md` §5).
- Dev: add `http://localhost:3000/api/auth/callback/google` to the Google client's redirect URIs;
  `AUTH_URL` only when the host can't be inferred.

## 7. Smells — agent self-check

- Google's ID token stored anywhere or replayed as an API credential.
- `AUTH_GOOGLE_SECRET`/`AUTH_SECRET` in a `NEXT_PUBLIC_*` var or imported into client code.
- Auth checks ONLY in `proxy.ts` (optimistic-as-security), or duplicated per component instead
  of the group layout + backend enforcement.
- A client-side Google SDK (`@react-oauth/google`) added alongside Auth.js — one handshake owner.
- Token/cookie logic in components instead of the mutator/auth seam; a component branching on 401.
- Sign-out that forgets `queryClient.clear()` — the next user sees the previous user's cache.
- Session mirrored into a store or `useState` (`useEffect(() => setUser(session.user))`).
- e2e automating Google's real sign-in UI instead of the session-minting fixture.
