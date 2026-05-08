# Contract — Sync Status Store Extension (`lastOkAt`)

**Files edited**:

- `src/features/sync/state/derive.ts` — add `_lastOkAt: number | null` to `InternalState`; extend `SyncStatusSnapshot` with `lastOkAt: number | null`.
- `src/features/sync/state/syncStatusStore.ts` — add `_lastOkAt: null` to `initialState()`; add `setLastOkAt(ms: number | null)` to `_internalSyncStatusStore`; stamp `Date.now()` from `setLastOutcome('ok')` before `recompute()`; include `lastOkAt` in `makeSnapshot`.
- `src/features/sync/protocol/runPass.ts` — no behavioral change needed if `setLastOutcome('ok')` is the single success signal (it is). If there are code paths that succeed without calling `setLastOutcome('ok')`, add the explicit stamp there.

## Additive contract

### Snapshot shape (after)

```ts
export type SyncStatusSnapshot = {
  readonly status: SyncStatus;
  readonly lastOkAt: number | null;
};
```

### Transitions

- `setLastOutcome('ok')`: sets `_lastOkAt = Date.now()`, then `recompute()`.
- `setLastOutcome('failed')`: does NOT touch `_lastOkAt`. Pill keeps showing the last-known-good age.
- `__resetForTests()`: sets `_lastOkAt = null`.

### Recompute rule

The cached snapshot is replaced when EITHER `status` OR `lastOkAt` changes. Today `recompute()` short-circuits on `status` equality only. Update it to short-circuit only when both are equal:

```ts
function recompute(): void {
  const next = makeSnapshot(state);
  if (
    next.status === cachedSnapshot.status &&
    next.lastOkAt === cachedSnapshot.lastOkAt
  ) {
    return;
  }
  cachedSnapshot = next;
  emit();
}
```

## Backward compatibility

- Every current consumer (`SyncStatusIndicator`, `useSyncStatus` tests) destructures `{ status }`. Adding `lastOkAt` adds a property; it does not remove or rename any existing property. TypeScript structural typing remains satisfied.
- No change to `useSyncStatus()` signature.
- No change to subscription protocol (`subscribe` / `getSnapshot`).

## Test coverage

- `syncStatusStore.lastOkAt.test.ts` (colocated under `src/features/home/tests/` because Home is the consumer that drives the requirement — the sync module has no Home-independent reason to stamp the timestamp):
  - `setLastOutcome('ok')` stamps a non-null number close to `Date.now()`.
  - `setLastOutcome('failed')` preserves the prior value.
  - `__resetForTests()` clears it.
  - The snapshot is referentially stable across emits that do not change `status` or `lastOkAt`.
  - Two rapid `setLastOutcome('ok')` calls at the same `Date.now()` produce the same snapshot (no phantom emit).

- Existing `syncStatusStore.test.ts` unchanged — its assertions on `status` continue to pass.
