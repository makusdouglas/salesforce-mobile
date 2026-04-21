# Contract: `syncService` + `useSyncStatus` + `SyncProvider`

Public API of the sync feature. Everything below is exported from `src/features/sync/index.ts`. Nothing else is exported.

---

## `syncService`

Module-level object (singleton). Same pattern as `authService` and `lockService`.

```text
syncService.runSync(args: { trigger: SyncTrigger }) → Promise<SyncRunResult>
syncService.onOrderSent() → void
syncService.__resetForTests() → void          // test-only
```

### `runSync({ trigger })`

Runs a single pull-then-push pass. Guarded by the single-in-flight semaphore.

- **If the device is offline** (`_online === false` in the sync status store): returns `{ outcome: 'skipped', reason: 'offline' }` synchronously. Does not set `_inFlight`.
- **If a pass is already in-flight**: marks `_followUpQueued = true` and returns `{ outcome: 'skipped', reason: 'coalesced' }`. The caller does NOT wait for the current pass's outcome — normal trigger callers don't care. Tests that want to observe the in-flight pass's outcome can call `await syncService.runSync(...)` *before* the burst and then observe the status store afterwards.
- **Otherwise**: sets `_inFlight = true`, flips status to `syncing`, calls `runPass(trigger)`, updates `_lastOutcome`, clears `_inFlight`, fires the follow-up pass if queued, resolves with `{ outcome: 'ok' }` or `{ outcome: 'failed', code }`.
- The returned promise **never rejects**. Trigger callers should not `try/catch` — the sync feature is intentionally best-effort. Test code observes outcomes through the status store.

**`SyncTrigger`**:

```text
type SyncTrigger =
  | 'login'              // fired by loginTrigger on NotAuthenticated→Authenticated or _queuedSync
  | 'pull-to-refresh'    // fired by the home-screen refresh control
  | 'order-sent'         // fired by onOrderSent when online
  | 'follow-up'          // internal; fired by the coalesce queue
```

**`SyncRunResult`**:

```text
type SyncRunResult =
  | { outcome: 'ok' }
  | { outcome: 'failed'; code: SyncErrorCode }
  | { outcome: 'skipped'; reason: 'offline' | 'coalesced' }
```

### `onOrderSent()`

Convenience entry point the order-sending flow calls after `ordersRepository.markSent()` resolves.

- If `_online === false` — returns synchronously without scheduling a pass. Indicator stays at `offline`; the locally queued `sent` order will be picked up by the next natural trigger.
- If `_online === true` — calls `runSync({ trigger: 'order-sent' })` without awaiting. Returns synchronously so the order-sending flow does not block on the sync.

### `__resetForTests()`

Wipes the module-level state back to initial (`_inFlight=false`, `_followUpQueued=false`, `_lastOutcome='initial'`, `_online=false`). Clears all listeners. Jest `afterEach` uses this.

---

## `useSyncStatus()` *(React hook)*

```text
function useSyncStatus(): { status: SyncStatus }
```

- Thin `useSyncExternalStore` wrapper over `syncStatusStore`.
- Returns **only** the public `status` field. Internal flags (`_inFlight`, `_followUpQueued`, `_online`, `_lastOutcome`, `_hasQueuedChanges`) are not exposed — they leak implementation details and change between passes within a single public `status`.
- Snapshot is a frozen object in DEV (same convention as `useSession`).

---

## `SyncProvider` *(React component)*

```text
function SyncProvider({ children }: { children: React.ReactNode }): JSX.Element
```

Lifecycle owner. Mounts these on mount:

1. `startLoginTrigger()` — subscribes to `sessionStore`; returns an unsubscribe.
2. `startNetinfoBridge()` — subscribes to NetInfo; writes `_online` into `syncStatusStore`; returns an unsubscribe.

Tears them both down on unmount.

**Does NOT** publish anything through React Context. The stores are the context — same pattern as `SessionProvider` and `LockProvider`. The provider exists to own the *lifecycle*, not to fan out values.

**Placement**: inside `<LockProvider>`, inside `<SessionProvider>`, inside `<AppProviders>`. The tree is:

```text
<SessionProvider>
  <LockProvider>
    <SyncProvider>
      {children}
    </SyncProvider>
  </LockProvider>
</SessionProvider>
```

Rationale (from plan.md "Structure Decision"): sync depends on session and lock being mounted first. Triggers read the session snapshot; no triggers should fire while the app is locked.

---

## `SyncStatusIndicator` *(React component)*

See [indicator-component.md](./indicator-component.md) for the full visual contract.

```text
function SyncStatusIndicator(props?: { style?: StyleProp<ViewStyle> }): JSX.Element
```

- Reads `useSyncStatus()` internally.
- Renders a single row (icon + one-line Portuguese label).
- Takes an optional `style` so the host screen can position it (margin, self-alignment). The component does NOT own horizontal padding.
- Tap-inert. `accessibilityRole="text"`.

---

## Non-exports *(deliberately private)*

None of the following are exported from `@/features/sync`:

- `runPass()` — internal orchestrator.
- `pullChanges` / `pushChanges` / `mappers` — Supabase adapters.
- `conflictResolver` — inner protocol.
- `syncStatusStore` (the raw store) — consumers use the hook.
- `loginTrigger` / `pullToRefreshTrigger` / `orderSentTrigger` — wiring helpers used only by `SyncProvider`.

If external code needs one of these, add a deliberate export; do not reach into the feature's subpaths.
