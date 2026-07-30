import { useContext } from 'react';

import { SessionContext, type SessionValue } from './session-context';

export type { SessionValue } from './session-context';

export function useSession(): SessionValue {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error('useSession must be used within <SessionProvider>');
  }
  return session;
}
