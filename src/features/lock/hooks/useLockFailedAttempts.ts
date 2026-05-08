import { useSyncExternalStore } from 'react';

import { lockStore } from '../state/lockStore';

/**
 * Internal hook — consumed only by LockScreen for progressive-delay UI.
 * NOT re-exported from the `@/features/lock` barrel.
 */
export function useLockFailedAttempts(): number {
  return useSyncExternalStore(
    lockStore.subscribeFailedAttempts,
    lockStore.getFailedAttemptsSnapshot,
  );
}
