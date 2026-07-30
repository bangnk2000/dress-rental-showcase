/**
 * PUBLIC SURFACE of the auth feature — the only import path for outsiders.
 * The export names are the contract with app/router.tsx and app/providers.tsx.
 */
export { SessionProvider } from './session-provider';
export { RequireAuth } from './require-auth';
export { useSession, type SessionValue } from './use-session';
export { SignInRoute } from './sign-in-route';
// Not referenced by the root layout yet — exported for later wiring.
export { SignOutButton } from './components/sign-out-button';
