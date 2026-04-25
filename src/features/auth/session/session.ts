export type SessionStatus = 'NotAuthenticated' | 'Authenticated' | 'RequiresRelogin';

// 016-product-lifecycle-roles — widened from {'admin','seller'} to the
// granular admin-grade roles plus the legacy 'admin' alias kept for the
// migration window. 'admin' is treated as equivalent to 'superuser' by
// useAdminGate / useAnyAdminRole until every Supabase row is rewritten
// by migration 0018 and every feature's RLS switches off is_admin().
export type SessionRole =
  | 'seller'
  | 'manage-products'
  | 'manage-salespersons'
  | 'manage-clients'
  | 'superuser'
  | 'admin';

// Subset of SessionRole that grants access to the Admin tab.
export type AdminSessionRole = Exclude<SessionRole, 'seller'>;

// The set of roles that are ACTIVELY managed by AdminUserRolesForm
// (feature 016 Part B). `seller` is managed by feature 015's Edge
// Function and is NOT toggleable from the roles form. `admin` is legacy
// alias that the migration rewrites to `superuser`.
export type ManagedAdminRole = Exclude<AdminSessionRole, 'admin'>;

export type SessionSnapshot = {
  status: SessionStatus;
  email: string | null;
  roles: readonly SessionRole[];
};

type InternalSessionState = {
  accessToken: string | null;
  accessTokenExpiresAtMs: number | null;
  _isRefreshing: boolean;
  _queuedSync: boolean;
};

type FullState = SessionSnapshot & InternalSessionState;

const EMPTY_ROLES: readonly SessionRole[] = Object.freeze([]);

function initialState(): FullState {
  return {
    status: 'NotAuthenticated',
    email: null,
    roles: EMPTY_ROLES,
    accessToken: null,
    accessTokenExpiresAtMs: null,
    _isRefreshing: false,
    _queuedSync: false,
  };
}

function sortRoles(input: readonly SessionRole[]): readonly SessionRole[] {
  const unique = Array.from(new Set(input)).sort();
  return Object.freeze(unique);
}

function rolesEqual(
  a: readonly SessionRole[],
  b: readonly SessionRole[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

let state: FullState = initialState();
let cachedSnapshot: SessionSnapshot = makeSnapshot(state);
const listeners = new Set<() => void>();
let notifyingDepth = 0;

function makeSnapshot(s: FullState): SessionSnapshot {
  const snapshot: SessionSnapshot = { status: s.status, email: s.email, roles: s.roles };
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
      roles: EMPTY_ROLES,
      accessToken: null,
      accessTokenExpiresAtMs: null,
      _isRefreshing: false,
      _queuedSync: false,
    };
    cachedSnapshot = makeSnapshot(state);
    emit();
  },
  setRoles(roles: readonly SessionRole[]): void {
    guardReentrancy();
    const next = sortRoles(roles);
    if (rolesEqual(state.roles, next)) return;
    state = { ...state, roles: next };
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
