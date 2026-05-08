import { useSyncExternalStore } from 'react';

import { syncStatusStore, type SyncStatusSnapshot } from '../state/syncStatusStore';

export function useSyncStatus(): SyncStatusSnapshot {
  return useSyncExternalStore(syncStatusStore.subscribe, syncStatusStore.getSnapshot);
}
