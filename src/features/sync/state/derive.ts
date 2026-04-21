export type SyncStatus = 'in-sync' | 'syncing' | 'offline' | 'failed';

export type InternalState = {
  _inFlight: boolean;
  _followUpQueued: boolean;
  _online: boolean;
  _lastOutcome: 'initial' | 'ok' | 'failed';
  _hasQueuedChanges: boolean;
};

export function deriveStatus(s: InternalState): SyncStatus {
  if (s._inFlight) return 'syncing';
  if (!s._online) return 'offline';
  if (s._lastOutcome === 'failed') return 'failed';
  return 'in-sync';
}
