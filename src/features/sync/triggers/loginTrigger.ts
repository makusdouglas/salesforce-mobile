/**
 * Login trigger — subscribes to sessionStore and fires a sync pass when:
 *
 *   (1) the session status transitions into 'Authenticated' from any other
 *       status (fresh login, re-login after expiry), OR
 *   (2) the session was already 'Authenticated' and the internal
 *       `_queuedSync` flag goes from true to false (a silent refresh
 *       cleared a pending queued-sync after a connectivity return).
 *
 * Reads the 003 internal `_queuedSync` flag — src/features/auth/index.ts
 * intentionally does NOT re-export sessionStore or _internalSessionStore
 * (verified 2026-04-21; 003 barrel header explicitly forbids it). This
 * direct-path import is the only exception; 003's public barrel is used
 * for every other auth concern. See [contracts/triggers.md §T1].
 */

import {
  _internalSessionStore,
  sessionStore,
  type SessionSnapshot,
} from '@/features/auth/session/session';

import { syncService } from '../service/syncService';

export function startLoginTrigger(): () => void {
  // Seed with the current snapshot so the first emission compares against
  // the state-at-subscribe, not a synthetic null. Prevents firing a pass
  // just because a listener attached while the session was already
  // Authenticated.
  let previous: SessionSnapshot = sessionStore.getSnapshot();
  let previousQueuedSync = _internalSessionStore.getInternal()._queuedSync;

  const unsubscribe = sessionStore.subscribe(() => {
    const snapshot = sessionStore.getSnapshot();
    const internal = _internalSessionStore.getInternal();

    const transitionedIntoAuthenticated =
      snapshot.status === 'Authenticated' && previous.status !== 'Authenticated';

    const queuedSyncCleared =
      snapshot.status === 'Authenticated' &&
      previous.status === 'Authenticated' &&
      previousQueuedSync === true &&
      internal._queuedSync === false;

    previous = snapshot;
    previousQueuedSync = internal._queuedSync;

    if (transitionedIntoAuthenticated || queuedSyncCleared) {
      void syncService.runSync({ trigger: 'login' });
    }
  });

  return unsubscribe;
}
