import { useSyncExternalStore } from 'react';

import { sessionStore, type SessionSnapshot } from '../session/session';

export function useSession(): SessionSnapshot {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
}
