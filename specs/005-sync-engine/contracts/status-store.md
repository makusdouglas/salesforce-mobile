# Contract: `syncStatusStore` *(state machine)*

Module-level singleton under `src/features/sync/state/syncStatusStore.ts`. Emits a typed snapshot to subscribers. Same reentrancy discipline as `sessionStore` and `lockStore`.

---

## Shape

```text
// Public snapshot (exposed via useSyncStatus)
type SyncStatus = 'in-sync' | 'syncing' | 'offline' | 'failed'
type SyncStatusSnapshot = { status: SyncStatus }

// Internal state (private)
type InternalState = {
  _inFlight: boolean
  _followUpQueued: boolean
  _online: boolean
  _lastOutcome: 'initial' | 'ok' | 'failed'
  _hasQueuedChanges: boolean
}
```

---

## Exports

```text
export const syncStatusStore = {
  getSnapshot(): SyncStatusSnapshot
  subscribe(listener: () => void): () => void
}

// Internal, not re-exported from the feature barrel:
export const _internalSyncStatusStore = {
  setInFlight(v: boolean): void
  setFollowUpQueued(v: boolean): void
  setOnline(v: boolean): void
  setLastOutcome(v: 'ok' | 'failed'): void
  setHasQueuedChanges(v: boolean): void
  getInternal(): InternalState
  __resetForTests(): void
}
```

The split follows `sessionStore`'s precedent: a public `store` for consumers (`subscribe` + `getSnapshot`), an `_internal*` namespace for setters that only the feature's own orchestrator calls. Tests import `_internalSyncStatusStore` directly.

---

## Derivation rule *(`derive.ts`, pure)*

```text
function deriveStatus(s: InternalState): SyncStatus {
  if (s._inFlight) return 'syncing'
  if (!s._online) return 'offline'
  if (s._lastOutcome === 'failed') return 'failed'
  return 'in-sync'
}
```

Every setter recomputes `status = deriveStatus(state)` and compares to the cached snapshot. Emission happens only when `status` actually changes. This keeps `useSyncStatus` subscribers from re-rendering on internal-only flips (e.g., `_hasQueuedChanges` going from false to true via local writes).

---

## Reentrancy guard

Same mechanism as `sessionStore`:

```text
let notifyingDepth = 0
function guardReentrancy(): void {
  if (__DEV__ && notifyingDepth > 0) {
    throw new Error('syncStatusStore: transitions must not happen inside subscriber callbacks')
  }
}
```

Every `set*` setter calls `guardReentrancy()` first. A subscriber that tries to flip state during emission throws in DEV and silently no-ops in production — fail loud where it matters.

---

## State-transition table

Rows are the current `status`; columns are the triggering event. Each cell lists the next `status` and the internal flag that changed.

|                       | `setInFlight(true)` | `setInFlight(false)` with `_lastOutcome='ok'` | `setInFlight(false)` with `_lastOutcome='failed'` | `setOnline(true)` | `setOnline(false)` |
|-----------------------|---------------------|-----------------------------------------------|---------------------------------------------------|-------------------|--------------------|
| `in-sync`             | `syncing`           | —                                             | —                                                 | —                 | `offline`          |
| `syncing`             | —                   | `in-sync` (if online) or `offline` (if not)   | `failed` (if online) or `offline` (if not)        | —                 | —                  |
| `offline`             | `syncing`           | —                                             | —                                                 | `in-sync` or `failed` (based on `_lastOutcome`) | — |
| `failed`              | `syncing`           | —                                             | —                                                 | —                 | `offline`          |

Key invariants (expressible as Jest assertions):

1. `_inFlight === true` ⟹ `status === 'syncing'` — always, no exceptions.
2. `_inFlight === false` and `_online === false` ⟹ `status === 'offline'` — always.
3. `status === 'failed'` ⟹ `_online === true` and `_inFlight === false`.
4. `status === 'in-sync'` ⟹ `_online === true` and `_inFlight === false` and `_lastOutcome !== 'failed'`.

---

## Initial state

```text
{
  _inFlight: false,
  _followUpQueued: false,
  _online: false,          // derived by netinfoBridge on first NetInfo emission; false conservative default
  _lastOutcome: 'initial',
  _hasQueuedChanges: false // derived by the pass on completion; false before any pass runs
}
```

Derived initial `status`: `offline` (because `_online` defaults to false).

Within the first ~50–200 ms after `SyncProvider` mount, `netinfoBridge` emits `_online = true` if the device is online, flipping the status to `in-sync`. This brief `offline` flash is acceptable — alternative (asking NetInfo synchronously) requires a blocking fetch that doesn't fit the reactive model.

---

## Emission semantics

- Listeners are called in insertion order (Set iteration).
- Listeners are called with no arguments; they read via `getSnapshot()`.
- A listener that throws is caught silently (the listener's bug does not break the bus). *(Same policy as `sessionStore`.)*
- `unsubscribe()` is idempotent.

---

## Test hooks

- `_internalSyncStatusStore.__resetForTests()` — zeroes everything, clears listeners. Jest `afterEach`.
- The derivation function is importable standalone (`import { deriveStatus } from '.../derive'`) and has zero dependencies on the store — making exhaustive combinatorial tests easy (`2 × 2 × 2 × 3 = 24` cases collapse to 4 classes but all combinations tested for sanity).
