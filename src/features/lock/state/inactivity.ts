import { AppState, type AppStateStatus } from 'react-native';

import { isInactivityExpired } from './inactivityPolicy';
import { _internalLockStore, lockStore } from './lockStore';

export { isInactivityExpired } from './inactivityPolicy';

/**
 * Start an AppState subscription that records backgroundedAtMs on
 * `active → background | inactive` and, on `background | inactive → active`,
 * transitions Unlocked → Locked if the inactivity timeout has been exceeded.
 *
 * Returns an unsubscribe function.
 */
export function startInactivityListener(): () => void {
  let previousState: AppStateStatus = AppState.currentState;

  const handler = (next: AppStateStatus): void => {
    const nowMs = Date.now();

    if (previousState === 'active' && (next === 'background' || next === 'inactive')) {
      _internalLockStore.setBackgroundedAt(nowMs);
      previousState = next;
      return;
    }

    if ((previousState === 'background' || previousState === 'inactive') && next === 'active') {
      const startedAt = _internalLockStore.getBackgroundedAt();
      _internalLockStore.setBackgroundedAt(null);
      previousState = next;

      if (startedAt === null) return;
      const expired = isInactivityExpired({
        backgroundedAtMs: startedAt,
        nowMs,
        timeoutMinutes: _internalLockStore.getInactivityTimeoutMinutes(),
      });
      if (expired && lockStore.getSnapshot().status === 'Unlocked') {
        _internalLockStore.setStatus('Locked');
      }
      return;
    }

    previousState = next;
  };

  const subscription = AppState.addEventListener('change', handler);
  return () => subscription.remove();
}
