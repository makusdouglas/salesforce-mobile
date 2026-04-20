# Contract — Lock state machine, store, and `useLock` hook

**Feature**: 004-local-lock
**Status**: Authoritative — consumed by `LockGate`, `LockProvider`, the inactivity tracker, the three lock-feature screens, and the 003 integration point.
**Implementation path**: `src/features/lock/state/lockStore.ts` (singleton + emitter), `src/features/lock/state/bootstrap.ts` (boot hydration), `src/features/lock/state/inactivity.ts` (AppState subscription), `src/features/lock/hooks/useLock.ts` (React hook).

---

## The `lockStore` singleton (module-level)

```ts
// src/features/lock/state/lockStore.ts (shape, not code to paste)

type LockStatus = 'NotSet' | 'Locked' | 'Unlocked';

type LockSnapshot = {
  status: LockStatus;
};

// Public module surface.
export const lockStore: {
  getSnapshot(): LockSnapshot;                 // synchronous, cheap, returns a frozen object
  subscribe(listener: () => void): () => void; // returns unsubscribe
};

// Internal module surface — used by lockService, lockBootstrap, and inactivity only.
// Not re-exported from the auth barrel. Callers outside src/features/lock/state MUST NOT import it.
export const _internalLockStore: {
  setStatus(status: LockStatus): void;

  /** Called by bootstrap and by setInactivityTimeout. Never triggers an emission (not part of public snapshot). */
  setInactivityTimeoutMinutes(minutes: number): void;
  getInactivityTimeoutMinutes(): number;

  /** Called by the AppState inactivity tracker only. */
  setBackgroundedAt(atMs: number | null): void;
  getBackgroundedAt(): number | null;

  /** Called by lockService.verifyPin. Returns the post-increment / post-reset value. */
  incrementFailedAttempts(): number;
  resetFailedAttempts(): void;
  getFailedAttempts(): number;
};
```

**Thread-safety note**: JS is single-threaded; the store reads and writes from the main thread only. The subscriber callback list is mutated atomically inside `subscribe` / `unsubscribe` to guard against listeners unsubscribing during notification.

**Observable semantics**:

- `setStatus` emits a notification IF the new status differs from the previous one (identity check on the `LockStatus` literal).
- `setInactivityTimeoutMinutes` never emits — consumers that care about the preference (the settings UI) read it through `lockService.getInactivityTimeout()`, not through `useLock()`. The single-value hook is intentional; the preference doesn't need cross-tree reactivity.
- `setBackgroundedAt`, `incrementFailedAttempts`, `resetFailedAttempts` never emit.

**Listeners MUST NOT** synchronously trigger another state transition. In `__DEV__` builds, a guard throws a `DevError` if this happens.

---

## State machine — the authoritative table

| From       | To         | Trigger                                                                                    | Internal side effects                                                                 |
|------------|------------|--------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| (boot)     | NotSet     | `lockBootstrap()` reads no `lock.pinCredential`                                             | `backgroundedAtMs = null; failedAttempts = 0; inactivityTimeoutMinutes = <hydrated>`. |
| (boot)     | Locked     | `lockBootstrap()` reads a valid `lock.pinCredential`                                        | Same as above. LockGate renders LockScreen on next frame.                             |
| NotSet     | Unlocked   | `lockService.setupPin(pin)` resolves successfully                                           | `lock.pinCredential` is written.                                                      |
| Unlocked   | Locked     | Inactivity tracker's foreground handler computes `Date.now() - backgroundedAtMs > timeoutMs` | `backgroundedAtMs = null` AFTER the decision.                                         |
| Locked     | Unlocked   | `lockService.unlockWithBiometric()` returns `'success'`                                     | `failedAttempts` unchanged (biometric does not touch the counter).                    |
| Locked     | Unlocked   | `lockService.verifyPin(correctPin)` returns `true`                                          | `failedAttempts = 0`.                                                                 |
| Locked     | Locked     | `lockService.verifyPin(wrongPin)` returns `false`                                           | `failedAttempts++`. LockScreen reads the new value and applies the delay curve.       |
| Unlocked   | NotSet     | `authService.logout()` side-effects call `lockStorage.deletePinCredential()` and then `_internalLockStore.setStatus('NotSet')` | `failedAttempts = 0; backgroundedAtMs = null`.                                        |
| Locked     | NotSet     | `lockService.beginPinRecovery()` passes the offline-check and deletes the PIN credential    | Followed immediately by `authService.logout({ preserveEmail: true })`. RootNavigator observes session → NotAuthenticated and unmounts LockGate. |

**Transitions NOT in the table** (illegal and guarded in `__DEV__`):

- `NotSet → Locked`: there is no "you have no PIN but the app is locked" state.
- `Unlocked → NotSet` via any path other than logout/recovery.
- `Locked → Locked` via anything other than a wrong-PIN verify.

---

## Invariants

