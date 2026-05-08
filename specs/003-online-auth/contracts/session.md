# Contract — Session state, subscribers, and `useSession` hook

**Feature**: 003-online-auth
**Status**: Authoritative — consumed by the root navigator, `requireSession`, any screen that reads the current salesperson's email, and the sync block for scheduling.
**Implementation path**: `src/features/auth/session/session.ts` (singleton + emitter), `src/features/auth/hooks/useSession.ts` (React hook), `src/features/auth/components/SessionProvider.tsx` (Context bridge).

---

## The `Session` singleton (module-level)

```ts
// src/features/auth/session/session.ts (shape, not code to paste)

type SessionStatus = 'NotAuthenticated' | 'Authenticated' | 'RequiresRelogin';

type SessionSnapshot = {
  status: SessionStatus;
  email: string | null;      // null only when status === 'NotAuthenticated' and no lastEmail exists
};

// Public module surface
export const sessionStore: {
  getSnapshot(): SessionSnapshot;             // synchronous, cheap, returns a frozen object
  subscribe(listener: () => void): () => void; // returns unsubscribe; listener is called after every state change
};

// Internal module surface (used by authService only — not re-exported from the auth barrel)
export const _internalSessionStore: {
  setAuthenticated(input: {
    email: string;
    accessToken: string;
    accessTokenExpiresAtMs: number;
    clearQueuedSync: boolean;   // true when a login/relogin resolves; false for a silent refresh
  }): void;

  setRequiresRelogin(input: { preserveEmail: string; queueSync: boolean }): void;

  setNotAuthenticated(input: { preserveEmail: string | null }): void;

  getInternal(): InternalSessionState;  // access-token + flags; never exposed outside src/features/auth
};
```

**Thread-safety note**: JS is single-threaded; the store reads and writes from the main thread only. The subscriber callback list is mutated atomically inside `subscribe` / `unsubscribe` to guard against listeners unsubscribing during notification.

**Observable semantics**: listeners are called once per transition, *after* the new snapshot is visible to any subsequent `getSnapshot()` call. Listeners MUST NOT synchronously trigger another state transition — doing so is a developer bug and will throw a `DevError` in `__DEV__` builds.

---

## `useSession()` — the React hook

```ts
function useSession(): {
  status: SessionStatus;
  email: string | null;
};
```

Backed by `useSyncExternalStore` with `sessionStore.subscribe` + `sessionStore.getSnapshot`. Concurrent-mode-safe. Returns a stable reference per emitted snapshot.

**Usage** (see [quickstart.md](../quickstart.md)):

```tsx
function RootNavigator() {
  const { status } = useSession();
  return status === 'NotAuthenticated' ? <AuthStack /> : <HomeStack />;
}
```

Reading `email` is for display only (home-header welcome line, logout confirmation screen). No business logic branches on `email`.

---

## `SessionProvider` — for screens that need cross-tree access

```tsx
<SessionProvider>
  <NavigationContainer>
    <RootNavigator />
  </NavigationContainer>
</SessionProvider>
```

`SessionProvider` wires up:
- `authBootstrap()` — runs once on mount to hydrate the session from secure store (see [auth-service.md](./auth-service.md)).
- `startConnectivityListener()` — subscribes to `NetInfo` and triggers silent refreshes (research R4).
- Teardown on unmount (normally never — the provider wraps the whole app tree).

`SessionProvider` does **not** inject a React Context that `useSession()` needs — the hook reads from `sessionStore` directly. The Provider exists only to own side effects (bootstrap + connectivity subscription) at a well-scoped lifecycle.

---

## State transitions — authoritative table

| From              | To                | Trigger                                                     | Side effects                                                                                                         |
|-------------------|-------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| NotAuthenticated  | Authenticated     | `authService.login(...)` resolves                           | Write `auth.refreshCredential` and `auth.lastEmail`; cache tokens in memory; emit.                                  |
| Authenticated     | Authenticated     | `authService.refresh(...)` resolves                         | Rotate `refreshToken` if Supabase rotated; bump `lastRefreshAtMs`; update in-memory access token; emit.             |
| Authenticated     | RequiresRelogin   | `authService.refresh(...)` rejects with `RELOGIN_REQUIRED`  | Delete `auth.refreshCredential`; preserve `auth.lastEmail`; clear in-memory tokens; set `_queuedSync` if applicable; emit. |
| Authenticated     | NotAuthenticated  | `authService.logout()` resolves                             | Delete both secure-store keys; clear in-memory tokens; best-effort remote revocation; emit.                         |
| RequiresRelogin   | Authenticated     | `authService.relogin(...)` resolves                         | Write `auth.refreshCredential` with new token; bump `lastRefreshAtMs`; cache tokens in memory; **clear `_queuedSync`**; emit. |
| RequiresRelogin   | NotAuthenticated  | `authService.logout()` resolves                             | Same as Authenticated→NotAuthenticated.                                                                              |
| RequiresRelogin   | RequiresRelogin   | User cancels the Relogin screen                             | No state change; `requireSession()` throws `AuthError('RELOGIN_REQUIRED')` to the caller.                           |
| (boot)            | Authenticated     | Bootstrap reads a valid `auth.refreshCredential` inside the 90-day window | No network call (FR-014). Silent refresh queued for the next connectivity event.                                    |
| (boot)            | NotAuthenticated  | Bootstrap finds no `auth.refreshCredential`, or the TTL elapsed | If TTL elapsed: delete `auth.refreshCredential`, preserve `auth.lastEmail`. Otherwise: nothing to clean up.         |

**Invariants re-stated**:

- `status === 'Authenticated'` ⇒ `email !== null`.
- `status === 'RequiresRelogin'` ⇒ `email !== null` (preserved from the successful session that was just demoted).
- `status === 'NotAuthenticated'` ⇒ `email` is either null (fresh install / post-logout) OR the last-known email (after a 90-day-TTL elapse).
- Transitioning away from `RequiresRelogin` to `Authenticated` MUST clear `_queuedSync`. Nothing else may clear it.

---

## Emission semantics

- Every transition above emits **exactly one** notification to subscribers, *after* `getSnapshot()` reflects the new state.
- Internal flags (`_isRefreshing`, `_queuedSync`) do NOT trigger emissions — they are not part of the public snapshot.
- A transition that sets `status` to the same value it already had (e.g., `Authenticated → Authenticated` on a silent refresh) still emits, because the internal tokens changed, but the public snapshot's `status` + `email` are unchanged so a `useSession()` subscriber using `===` comparison will not re-render.

---

## What consumers MUST NOT do

- **Must not** import `sessionStore` from `src/features/auth/session/session.ts` directly; use the barrel (`@/features/auth`) or `useSession()`.
- **Must not** mutate the snapshot returned by `getSnapshot()`. It is frozen in `__DEV__` builds; in production it is treated as frozen by convention.
- **Must not** call `_internalSessionStore.*` methods. Those are reserved for `authService` — the only caller allowed to change state.
- **Must not** assume transitions are observable at a particular rate. `_isRefreshing` bursts during rapid connectivity recovery do NOT emit; UI that tries to show a "refreshing…" indicator by subscribing to the public snapshot will not work (by design — silent refresh is silent).
