# Contract: Trigger wirings

Three triggers. Each has its own file under `src/features/sync/triggers/` with a tight, self-contained contract. All three are mounted by `<SyncProvider>`.

---

## T1. `loginTrigger` — post-login / silent-refresh-with-queued-sync

**File**: `src/features/sync/triggers/loginTrigger.ts`

```text
export function startLoginTrigger(): () => void  // returns unsubscribe
```

### Behavior

Subscribes to `sessionStore` via its `subscribe()` method. On every emission, reads the new public snapshot AND the internal state via `_internalSessionStore.getInternal()`.

Two transitions fire a pass:

1. **Status transition into `'Authenticated'`**. Specifically: previous snapshot's status was `'NotAuthenticated'` or `'RequiresRelogin'`, new snapshot's status is `'Authenticated'`. This captures:
   - Fresh login (`NotAuthenticated → Authenticated`).
   - Relogin after session expiry (`RequiresRelogin → Authenticated`).

2. **Silent refresh that clears a queued sync**. Specifically: status was already `'Authenticated'` in both snapshots, AND the internal `_queuedSync` flag transitioned from `true` to `false`. This happens when a connectivity-return-triggered refresh succeeds and 003 clears `_queuedSync` via `setAuthenticated({ clearQueuedSync: true })`. Our listener sees the cleared flag and fires a pass.

   *(Note: the initial login path clears `_queuedSync` too, but the first transition above already handles that case. The second rule covers the "already logged in, came back online, silent-refresh succeeded" edge case.)*

The pass is fired via `void syncService.runSync({ trigger: 'login' })` — not awaited. `syncService.runSync` never rejects, so no error handling is needed at the callsite.

### De-dupe

The trigger keeps its own `previousSnapshot: SessionSnapshot | null` in closure. Every emission compares the previous to the new. If neither of the two conditions above holds, the trigger does nothing. This prevents a pass on, e.g., `email` changing within `Authenticated`.

### Teardown

Returns an `unsubscribe` function that cancels the `sessionStore.subscribe()` subscription. Called on `SyncProvider` unmount.

### Tests

- Transition `NotAuthenticated → Authenticated` fires exactly one pass.
- Transition `Authenticated → Authenticated` with `_queuedSync` going true→false fires exactly one pass.
- Transition `Authenticated → Authenticated` with `_queuedSync` staying false does NOT fire.
- Transition `Authenticated → RequiresRelogin` does NOT fire.
- Teardown removes the listener (verifiable by counting `sessionStore`'s listener set).

---

## T2. `pullToRefreshTrigger` — home-screen gesture wrapper

**File**: `src/features/sync/triggers/pullToRefreshTrigger.ts`

```text
export async function onPullToRefresh(): Promise<void>
```

### Behavior

Thin wrapper around `syncService.runSync({ trigger: 'pull-to-refresh' })`. Awaits the returned promise so the host screen's `<RefreshControl>` can `setRefreshing(true)` before the call and `setRefreshing(false)` after it resolves.

```text
async function onPullToRefresh(): Promise<void> {
  await syncService.runSync({ trigger: 'pull-to-refresh' })
}
```

### Offline case

`syncService.runSync` returns `{ outcome: 'skipped', reason: 'offline' }` without throwing when `_online === false`. The refresh control stops spinning immediately; the indicator stays `offline`. No error surfaces to the salesperson (FR-005).

### Host wiring *(in home screen)*

```text
const [refreshing, setRefreshing] = useState(false)
const handleRefresh = async () => {
  setRefreshing(true)
  try { await onPullToRefresh() }
  finally { setRefreshing(false) }
}
// ...
<ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
```

### Tests

This trigger has no branching logic of its own — tests live on `syncService.runSync` (the `skipped:offline` path) and on the home-screen integration (manual).

---

## T3. `orderSentTrigger` — public `onOrderSent` hook

**File**: `src/features/sync/triggers/orderSentTrigger.ts`

```text
export function onOrderSent(): void
```

Re-exported from `syncService` as `syncService.onOrderSent()` for discoverability; the direct export from `triggers/` exists for testing in isolation.

### Behavior

```text
function onOrderSent(): void {
  const { _online } = _internalSyncStatusStore.getInternal()
  if (!_online) return
  void syncService.runSync({ trigger: 'order-sent' })
}
```

- Synchronous entry point (no `await`). Callers in the order-sending flow do not block.
- Reads `_online` from the sync status store, not from NetInfo directly — consistent with the status's view of online-ness (which is debounced).
- Does NOT check whether the order has actually transitioned to `sent` — that's the caller's responsibility. Naming makes this obvious.

### Intended caller *(future order-sending flow)*

```text
// Pseudocode in the future order-sending feature
await ordersRepository.markSent(orderId)
syncService.onOrderSent()
```

Until the order-sending flow is built, this trigger is inert. US4 is P3 — acceptable.

### Tests

- `onOrderSent()` while `_online === false` does NOT fire a pass (verify via `_inFlight` remaining false).
- `onOrderSent()` while `_online === true` fires exactly one pass (verify via `_inFlight` going true).
- `onOrderSent()` while a pass is already in-flight sets `_followUpQueued` (coalesce semantics — verifies the integration with `runSync`'s guard).

---

## Trigger → status transition matrix

| Event | Pre-state | Action | Post-state after pass |
|-------|-----------|--------|----------------------|
| Fresh login | `offline` (boot) | `T1` fires | `syncing` → `in-sync` (ok) or `failed` |
| Silent refresh success | `in-sync` or `failed` | `T1` fires | `syncing` → `in-sync` or `failed` |
| Pull-to-refresh online | `in-sync` or `failed` | `T2` fires | `syncing` → `in-sync` or `failed` |
| Pull-to-refresh offline | `offline` | `T2` short-circuits | `offline` (unchanged) |
| Order sent online | `in-sync` | `T3` fires | `syncing` → `in-sync` |
| Order sent offline | `offline` | `T3` short-circuits | `offline` (unchanged) |
| Trigger while `_inFlight` | `syncing` | Coalesce: `_followUpQueued = true` | After current pass settles, one follow-up pass runs |

---

## Mount / unmount

Both `T1` and the connectivity bridge (`netinfoBridge.ts`, adjacent concern) are started by `SyncProvider` on mount:

```text
// SyncProvider.tsx useEffect
const unsubLogin = startLoginTrigger()
const unsubNet = startNetinfoBridge()
return () => { unsubLogin(); unsubNet() }
```

`T2` is gesture-driven — the home screen calls `onPullToRefresh()` on refresh gesture. No provider-level mount needed.

`T3` is caller-driven — the future order-sending flow calls `syncService.onOrderSent()`. No provider-level mount needed.

This keeps the provider's responsibility narrow: it owns the listener lifecycles, nothing more.

---

## What triggers do NOT do

- **No timer-based triggers.** Spec FR-004 explicitly lists three triggers and excludes periodic sync.
- **No retry-on-failure triggers.** A failed pass settles on `failed`; the next natural trigger retries. No automatic retry loop (which would need backoff, jitter, a retry budget — all complexity P3 rejects for MVP).
- **No lock-aware gating inside the trigger code.** The lock is gated one level up: `SyncProvider` sits inside `<LockProvider>`, and the whole home subtree sits under `<LockGate>`. While locked, the home screen is not mounted, so T2 cannot fire; sessionStore transitions may still occur (silent refresh while locked is valid), so T1 can fire — but the pass itself is safe to run while the UI is locked. The lock protects the screens, not the data.