- `status === 'NotSet'` ⇔ `lock.pinCredential` absent in secure store (set by bootstrap; maintained by setupPin / deletePinCredential / recovery).
- `status === 'Locked' | 'Unlocked'` ⇔ `lock.pinCredential` present.
- `backgroundedAtMs !== null` only during a foreground-inactive window. Never persisted, never observed outside `inactivity.ts`.
- `failedAttempts >= 0`. Resets to 0 on every successful unlock, on every cold launch (implicit — module re-init), and on logout / recovery. Never persisted.
- `inactivityTimeoutMinutes` in `[1, 30]`. Updated on bootstrap (from storage) and on `setInactivityTimeout` calls.
- Public `LockSnapshot` exposes `status` only. Internal flags are invisible to `useLock()` consumers.

---

## Bootstrap contract

```ts
// src/features/lock/state/bootstrap.ts

export async function lockBootstrap(): Promise<void> {
  const [credential, preference] = await Promise.all([
    lockStorage.getPinCredential(),
    lockStorage.getInactivityPreference(),
  ]);

  // Hydrate preference; pre-persist default if absent.
  if (preference === null) {
    await lockStorage.setInactivityPreference({ minutes: 5, version: 1 });
    _internalLockStore.setInactivityTimeoutMinutes(5);
  } else {
    _internalLockStore.setInactivityTimeoutMinutes(preference.minutes);
  }

  // Decide initial status.
  if (credential === null) {
    _internalLockStore.setStatus('NotSet');
  } else {
    _internalLockStore.setStatus('Locked');
  }
}
```

**Post-condition**: exactly one `setStatus` call has happened, hydration is complete, and the AppState subscription is ready to start. `LockProvider` gates its children on a `bootstrapped` flag so no render sees an uninitialized store.

---

## Inactivity tracker contract

```ts
// src/features/lock/state/inactivity.ts

export function startInactivityListener(): () => void {
  const handler = (next: AppStateStatus) => {
    const prev = AppState.currentState;  // state before the transition
    const nowMs = Date.now();

    // active → background | inactive
    if ((prev === 'active') && (next === 'background' || next === 'inactive')) {
      _internalLockStore.setBackgroundedAt(nowMs);
      return;
    }

    // background | inactive → active
    if ((prev === 'background' || prev === 'inactive') && next === 'active') {
      const startedAt = _internalLockStore.getBackgroundedAt();
      _internalLockStore.setBackgroundedAt(null);
      if (startedAt === null) return;

      const elapsedMs = nowMs - startedAt;
      const timeoutMs = _internalLockStore.getInactivityTimeoutMinutes() * 60 * 1000;
      if (elapsedMs > timeoutMs) {
        // Only transition if we are currently Unlocked. Transitioning from NotSet or already
        // Locked is a no-op guarded inside setStatus (see state machine illegal-transitions list).
        if (lockStore.getSnapshot().status === 'Unlocked') {
          _internalLockStore.setStatus('Locked');
        }
      }
    }
  };

  const subscription = AppState.addEventListener('change', handler);
  return () => subscription.remove();
}
```

**Pure-function test target** (research R10): `isInactivityExpired({ startedAt, nowMs, timeoutMinutes })` returning `boolean`. Extract this from inside the handler for unit-testability.

---

## `useLock()` — the React hook

```ts
function useLock(): {
  status: LockStatus;
};
```

Backed by `useSyncExternalStore` with `lockStore.subscribe` + `lockStore.getSnapshot`. Concurrent-mode-safe. Returns a stable reference per emitted snapshot.

Reading `status` is for LockGate's branch decision and for the three lock-feature screens' own self-awareness (e.g., the PinSetupScreen unmounting itself once it has transitioned to Unlocked). No business feature branches on `status` — the gate is the sole consumer of "lock" as a concept from the rest of the app.

---

## `LockProvider` — lifecycle owner

```tsx
<LockProvider>
  {children}
</LockProvider>
```

`LockProvider` wires up:

- `lockBootstrap()` — runs once on mount.
- `startInactivityListener()` — subscribes to AppState and enforces the timeout.
- Teardown on unmount (normally never — provider wraps the whole app tree).

`LockProvider` does NOT inject a React Context. The hook reads from `lockStore` directly. The Provider exists only to own side effects at a well-scoped lifecycle.

---

## What consumers MUST NOT do

- **Must not** import `lockStore` from `src/features/lock/state/lockStore.ts` directly; use the barrel (`useLock()` or `<LockGate>`).
- **Must not** mutate the snapshot returned by `getSnapshot()`. It is frozen in `__DEV__` builds; treated as frozen by convention in production.
- **Must not** call `_internalLockStore.*` methods from outside `src/features/lock/state/`. Those are reserved for `lockService`, `lockBootstrap`, and `inactivity`.
- **Must not** subscribe to the store from outside React. Non-React code (the inactivity tracker, the service) reads state via `lockStore.getSnapshot()` or the `_internalLockStore` helpers directly — there are no long-lived subscriptions outside React.
- **Must not** attempt to observe `failedAttempts` via the public snapshot or `useLock()`. `LockScreen` reads it via an internal `useLockFailedAttempts()` hook that is NOT re-exported from the barrel.
