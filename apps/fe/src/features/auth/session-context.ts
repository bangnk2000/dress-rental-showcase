import { createContext } from 'react';

import type { MeResponseDto } from '@/api/generated/model';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionValue {
  status: SessionStatus;
  user: MeResponseDto | null;
  signIn: (input: { username: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Internal to the auth feature — consumers go through useSession(). */
export const SessionContext = createContext<SessionValue | null>(null);
