import { deriveStatus, type InternalState, type SyncStatus } from './derive';

export type SyncStatusSnapshot = {
  readonly status: SyncStatus;
  /**
   * Wall-clock ms of the last successful sync pass. `null` when no sync has
   * succeeded yet in this session. NOT cleared on failure.
   */
  readonly lastOkAt: number | null;
};

function initialState(): InternalState {
  return {
    _inFlight: false,
    _followUpQueued: false,
    _online: false,
    _lastOutcome: 'initial',
    _hasQueuedChanges: false,
    _lastOkAt: null,
  };
}

let state: InternalState = initialState();
let cachedSnapshot: SyncStatusSnapshot = makeSnapshot(state);
const listeners = new Set<() => void>();
let notifyingDepth = 0;

function makeSnapshot(s: InternalState): SyncStatusSnapshot {
  const snapshot: SyncStatusSnapshot = {
    status: deriveStatus(s),
    lastOkAt: s._lastOkAt,
  };
  if (typeof __DEV__ !== 'undefined' && __DEV__) Object.freeze(snapshot);
  return snapshot;
}

function guardReentrancy(): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && notifyingDepth > 0) {
    throw new Error('syncStatusStore: transitions must not happen inside subscriber callbacks');
  }
}

function emit(): void {
  notifyingDepth += 1;
  try {
    for (const listener of Array.from(listeners)) {
      try {
        listener();
      } catch {
        // Listener bug must not break the bus. Same policy as sessionStore.
      }
    }
  } finally {
    notifyingDepth -= 1;
  }
}

function recompute(): void {
  const next = makeSnapshot(state);
  if (next.status === cachedSnapshot.status && next.lastOkAt === cachedSnapshot.lastOkAt) {
    return;
  }
  cachedSnapshot = next;
  emit();
}

export const syncStatusStore = {
  getSnapshot(): SyncStatusSnapshot {
    return cachedSnapshot;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const _internalSyncStatusStore = {
  setInFlight(v: boolean): void {
    guardReentrancy();
    if (state._inFlight === v) return;
    state = { ...state, _inFlight: v };
    recompute();
  },
  setFollowUpQueued(v: boolean): void {
    guardReentrancy();
    state = { ...state, _followUpQueued: v };
    // internal-only; does not affect public status
  },
  setOnline(v: boolean): void {
    guardReentrancy();
    if (state._online === v) return;
    state = { ...state, _online: v };
    recompute();
  },
  setLastOutcome(v: 'ok' | 'failed'): void {
    guardReentrancy();
    if (state._lastOutcome === v && v !== 'ok') return;
    if (v === 'ok') {
      state = { ...state, _lastOutcome: v, _lastOkAt: Date.now() };
    } else {
      state = { ...state, _lastOutcome: v };
    }
    recompute();
  },
  setHasQueuedChanges(v: boolean): void {
    guardReentrancy();
    state = { ...state, _hasQueuedChanges: v };
    // internal-only; does not affect public status
  },
  setLastOkAt(ms: number | null): void {
    guardReentrancy();
    if (state._lastOkAt === ms) return;
    state = { ...state, _lastOkAt: ms };
    recompute();
  },
  getInternal(): InternalState {
    return state;
  },
  __resetForTests(): void {
    state = initialState();
    cachedSnapshot = makeSnapshot(state);
    listeners.clear();
    notifyingDepth = 0;
  },
};
