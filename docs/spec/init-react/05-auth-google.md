# Auth — Google Sign-In via `@react-oauth/google`

How this codebase authenticates users with Google and manages the app session afterwards. The
library is `@react-oauth/google` (0.13.x — still the 0.x line; wraps Google Identity Services).
The load-bearing decision is **which flow** you use and **where the session lives**; everything
else follows.

Feature layout: all of this is the `features/auth/` slice (`02-folder-structure.md`) — session
provider, sign-in button, route guard — plus ONE integration point in the API mutator
(`04-data-layer.md` §3).

## 1. Provider Setup

Wrap the app (or just the subtree that signs in) once, in `app/providers.tsx`:

```tsx
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <SessionProvider>{children}</SessionProvider>
</GoogleOAuthProvider>
```

`VITE_GOOGLE_CLIENT_ID` comes from Google Cloud Console → Credentials → OAuth 2.0 Client ID
(type: Web application; authorized JS origins = your dev + prod origins). The client ID is public
by design; the client **secret** never appears in frontend code or env.

## 2. Choose the Flow (decision table)

| Your need | Flow | What Google returns | What the backend does |
| --- | --- | --- | --- |
| "Sign in with Google" as identity (the normal case) | **Credential / ID token** — `<GoogleLogin/>` (renders Google's button, One Tap optional) | `credentialResponse.credential`: a JWT **ID token** | Verifies the JWT (`google-auth-library` / JWKS), extracts `sub`/`email`, creates/loads the user, issues the APP session |
| Backend must call Google APIs on the user's behalf (Drive, Calendar) with offline/refresh access | **Auth-code** — `useGoogleLogin({ flow: 'auth-code' })` | `codeResponse.code`: one-time authorization code | Exchanges code (with client secret) for access **and refresh** tokens, stores them server-side |
| Frontend itself calls a Google API, short-lived, no backend | Implicit — `useGoogleLogin()` (default) | short-lived `access_token` in the browser | nothing |

Rules:

- **Default to the credential (ID token) flow** for sign-in. Do not request Google access tokens
  just to prove identity.
- The implicit flow's access token is short-lived with **no refresh** — per the library's own
  guidance, server-side needs use `flow: 'auth-code'` ("requires backend to exchange code with
  access and refresh token").
- **The Google token is NOT your session.** In every flow, the frontend hands Google's artifact
  (ID token or code) to YOUR backend exactly once; the backend verifies it and issues the app's
  own session. Never store Google's ID token and replay it as an API credential.

## 3. The Sign-In Slice

```tsx
// features/auth/components/google-sign-in-button.tsx
export function GoogleSignInButton() {
  const { signIn } = useSession();
  return (
    <GoogleLogin
      onSuccess={({ credential }) => credential && signIn(credential)}
      onError={() => toast.error(t('auth:signInFailed'))}
      useOneTap                       // optional; drop if One Tap UX is unwanted
    />
  );
}
```

```tsx
// features/auth/session-provider.tsx (sketch)
// signIn: POST /auth/google { idToken } → backend verifies, returns session (user + tokens/cookie)
// The generated useAuthGoogle mutation from api/generated/auth does this call — even auth goes
// through the generated layer.
```

- `onSuccess` receives `{ credential, clientId, select_by }`; only `credential` leaves the
  component, straight into the session module.
- Session state (user, status) is **client state** → a context/provider in the auth feature
  (`use-session.ts` consumer hook). The user PROFILE fetched from your API afterwards is **server
  state** → generated `useGetMe()` hook, cached like everything else.

## 4. Where the App Session Lives (pick ONE, state it in AGENTS.md)

| Model | Storage | Mutator impact (`04-data-layer.md`) | Trade-off |
| --- | --- | --- | --- |
| **httpOnly cookie session** (recommended when backend is same-site) | Cookie set by backend; JS never sees it | No request interceptor; `withCredentials: true`; 401 interceptor calls `POST /auth/refresh` (cookie-based) then retries | Immune to XSS token theft; needs CSRF strategy + CORS `credentials` config |
| **Bearer access + refresh token** | Access token in memory (module variable) — NOT localStorage; refresh via httpOnly cookie or (last resort) storage | Request interceptor injects `Authorization`; 401 → refresh-and-retry as shown in the mutator | Works cross-origin/mobile-reuse; access token lost on reload → silent refresh on boot |

Rules common to both:

- Access tokens in `localStorage` are the classic XSS jackpot — if you must persist, persist only
  the refresh token server-set as httpOnly, and bootstrap the session with a refresh call on app
  start (`SessionProvider` does this once, rendering a splash meanwhile).
- Sign-out = backend revoke + clear local session + `queryClient.clear()` (the cache holds
  user-scoped data) + optionally `googleLogout()` (disables One Tap auto-select).
- All 401 handling is in the mutator — the auth feature never wraps API calls.

## 5. Route Guards

```tsx
// features/auth/components/require-auth.tsx
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useSession();               // 'loading' | 'authenticated' | 'anonymous'
  const location = useLocation();
  if (status === 'loading') return <SplashScreen />;
  if (status === 'anonymous')
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  return children;
}
```

- Guards wrap **route elements** in `app/router.tsx` (`<RequireAuth><InvoicesRoute/></RequireAuth>`),
  not individual components — one enforcement point per subtree.
- After sign-in, redirect back to `state.from` (the classic pattern).
- Role/permission checks are still guards (`<RequireRole role="admin">`), driven by the session
  user — but remember the frontend check is UX, not security; the API enforces authorization.

## 6. Testing & local dev

- The Google button requires real Google origins — in Playwright/e2e, **bypass Google**: expose a
  test-only backend endpoint (or MSW handler) that mints a session directly, and test YOUR flows
  (guards, refresh, sign-out). Unit-test the session provider with a mocked sign-in mutation
  (`09-testing-strategy.md`).
- Add `http://localhost:5173` to authorized JavaScript origins for dev; a mismatch produces the
  infamous silent `redirect_uri_mismatch`/origin console error.
- One Tap (`useOneTap`) needs a real, non-incognito browser profile — do not chase it in CI.

## 7. Smells — agent self-check

- Google ID token stored and replayed as the API `Authorization` credential.
- Access token in `localStorage`; or token-reading logic anywhere but the session module + mutator.
- `flow: 'auth-code'` used for plain sign-in (needless scope + backend complexity), or implicit
  flow tokens sent to the backend as identity proof.
- A component calling `useGoogleLogin` directly instead of going through the auth feature's
  public surface.
- Guards duplicated inside feature components instead of wrapping routes.
- Sign-out that forgets `queryClient.clear()` — the next user sees the previous user's cache.
- The client secret, or any Google API call requiring it, appearing in frontend code.
