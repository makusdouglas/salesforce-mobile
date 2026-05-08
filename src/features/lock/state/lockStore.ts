export type LockStatus = 'NotSet' | 'Locked' | 'Unlocked';

export type LockSnapshot = {
  status: LockStatus;
};

type InternalState = {
  status: LockStatus;
  backgroundedAtMs: number | null;
  failedAttempts: number;
  inactivityTimeoutMinutes: number;
};

function initialState(): InternalState {
  return {
    status: 'NotSet',
    backgroundedAtMs: null,
    failedAttempts: 0,
    inactivityTimeoutMinutes: 5,
  };
}

let state: InternalState = initialState();
let cachedSnapshot: LockSnapshot = makeSnapshot(state);
let cachedFailedAttempts = 0;

const snapshotListeners = new Set<() => void>();
const failedAttemptsListeners = new Set<() => void>();
let notifyingDepth = 0;

function makeSnapshot(s: InternalState): LockSnapshot {
  const snap: LockSnapshot = { status: s.status };
  if (typeof __DEV__ !== 'undefined' && __DEV__) Object.freeze(snap);
  return snap;
}

function emitSnapshot(): void {
  notifyingDepth += 1;
  try {
    for (const listener of Array.from(snapshotListeners)) listener();
  } finally {
    notifyingDepth -= 1;
  }
}

function emitFailedAttempts(): void {
  cachedFailedAttempts = state.failedAttempts;
  for (const listener of Array.from(failedAttemptsListeners)) listener();
}

function guardReentrancy(): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && notifyingDepth > 0) {
    throw new Error(
      'lockStore: transitions must not happen inside subscriber callbacks',
    );
  }
}

function isLegalTransition(prev: LockStatus, next: LockStatus): boolean {
  if (prev === next) return true;
  if (prev === 'NotSet' && next === 'Unlocked') return true;
  if (prev === 'Unlocked' && next === 'Locked') return true;
  if (prev === 'Locked' && next === 'Unlocked') return true;
  if (prev === 'Unlocked' && next === 'NotSet') return true;
  if (prev === 'Locked' && next === 'NotSet') return true;
  return false;
}

export const lockStore = {
  getSnapshot(): LockSnapshot {
    return cachedSnapshot;
  },
  subscribe(listener: () => void): () => void {
    snapshotListeners.add(listener);
    return () => {
      snapshotListeners.delete(listener);
    };
  },
  /** Parallel channel for `failedAttempts` — not part of the public snapshot. */
  subscribeFailedAttempts(listener: () => void): () => void {
    failedAttemptsListeners.add(listener);
    return () => {
      failedAttemptsListeners.delete(listener);
    };
  },
  getFailedAttemptsSnapshot(): number {
    return cachedFailedAttempts;
  },
};

export const _internalLockStore = {
  setStatus(next: LockStatus): void {
    guardReentrancy();
    const prev = state.status;
    if (prev === next) return;
    if (typeof __DEV__ !== 'undefined' && __DEV__ && !isLegalTransition(prev, next)) {
      throw new Error(`lockStore: illegal transition ${prev} → ${next}`);
    }
    state = { ...state, status: next };
    cachedSnapshot = makeSnapshot(state);
    emitSnapshot();
  },
  /**
   * Bootstrap-only setter. The state-machine contract explicitly lists
   * (boot) → NotSet and (boot) → Locked as legal initial transitions
   * (see specs/004-local-lock/contracts/state-machine.md §State machine).
   * Normal callers MUST use `setStatus`; only `lockBootstrap()` calls this.
   */
  bootstrapStatus(next: 'NotSet' | 'Locked'): void {
    guardReentrancy();
    if (state.status === next) return;
    state = { ...state, status: next };
    cachedSnapshot = makeSnapshot(state);
    emitSnapshot();
  },
  setInactivityTimeoutMinutes(minutes: number): void {
    state = { ...state, inactivityTimeoutMinutes: minutes };
  },
  getInactivityTimeoutMinutes(): number {
    return state.inactivityTimeoutMinutes;
  },
  setBackgroundedAt(atMs: number | null): void {
    state = { ...state, backgroundedAtMs: atMs };
  },
  getBackgroundedAt(): number | null {
    return state.backgroundedAtMs;
  },
  incrementFailedAttempts(): number {
    state = { ...state, failedAttempts: state.failedAttempts + 1 };
    emitFailedAttempts();
    return state.failedAttempts;
  },
  resetFailedAttempts(): void {
    if (state.failedAttempts === 0) return;
    state = { ...state, failedAttempts: 0 };
    emitFailedAttempts();
  },
  getFailedAttempts(): number {
    return state.failedAttempts;
  },
  /** Test-only: reset back to initial state. */
  __resetForTests(): void {
    state = initialState();
    cachedSnapshot = makeSnapshot(state);
    cachedFailedAttempts = 0;
    snapshotListeners.clear();
    failedAttemptsListeners.clear();
  },
};

/**
 * Progressive delay curve for wrong-PIN attempts (research R6).
 * Returns the delay (ms) before the next attempt is allowed.
 * Returns Infinity when the forced-recovery threshold is hit.
 */
export function getProgressiveDelayMs(failedAttempts: number): number {
  if (failedAttempts <= 3) return 0;
  if (failedAttempts === 4) return 1000;
  if (failedAttempts === 5) return 2000;
  if (failedAttempts === 6) return 5000;
  if (failedAttempts === 7) return 10000;
  if (failedAttempts === 8) return 20000;
  if (failedAttempts === 9) return 30000;
  return Infinity;
}
