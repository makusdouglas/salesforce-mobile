export type SyncStatus = 'in-sync' | 'syncing' | 'offline' | 'failed';

export type InternalState = {
  _inFlight: boolean;
  _followUpQueued: boolean;
  _online: boolean;
  _lastOutcome: 'initial' | 'ok' | 'failed';
  _hasQueuedChanges: boolean;
  /**
   * Wall-clock ms of the last successful sync pass. `null` when no sync has
   * succeeded yet in this session. Never cleared on failure — the last
   * known-good timestamp is preserved so Home's pill can keep showing
   * "há N h" even across intermittent failures.
   */
  _lastOkAt: number | null;
};

export function deriveStatus(s: InternalState): SyncStatus {
  if (s._inFlight) return 'syncing';
  if (!s._online) return 'offline';
  if (s._lastOutcome === 'failed') return 'failed';
  return 'in-sync';
}
