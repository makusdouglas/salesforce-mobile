import { AppState, type AppStateStatus } from 'react-native';

import { _internalLockStore, lockStore } from './lockStore';

type IsExpiredInput = {
  backgroundedAtMs: number | null;
  nowMs: number;
  timeoutMinutes: number;
};

/**
 * Pure policy function — exposed for unit testing. Returns true when the
 * elapsed background time exceeds the configured timeout, false otherwise.
 * Clock skew (negative elapsed) is clamped to 0.
 */
export function isInactivityExpired(input: IsExpiredInput): boolean {
  if (input.backgroundedAtMs === null) return false;
  const elapsedMs = Math.max(0, input.nowMs - input.backgroundedAtMs);
  const timeoutMs = input.timeoutMinutes * 60 * 1000;
  return elapsedMs > timeoutMs;
}

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
