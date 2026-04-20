import { useSyncExternalStore } from 'react';

import { lockStore, type LockSnapshot } from '../state/lockStore';

export function useLock(): LockSnapshot {
  return useSyncExternalStore(lockStore.subscribe, lockStore.getSnapshot);
}
