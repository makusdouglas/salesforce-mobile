export type SessionStatus = 'NotAuthenticated' | 'Authenticated' | 'RequiresRelogin';

export type SessionSnapshot = {
  status: SessionStatus;
  email: string | null;
};

type InternalSessionState = {
  accessToken: string | null;
  accessTokenExpiresAtMs: number | null;
  _isRefreshing: boolean;
  _queuedSync: boolean;
};

type FullState = SessionSnapshot & InternalSessionState;

function initialState(): FullState {
  return {
    status: 'NotAuthenticated',
    email: null,
    accessToken: null,
    accessTokenExpiresAtMs: null,
    _isRefreshing: false,
    _queuedSync: false,
  };
}

let state: FullState = initialState();
let cachedSnapshot: SessionSnapshot = makeSnapshot(state);
const listeners = new Set<() => void>();
let notifyingDepth = 0;

function makeSnapshot(s: FullState): SessionSnapshot {
  const snapshot: SessionSnapshot = { status: s.status, email: s.email };
  if (typeof __DEV__ !== 'undefined' && __DEV__) Object.freeze(snapshot);
  return snapshot;
}

function emit(): void {
  notifyingDepth += 1;
  try {
    for (const listener of Array.from(listeners)) {
      listener();
    }
  } finally {
    notifyingDepth -= 1;
  }
}

function guardReentrancy(): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && notifyingDepth > 0) {
    throw new Error('sessionStore: transitions must not happen inside subscriber callbacks');
  }
}

export const sessionStore = {
  getSnapshot(): SessionSnapshot {
    return cachedSnapshot;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const _internalSessionStore = {
  setAuthenticated(input: {
    email: string;
    accessToken: string;
    accessTokenExpiresAtMs: number;
    clearQueuedSync: boolean;
  }): void {
    guardReentrancy();
    state = {
      ...state,
      status: 'Authenticated',
      email: input.email,
      accessToken: input.accessToken,
      accessTokenExpiresAtMs: input.accessTokenExpiresAtMs,
      _queuedSync: input.clearQueuedSync ? false : state._queuedSync,
    };
    cachedSnapshot = makeSnapshot(state);
    emit();
  },
  setRequiresRelogin(input: { preserveEmail: string; queueSync: boolean }): void {
    guardReentrancy();
    state = {
      ...state,
      status: 'RequiresRelogin',
      email: input.preserveEmail,
      accessToken: null,
      accessTokenExpiresAtMs: null,
      _queuedSync: input.queueSync === true ? true : state._queuedSync,
    };
    cachedSnapshot = makeSnapshot(state);
    emit();
  },
  setNotAuthenticated(input: { preserveEmail: string | null }): void {
    guardReentrancy();
    state = {
      status: 'NotAuthenticated',
      email: input.preserveEmail,
      accessToken: null,
      accessTokenExpiresAtMs: null,
      _isRefreshing: false,
      _queuedSync: false,
    };
    cachedSnapshot = makeSnapshot(state);
    emit();
  },
  getInternal(): InternalSessionState {
    return {
      accessToken: state.accessToken,
      accessTokenExpiresAtMs: state.accessTokenExpiresAtMs,
      _isRefreshing: state._isRefreshing,
      _queuedSync: state._queuedSync,
    };
  },
  setInternal(patch: Partial<InternalSessionState>): void {
    state = { ...state, ...patch };
    // internal-only changes do not affect the public snapshot; do not emit.
  },
  /** Test-only: wipe back to initial state. */
  __resetForTests(): void {
    state = initialState();
    cachedSnapshot = makeSnapshot(state);
    listeners.clear();
  },
};
