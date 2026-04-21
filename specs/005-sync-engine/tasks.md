# Tasks: Sync Engine

**Input**: Design documents from `/specs/005-sync-engine/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/sync-service.md](./contracts/sync-service.md), [contracts/pull-changes.md](./contracts/pull-changes.md), [contracts/push-changes.md](./contracts/push-changes.md), [contracts/conflict-resolver.md](./contracts/conflict-resolver.md), [contracts/status-store.md](./contracts/status-store.md), [contracts/indicator-component.md](./contracts/indicator-component.md), [contracts/triggers.md](./contracts/triggers.md), [contracts/supabase-schema.md](./contracts/supabase-schema.md), [quickstart.md](./quickstart.md)

**Tests**: Five unit-test files per constitution §9 and the plan's Testing section: `conflictResolver`, `derive` + `syncStatusStore`, `runPass` (coalesce + in-flight guard), `pushChanges` (idempotency + mapping), and `loginTrigger` (de-dupe). No UI tests. No integration tests. Supabase pull/push calls, SyncProvider lifecycle, and the indicator rendering are integration points verified manually against the acceptance scenarios in [spec.md](./spec.md) with a disposable dev salesperson account.

**Organization**: Tasks are grouped by user story per the spec's P1/P1/P2/P3 ordering (US1 and US2 are both MVP-critical; US2 depends on US1 being functional to show interesting states).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Relative-to-repo-root file paths

## Path Conventions

- Source layout from [plan.md Project Structure](./plan.md#project-structure): `src/features/sync/` owns everything sync-specific. Two existing files get minor extensions: `src/app/providers/AppProviders.tsx` (wrap with `<SyncProvider>`) and `src/features/home/screens/HomePlaceholderScreen.tsx` (mount indicator + `<RefreshControl>`).
- All identifiers in English (constitution §9). UI copy in Portuguese — four short strings on the indicator; everything else is background behavior with no user-facing text.
- Every create/edit cites the exact file path.
- `jest` + `ts-jest` + `jest.config.ts` at repo root are already installed (from 001/003/004). No new test tooling. `@nozbe/watermelondb` and `@supabase/supabase-js` and `@react-native-community/netinfo` are already in `package.json` — **no new runtime dependencies** in this block.

---

## Phase 0: Design (UI features only) 🎨

**N/A** — this feature adds one inline 32-pt-tall component (`<SyncStatusIndicator>`), not a screen. The plan's "Design Prerequisite" gate records this as component-only; the component contract at [contracts/indicator-component.md](./contracts/indicator-component.md) pins exact colors, icons, typography, and PT labels. No Pencil frames are produced for this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the `src/features/sync/` directory tree, land the one operational prerequisite on the Supabase side, and retrofit the 002 data layer so local Watermelon ids are the same UUIDs that Supabase will store as its `id` primary keys. No new npm packages (expo-crypto is already installed via 004).

- [X] T000 Retrofit 002 repositories to assign a client-generated UUID as the Watermelon `id` on every create. Reason: WatermelonDB's sync protocol requires `local.id === server.id`; 002's `collection.create()` auto-generates 16-char random ids that would be rejected by Supabase's `id uuid` columns. Option A from the 005 pre-implementation architecture review. Concretely:
  1. Create `src/data/ids.ts` exporting `generateId(): string` — wraps `expo-crypto.randomUUID()` (synchronous, native-module-backed). Zero new dependencies — `expo-crypto` was added in 004.
  2. Export `generateId` from `src/data/index.ts` so consumers outside the data layer (future features needing a pre-created id for FK wiring) can use the same function.
  3. In each of the five repositories with a `create` method — `salespeopleRepository.ts`, `clientsRepository.ts`, `ordersRepository.ts`, `orderItemsRepository.ts`, `paymentReceiptsRepository.ts` — assign the new id inside the `collection.create((record) => { ... })` callback as the first line: `record._raw.id = generateId();`. Leaves the rest of the create logic untouched.
  4. Products and product_variants have no `create` method (catalog is admin-only per D2) — no change.
  5. `applyTouchOnCreate` is unchanged (does not set `id`; still sets `serverId = null` and `updatedAt = Date.now()`).
  6. One-time dev-DB wipe: after this task lands, uninstall + reinstall the app on the dev device so the local SQLite file is recreated. Any pre-existing test rows have incompatible random ids and would never successfully sync. Production is not affected — the feature has not shipped.
  7. Update 002's quickstart.md with a one-line note pointing at this retrofit: *"005 prerequisite: repositories assign UUIDs at creation via `generateId()`; see 005 T000."*

  **Checkpoint for T000**: `pnpm typecheck` and `pnpm test` green. A debug `database.get('clients').create((r) => { r._raw.id = generateId(); r.name = 'x'; r.salespersonId = 'y'; })` produces a record whose `.id` is a well-formed UUID v4. No dependency has been added to `package.json`.

- [X] T001 [P] Create the directory skeleton under `src/features/sync/`: `service/`, `state/`, `supabase/`, `protocol/`, `triggers/`, `connectivity/`, `hooks/`, `components/`, `tests/`. No files yet — Phase 2 populates them.
- [ ] T002 Execute the Supabase-side schema prerequisite per [contracts/supabase-schema.md](./contracts/supabase-schema.md) against the **dev** Supabase project via the dashboard SQL editor: (a) create `public.set_updated_at()` trigger function; (b) create `public.sync_now_ms()` RPC (returns `bigint` — `select extract(epoch from now())*1000`); (c) for each of the seven tables — `salespeople`, `clients`, `products`, `product_variants`, `orders`, `order_items`, `payment_receipts` — add `updated_at timestamptz NOT NULL DEFAULT now()` and `deleted_at timestamptz NULL`, create the two indexes (`*_updated_at_idx` and the partial `*_deleted_at_idx`), and install the `BEFORE UPDATE` trigger `*_set_updated_at`. Run the three verification queries from the contract's §5 and attach the output to the PR description. *(Prod project gets the same treatment before this feature ships to production, not during task execution.)*

**Checkpoint**: `pnpm lint`, `pnpm typecheck`, `pnpm test` green on the pre-005 codebase. Supabase dev project has the two new columns + trigger on all seven tables. Verified `@nozbe/watermelondb` is ≥ 0.28 in `package.json` (the `conflictResolver` option on `synchronize()` landed in 0.27; `sendCreatedAsUpdated` predates that). Current pinned version is `^0.28.0` — no version bump required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land every piece of sync infrastructure shared across US1/US2/US3/US4 — errors, status store + derive, hook, NetInfo bridge, mappers, conflict resolver, pull/push adapters, runPass orchestrator, syncService (with coalesce/in-flight guard), a `SyncProvider` skeleton that mounts only the NetInfo bridge (triggers are added in their respective user-story phases), a conservative barrel, and five unit tests.

**⚠️ CRITICAL**: No work in Phases 3–6 may begin until all Phase 2 tasks complete.

### Core primitives

- [X] T003 [P] Create `src/features/sync/service/errors.ts` — export `class SyncError extends Error { readonly code: SyncErrorCode; constructor(code: SyncErrorCode, message?: string) }` and `type SyncErrorCode = 'NETWORK' | 'AUTH_REJECTED' | 'SERVER' | 'PUSH_REJECTED' | 'PULL_REJECTED' | 'ABORTED'`. Constructor sets `this.name = 'SyncError'`. Never carries row contents or Supabase tokens in the message; errors contain the code + a short human-readable summary for dev logs only.
- [X] T004 [P] Create `src/features/sync/state/derive.ts` — export the pure function `deriveStatus(s: InternalState): SyncStatus` per [contracts/status-store.md §Derivation rule](./contracts/status-store.md#derivation-rule-derivets-pure). Also export `type InternalState = { _inFlight: boolean; _followUpQueued: boolean; _online: boolean; _lastOutcome: 'initial' | 'ok' | 'failed'; _hasQueuedChanges: boolean }` and `type SyncStatus = 'in-sync' | 'syncing' | 'offline' | 'failed'`. No external dependencies. No React.
- [X] T005 Create `src/features/sync/state/syncStatusStore.ts` per [contracts/status-store.md](./contracts/status-store.md):
  - Private module-level `state: InternalState` initialized to `{ _inFlight: false, _followUpQueued: false, _online: false, _lastOutcome: 'initial', _hasQueuedChanges: false }`.
  - Private `listeners: Set<() => void>` and `notifyingDepth = 0`.
  - Private `cachedSnapshot: SyncStatusSnapshot` recomputed on every state change via `deriveStatus(state)`; emits ONLY when `cachedSnapshot.status` actually changes. Freeze the snapshot in `__DEV__`.
  - `guardReentrancy()` helper: throws `Error('syncStatusStore: transitions must not happen inside subscriber callbacks')` in `__DEV__` when `notifyingDepth > 0`; no-op in production.
  - Public export `syncStatusStore = { getSnapshot(): SyncStatusSnapshot; subscribe(listener): () => void }`. Subscribe returns an idempotent unsubscribe.
  - Private export `_internalSyncStatusStore = { setInFlight(v), setFollowUpQueued(v), setOnline(v), setLastOutcome(v), setHasQueuedChanges(v), getInternal(), __resetForTests() }`. Every setter calls `guardReentrancy()`, mutates `state`, then calls a single internal `recompute()` that updates `cachedSnapshot` and emits only on status change. `__resetForTests()` zeroes everything and clears listeners.
  Depends T004.
- [X] T006 [P] Create `src/features/sync/hooks/useSyncStatus.ts` — `useSyncExternalStore(syncStatusStore.subscribe, syncStatusStore.getSnapshot)` returning `{ status }` only. Matches the 003 `useSession` and 004 `useLock` style. Depends T005.

### Connectivity

- [X] T007 Create `src/features/sync/connectivity/netinfoBridge.ts` per [research.md R9](./research.md#r9--offline-detection-reuse-netinfo-subscribe-independently):
  - Import `NetInfo, { type NetInfoState }` from `@react-native-community/netinfo`.
  - Private helper `isOnline(state: NetInfoState): boolean` → `state.isConnected === true && state.isInternetReachable === true`. *(Same predicate as 003's `connectivity.ts`.)*
  - Export `function startNetinfoBridge(): () => void` that subscribes to `NetInfo.addEventListener`, debounces the online signal with a 500 ms timer (match 003), and calls `_internalSyncStatusStore.setOnline(nextValue)` only when the debounced value differs from the current `_online`. Returns an unsubscribe that clears the debounce handle and calls NetInfo's own unsubscribe.
  - Do NOT call `NetInfo.fetch()` at startup — first emission arrives shortly after subscription (~50–200 ms). The status store's initial `_online = false` is a conservative default for the brief window before the first event.
  Depends T005.

### Supabase adapters

- [X] T008 [P] Create `src/features/sync/supabase/mappers.ts` per [contracts/pull-changes.md §Column mapping](./contracts/pull-changes.md#column-mapping-snake_case--camelcase) and [contracts/push-changes.md](./contracts/push-changes.md). For each of the seven tables export two functions:
  - `map<Table>ServerRowToWMDB(row): DirtyRaw` — takes a Supabase row, returns a Watermelon-shaped raw record. Rules: rename server-side `id` to `server_id`; convert `updated_at` and `deleted_at` ISO-8601 strings to `number` (ms since epoch); drop any Postgres-internal columns not declared in [src/data/schema/tables.ts](../../src/data/schema/tables.ts); leave the remaining columns snake_case (matches 002's schema column names exactly — no case conversion needed).
  - `map<Table>WMDBRecordToServerPayload(rec): Record<string, unknown>` — builds an insert/update payload. Rules: omit `id` (local Watermelon id is not sent); omit `server_id`, `_status`, `_changed`, `updated_at` (server authoritative); omit `deleted_at` (set by the delete path, not by this mapper).
  Write one mapper pair per table — `Salespeople`, `Client`, `Product`, `ProductVariant`, `Order`, `OrderItem`, `PaymentReceipt`. Total: 14 functions. Group them in the file with a `// ---- <Entity> ----` divider. No dependencies on other sync-feature files — pure shape transformations.
- [X] T009 Create `src/features/sync/protocol/conflictResolver.ts` per [contracts/conflict-resolver.md](./contracts/conflict-resolver.md). Export `function conflictResolver(table: TableName, local: RawRecord, remote: DirtyRaw, resolved: DirtyRaw): DirtyRaw` implementing the exact LWW + tiebreaker rule from the contract:
  1. `if (remote.updated_at > local.updated_at) return remote;`
  2. `if (remote.updated_at < local.updated_at) return resolved;` (preserves local's `_changed` via Watermelon's default merge)
  3. `if (remote.server_id !== null && local.server_id !== null && remote.server_id < local.server_id) return remote;`
  4. `return resolved;`
  The function is pure (no imports beyond types). Pseudocode at the top of the file as a comment for readers. Depends T003.
- [X] T010 Create `src/features/sync/supabase/pullChanges.ts` per [contracts/pull-changes.md](./contracts/pull-changes.md):
  - Import `supabase` from `@/data`; import mappers from `./mappers`; import `SyncError` from `../service/errors`.
  - Export `async function pullChanges({ lastPulledAt }: { lastPulledAt: number | null }): Promise<SyncPullResult>` where `SyncPullResult = { changes: SyncDatabaseChangeSet; timestamp: number }` (re-export the Watermelon type from this file for callers).
  - Implementation:
    1. Fetch the server clock via the `public.sync_now_ms()` RPC installed by T002 (see [contracts/supabase-schema.md §1](./contracts/supabase-schema.md#1-reusable-trigger-function-one-time-database-level)): `const { data, error } = await supabase.rpc('sync_now_ms')`. Parse `data` as a number (ms since epoch). Map network/5xx errors to `SyncError('NETWORK'|'SERVER')`; 401 to `SyncError('AUTH_REJECTED')`.
    2. For each of the seven tables, build a query: `supabase.from(<table>).select('*').or('updated_at.gt.<iso>,deleted_at.gt.<iso>')` when `lastPulledAt !== null`; when `lastPulledAt === null`, query `supabase.from(<table>).select('*').is('deleted_at', null)` (skip tombstones on first pull — see [pull-changes.md §Behavior](./contracts/pull-changes.md#behavior)).
    3. Run all seven queries via `Promise.all`. Map any per-query error to the appropriate `SyncError` code (401 → `AUTH_REJECTED`, 5xx → `SERVER`, network → `NETWORK`, other → `PULL_REJECTED`).
    4. For each table, partition rows: `deleted_at !== null` → push its `server_id` string into `deleted[]`; else run the mapper and push the result into `updated[]`. Leave `created[]` empty (Watermelon's merge handles "insert vs. update" for us).
    5. Return `{ changes, timestamp: serverNowMs }`.
  No side effects on failure: the function only reads; Watermelon's transaction around `pullChanges` rolls back any partial merge.
  Depends T003, T008.
- [X] T011 Create `src/features/sync/supabase/pushChanges.ts` per [contracts/push-changes.md](./contracts/push-changes.md):
  - Import `supabase` from `@/data`; import mappers from `./mappers`; import `SyncError` from `../service/errors`.
  - Export `async function pushChanges({ changes, lastPulledAt }: { changes: SyncDatabaseChangeSet; lastPulledAt: number }): Promise<void>`.
  - Helpers defined in-file:
    - `async function pushTableCreates(table, rows)`: for each row build `mapWMDBRecordToServerPayload(rec)`, call `supabase.from(table).insert(payload).select('id, updated_at').single()`; on success, write back the returned `id` to `rec.server_id` and `updated_at` to `rec.updated_at` via Watermelon's `_raw` mutation within the pushChanges callback (use `database.write()` from `@/data` via a small helper; Watermelon's synchronize wraps pushChanges in a single write block — see runPass's wiring in T013).
    - `async function pushTableUpdates(table, rows)`: similar shape; `supabase.from(table).update(payload).eq('id', rec.server_id).select('updated_at').single()`.
    - `async function pushTableDeletes(table, serverIds)`: `supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', serverId)` per id; drop entries with `null` server_id silently.
  - Table order (sequential — preserves FK integrity per [contracts/push-changes.md §Per-table order](./contracts/push-changes.md#per-table-order)): `clients`, `orders`, `order_items`, `payment_receipts`. Inside each table: creates → updates → deletes. Inside each sub-phase, run per-row writes via `Promise.all`.
  - **Catalog write-guard**: explicitly return early for tables `salespeople`, `products`, `product_variants` if Watermelon ever surfaces changes for them. Log a dev warning (`console.warn('[sync] dropping unexpected change for read-only table', table)`) and drop without emitting a request.
  - Error mapping: 401 → `SyncError('AUTH_REJECTED')`; 403 / PostgREST code `42501` → `SyncError('PUSH_REJECTED')`; 400 / check-constraint violations → `SyncError('PUSH_REJECTED')`; 5xx → `SyncError('SERVER')`; network/fetch-reject → `SyncError('NETWORK')`.
  - Any thrown `SyncError` MUST propagate out of `pushChanges` so Watermelon rolls back the local `_status` transitions.
  Depends T003, T008.

### Pass orchestration + service

- [X] T012 Create `src/features/sync/protocol/runPass.ts`:
  - Import `synchronize` from `@nozbe/watermelondb/sync`; import `database` from `@/data`; import `pullChanges` from `../supabase/pullChanges`; import `pushChanges` from `../supabase/pushChanges`; import `conflictResolver` from `./conflictResolver`; import `SyncError` from `../service/errors`; import `authService` from `@/features/auth/service/authService` (for the AUTH_REJECTED handoff — research R10).
  - Export `async function runPass(trigger: SyncTrigger): Promise<SyncRunResult>` where `SyncRunResult = { outcome: 'ok' } | { outcome: 'failed'; code: SyncErrorCode }`. Never rejects; it always returns one of these shapes.
  - Implementation:
    ```ts
    try {
      await synchronize({
        database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) =>
          await pullChanges({ lastPulledAt }),
        pushChanges: async ({ changes, lastPulledAt }) =>
          await pushChanges({ changes, lastPulledAt }),
        conflictResolver,
        sendCreatedAsUpdated: true,  // we place every non-deleted row in updated[] (see pull-changes.md)
      });
      return { outcome: 'ok' };
    } catch (err) {
      if (err instanceof SyncError) {
        if (err.code === 'AUTH_REJECTED') {
          // Hand off to auth, do NOT retry in the same pass.
          void authService.refresh({ reason: 'requireSession' }).catch(() => {});
        }
        return { outcome: 'failed', code: err.code };
      }
      // Non-SyncError from deep inside Watermelon/Supabase — treat as SERVER.
      return { outcome: 'failed', code: 'SERVER' };
    }
    ```
  - Depends T009, T010, T011.
- [X] T013 Create `src/features/sync/service/syncService.ts` per [contracts/sync-service.md §syncService](./contracts/sync-service.md#syncservice):
  - Module-level closures: `let _inFlightPromise: Promise<SyncRunResult> | null = null; let _followUpQueued = false;`.
  - `async function runSync({ trigger }: { trigger: SyncTrigger }): Promise<SyncRunResult | { outcome: 'skipped'; reason: 'offline' | 'coalesced' }>`:
    1. If `!_internalSyncStatusStore.getInternal()._online`: return `{ outcome: 'skipped', reason: 'offline' }` synchronously; do NOT set `_inFlight`.
    2. If `_inFlightPromise !== null`: set `_followUpQueued = true`; return `{ outcome: 'skipped', reason: 'coalesced' }` — callers that want the current pass's outcome can `await _inFlightPromise` externally, but normal triggers do not. *(Note: the contract says `runSync` returns the in-flight promise; that's equivalent under `void` callers. Chose the explicit skipped object for clarity; document this in the file header.)*
    3. Set `_internalSyncStatusStore.setInFlight(true)`.
    4. `_inFlightPromise = runPass(trigger)`; `const result = await _inFlightPromise`.
    5. Set `_internalSyncStatusStore.setLastOutcome(result.outcome === 'ok' ? 'ok' : 'failed')`.
    6. Update `_hasQueuedChanges` by reading Watermelon's change counts — use a tiny helper `async function countPendingLocalChanges(): Promise<number>` (defined in-file) that loops over the four writable tables and calls `database.get(table).query(Q.where('_status', Q.notEq('synced'))).fetchCount()`; pass the `> 0` boolean to `setHasQueuedChanges`.
    7. `_inFlightPromise = null; _internalSyncStatusStore.setInFlight(false);`.
    8. If `_followUpQueued`: `_followUpQueued = false; void runSync({ trigger: 'follow-up' });` (fire-and-forget).
    9. Return `result`.
  - `function onOrderSent(): void`: read `_online` from `_internalSyncStatusStore.getInternal()`; if `!_online`, return; else `void runSync({ trigger: 'order-sent' });`. **Body ships complete in Phase 2**; US4 validates its wiring and the caller integration.
  - `function __resetForTests(): void`: clears `_inFlightPromise = null; _followUpQueued = false;` and calls `_internalSyncStatusStore.__resetForTests()`. Also re-asserts NO NetInfo subscription is leaked (no-op if `startNetinfoBridge` was never called in the test).
  - Public export `export const syncService = { runSync, onOrderSent, __resetForTests }`.
  Depends T005, T007, T012.

### Provider + barrel

- [X] T014 Create `src/features/sync/components/SyncProvider.tsx` SKELETON per [contracts/sync-service.md §SyncProvider](./contracts/sync-service.md#syncprovider-react-component):
  ```tsx
  export function SyncProvider({ children }: { children: React.ReactNode }): JSX.Element {
    useEffect(() => {
      const stopNet = startNetinfoBridge();
      // US1 (T021) adds: const stopLogin = startLoginTrigger();
      return () => {
        stopNet();
        // US1 (T021) adds: stopLogin();
      };
    }, []);
    return <>{children}</>;
  }
  ```
  Does NOT publish React Context. Does NOT mount `loginTrigger` yet — US1 extends this component. Depends T007.
- [X] T015 Create `src/features/sync/index.ts` — CONSERVATIVE barrel re-exporting ONLY what Phase 2 ships: `syncService`, `useSyncStatus`, `SyncProvider`, `SyncError` (value and type `SyncErrorCode`), types `SyncStatus`, `SyncTrigger`, `SyncRunResult`. Does NOT yet re-export `SyncStatusIndicator` or `onPullToRefresh` — US2 and US3 extend the barrel as those artifacts land. Document at the top: "Internal modules (`syncStatusStore`, `_internalSyncStatusStore`, `runPass`, `pullChanges`, `pushChanges`, `mappers`, `conflictResolver`, `netinfoBridge`, `loginTrigger`, `pullToRefreshTrigger`, `orderSentTrigger`) are NOT re-exported. External code consumes the public surface only."

### Unit tests (Phase 2 slice)

- [X] T016 [P] Create `src/features/sync/tests/conflictResolver.test.ts` — covers every branch from [contracts/conflict-resolver.md §Rule](./contracts/conflict-resolver.md#rule-constitution-p2--lww-by-timestamp):
  - **remote.updated_at > local.updated_at** → returned value deep-equals `remote`.
  - **remote.updated_at < local.updated_at** → returned value deep-equals `resolved` (the Watermelon default merge).
  - **Tie + remote.server_id < local.server_id (lex)** → returned value deep-equals `remote`.
  - **Tie + remote.server_id >= local.server_id** → returned value deep-equals `resolved`.
  - **Tie + both server_ids null** → falls through to returning `resolved` (unreachable in practice, but keep the test as a tripwire for the null-safety branch).
  Pure function; no mocks needed. Depends T009.
- [X] T017 [P] Create `src/features/sync/tests/syncStatusStore.test.ts` — covers [contracts/status-store.md §State-transition table](./contracts/status-store.md#state-transition-table):
  - `deriveStatus` exhaustive: 4 classes (syncing, offline, failed, in-sync) reachable via the combinations in the derivation rule. Cover all 2×2×3 = 12 cases of `(_online, _inFlight, _lastOutcome)` and assert the mapping. Include `_followUpQueued` and `_hasQueuedChanges` variants to confirm they do NOT affect public status.
  - **Invariant 1**: `setInFlight(true)` forces `status === 'syncing'` regardless of other flags.
  - **Invariant 2**: `setInFlight(false)` with `_online === false` forces `status === 'offline'`.
  - **Invariant 3**: `status === 'failed'` ⟹ `_online === true` and `_inFlight === false` and `_lastOutcome === 'failed'`.
  - **Emission**: `setInFlight(true)` emits once; `setFollowUpQueued(true)` does NOT emit (internal-only); `setHasQueuedChanges(true)` does NOT emit.
  - **Reentrancy guard in `__DEV__`**: a listener that calls `setInFlight()` synchronously throws; in production, the call silently no-ops.
  - **`__resetForTests`** clears state and listeners.
  Depends T004, T005. Use `_internalSyncStatusStore.__resetForTests()` in `afterEach`.
- [X] T018 [P] Create `src/features/sync/tests/runPass.test.ts` — covers the runSync coalesce semantics and single-in-flight guarantee from [research.md R8](./research.md#r8--overlap-and-coalesce-single-in-flight-with-a-bounded-follow-up):
  - Mock `runPass` (via `jest.mock('../protocol/runPass')`) to return a Promise that resolves on a test-controlled trigger.
  - **Single in-flight**: fire 3 `syncService.runSync({ trigger: 'login' })` calls in rapid succession while `runPass` is still pending; assert `runPass` was called exactly once and the 2nd and 3rd `runSync` calls returned `{ outcome: 'skipped', reason: 'coalesced' }`.
  - **Follow-up queued**: with `_followUpQueued` now true, resolve `runPass`; assert `runPass` is called a SECOND time automatically (the queued follow-up) with `trigger: 'follow-up'`.
  - **Bounded queue**: firing 5 more `runSync` calls during that follow-up's in-flight window results in exactly ONE further pass after it, not five.
  - **Offline skip**: with `_online === false`, `runSync` returns `{ outcome: 'skipped', reason: 'offline' }` without calling `runPass`.
  - **Failure keeps local data**: make `runPass` resolve with `{ outcome: 'failed', code: 'NETWORK' }`; assert `_lastOutcome === 'failed'` and `_inFlight === false`; assert that `_hasQueuedChanges` is updated correctly (it's read after every pass, success or failure).
  Use `_internalSyncStatusStore.__resetForTests()` + `syncService.__resetForTests()` in `afterEach`. Mock the `countPendingLocalChanges` helper by mocking `@/data`'s `database.get(...).query(...).fetchCount()` chain. Depends T013.
- [X] T019 [P] Create `src/features/sync/tests/pushChanges.test.ts` — covers [contracts/push-changes.md §Idempotency](./contracts/push-changes.md#idempotency) and the error mapping table:
  - **Mapper correctness**: given a Watermelon raw record for each of the four pushable tables, assert `map<Table>WMDBRecordToServerPayload` drops `id`, `server_id`, `_status`, `_changed`, `updated_at`, `deleted_at` and keeps all business columns.
  - **Insert path**: when a `created[]` row has `server_id === null`, `pushChanges` issues `supabase.from(<table>).insert(payload).select(...).single()` and writes the returned `id` + `updated_at` back to the local raw record.
  - **Update path**: when an `updated[]` row has `server_id !== null`, `pushChanges` issues `supabase.from(<table>).update(payload).eq('id', server_id).select(...).single()`.
  - **Delete path**: when `deleted[]` contains a server_id, `pushChanges` issues `update({ deleted_at })` not `delete()`.
  - **Null-server_id deleted row**: dropped without a request.
  - **Catalog guard**: providing changes for `products` or `product_variants` issues NO requests and logs a dev warning.
  - **Error mapping**: mock the client's response to return 401 → adapter throws `SyncError('AUTH_REJECTED')`; 403 → `SyncError('PUSH_REJECTED')`; 5xx → `SyncError('SERVER')`; network reject → `SyncError('NETWORK')`.
  Mock `supabase` via `jest.mock('@/data', () => ({ supabase: <mocked client> }))`. Depends T008, T011.

**Checkpoint**: `pnpm typecheck` + `pnpm test` green (old + four new). `pnpm lint` green. `src/features/sync/` compiles. The barrel exports the conservative surface. The dev client builds but the app behaves exactly like post-004 — the provider is not yet in the tree, no trigger is wired, no indicator is mounted. This is by design: US1 is what makes sync fire; US2 is what makes it visible.

---

## Phase 3: User Story 1 — First sync on login (Priority: P1) 🎯 MVP

**Goal**: After `NotAuthenticated → Authenticated` (or a silent refresh that clears `_queuedSync`), a pull-then-push pass runs against Supabase, all seven tables converge to the server's view (with LWW conflicts correctly resolved), and local changes are acknowledged on the server. No business screen blocks.

**Independent Test**: Fresh install + fresh dev Supabase salesperson account. Seed the Supabase project with 5 products, 2 clients, and 1 order authored by another salesperson (RLS-visible to the test account). Log in while online → `sessionStore` transitions to `Authenticated` → `loginTrigger` fires a pass → the Watermelon DB ends up with 5 products, 2 clients, and 1 order (verifiable via a debug screen or a `dbInspect` call at a REPL). Create one local client + one local draft order via the existing 002 repositories before login in a separate test (simulate with a direct `database.write` from a debug hook) → after login, the local client + draft order land in Supabase with a server-stamped `id` + `updated_at`.

### Implementation for User Story 1

- [X] T020 [US1] Create `src/features/sync/triggers/loginTrigger.ts` per [contracts/triggers.md §T1](./contracts/triggers.md#t1-logintrigger--post-login--silent-refresh-with-queued-sync):
  - `src/features/auth/index.ts` intentionally does NOT re-export `sessionStore` or `_internalSessionStore` (verified 2026-04-21 — the 003 barrel header explicitly forbids it). Import them via direct path: `import { sessionStore, _internalSessionStore, type SessionSnapshot } from '@/features/auth/session/session';`. Add a one-line comment at the top of the file: *"Reads the 003 internal `_queuedSync` flag — see [contracts/triggers.md §T1](...). This direct-path import is the only exception; 003's public barrel is used for every other auth concern."*
  - Export `function startLoginTrigger(): () => void`. Implementation:
    ```ts
    let previous: SessionSnapshot | null = null;
    let previousQueuedSync = false;
    const unsubscribe = sessionStore.subscribe(() => {
      const snapshot = sessionStore.getSnapshot();
      const internal = _internalSessionStore.getInternal();
      const transitionedIntoAuthenticated =
        snapshot.status === 'Authenticated' &&
        (previous === null || previous.status !== 'Authenticated');
      const queuedSyncCleared =
        snapshot.status === 'Authenticated' &&
        previous?.status === 'Authenticated' &&
        previousQueuedSync === true &&
        internal._queuedSync === false;
      previous = snapshot;
      previousQueuedSync = internal._queuedSync;
      if (transitionedIntoAuthenticated || queuedSyncCleared) {
        void syncService.runSync({ trigger: 'login' });
      }
    });
    return unsubscribe;
    ```
  - Do NOT widen the 003 barrel just for this read.
  - Depends T013.
- [X] T021 [US1] Edit `src/features/sync/components/SyncProvider.tsx` — extend the Phase-2 skeleton to also mount `loginTrigger`:
  ```tsx
  useEffect(() => {
    const stopNet = startNetinfoBridge();
    const stopLogin = startLoginTrigger();
    return () => { stopNet(); stopLogin(); };
  }, []);
  ```
  Depends T020.
- [X] T022 [US1] Edit `src/app/providers/AppProviders.tsx` — wrap `<LockProvider>`'s children with `<SyncProvider>`. Final shape:
  ```tsx
  export function AppProviders({ children }) {
    return (
      <SessionProvider>
        <LockProvider>
          <SyncProvider>
            <SafeAreaProvider>{children}</SafeAreaProvider>
          </SyncProvider>
        </LockProvider>
      </SessionProvider>
    );
  }
  ```
  Sync goes INSIDE Lock because triggers should not fire while the app is locked (see plan "Structure Decision"). `<SafeAreaProvider>` stays innermost. Depends T021.
- [X] T023 [P] [US1] Create `src/features/sync/tests/loginTrigger.test.ts` — covers [contracts/triggers.md §T1 Tests](./contracts/triggers.md#tests):
  - Transition `NotAuthenticated → Authenticated` fires `syncService.runSync` exactly once (mock `syncService.runSync`).
  - Transition `Authenticated → Authenticated` with `_queuedSync` going true→false fires exactly once.
  - Transition `Authenticated → Authenticated` with `_queuedSync` staying false does NOT fire.
  - Transition `Authenticated → RequiresRelogin` does NOT fire.
  - Returned unsubscribe stops further emissions (verify by spying the session store's listener count via `sessionStore.__getListenerCount()` if available, or by emitting after unsubscribe and asserting `runSync` wasn't called again).
  Depends T020.

**Checkpoint**: MVP slice ready.
- Fresh install → login → Watermelon is populated from Supabase within SC-001's 15-second budget on a 10 Mbps link for a 500-product seed.
- Local draft records pre-login land in Supabase post-login with server-stamped ids.
- Re-login after a forced session invalidation fires a second pass.
- Silent refresh on connectivity-return that clears `_queuedSync` fires a pass (verifiable by bringing the device online, waiting, and observing the admin dashboard).
- Sync failures (e.g., kill the network mid-pass) end in `_lastOutcome: 'failed'` without discarding local data. The UI does not yet reflect this — US2 adds the indicator.

---

## Phase 4: User Story 2 — Always-on sync status indicator (Priority: P1)

**Goal**: Wherever the home screen is visible, a 32-pt-tall inline row shows one of four states — `in-sync`, `syncing`, `offline`, `failed` — with a Portuguese label and a subtle icon. No modal; no blocking spinner; no coverage of business content. Updates within 1 s of any state change (SC-003).

**Independent Test**: With the app logged in on a dev device and US1 already complete, mount the indicator in the home placeholder. Verify each of the four states appears within 1 s of the triggering event: (a) toggle airplane mode on → `Sem internet`; (b) toggle airplane mode off → `Dados em dia` (after the natural login-sync-queued trigger fires); (c) force a push rejection by temporarily revoking RLS on `orders` → `Falha ao sincronizar`; (d) pull-to-refresh (US3 adds the gesture; verify with a direct `syncService.runSync` call from a REPL / debug button for US2) → `Sincronizando…` → `Dados em dia`.

### Implementation for User Story 2

- [X] T024 [US2] Create `src/features/sync/components/SyncStatusIndicator.tsx` per [contracts/indicator-component.md](./contracts/indicator-component.md):
  - Imports: `useSyncStatus` from `../hooks/useSyncStatus`; `View, Text, ActivityIndicator, StyleSheet` from `react-native`; design tokens from `@/features/auth/theme/tokens` (same one-line cross-feature token import comment that 004 established); icons from `lucide-react-native` (already a transitive dep via 003 — verify in `package.json`; if absent, fall back to Unicode glyphs and log a follow-up — but it is present per 003's assumptions).
  - Props: `{ style?: StyleProp<ViewStyle> }`. No `size`, no `onPress`, no `details`.
  - `const { status } = useSyncStatus();`
  - Four-way switch on `status`:
    - `in-sync`: `<Check />` in `colors.successForeground`, label `Dados em dia` in `colors.textSecondary`.
    - `syncing`: `<ActivityIndicator size="small" />` in `colors.textSecondary`, label `Sincronizando…` in `colors.textSecondary`.
    - `offline`: `<CloudOff />` in `colors.textTertiary`, label `Sem internet` in `colors.textTertiary`.
    - `failed`: `<AlertTriangle />` in `colors.warningForeground`, label `Falha ao sincronizar` in `colors.warningForeground`.
  - Container: `<View style={[{ flexDirection: 'row', alignItems: 'center', height: 32, columnGap: 4 }, style]} accessibilityRole="text" accessibilityLabel={<same label as visible>}>`.
  - No horizontal margin — the host sets it via `style`.
  - Responsive note (inline comment): component renders identically on phone and tablet; dimensions are intrinsic to icon + text, not breakpoint-dependent.
  Depends T005, T006.
- [X] T025 [US2] Edit `src/features/sync/index.ts` barrel — add `export { SyncStatusIndicator } from './components/SyncStatusIndicator';`. Depends T024.
- [X] T026 [US2] Edit `src/features/home/screens/HomePlaceholderScreen.tsx` — mount the indicator in a header row above the existing placeholder content. Minimum delta:
  ```tsx
  import { SyncStatusIndicator } from '@/features/sync';
  // ...
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 }}>
    <Text style={{ flex: 1, fontSize: 20, fontWeight: '600' }}>Home</Text>
    <SyncStatusIndicator />
  </View>
  ```
  Place this row above anything already in the placeholder; do not modify existing content (the minute-selector, the "Sair" button, or the 004 T031 inactivity UI) beyond adding the header row above them. Depends T025.

**Checkpoint**: US2 complete.
- After login → `Sincronizando…` briefly → `Dados em dia`.
- Airplane mode on → `Sem internet` within 1 s (SC-003).
- Airplane mode off → indicator flips to whatever the previous `_lastOutcome` yields (`Dados em dia` or `Falha ao sincronizar`); a natural trigger (silent refresh completing) transitions to `Sincronizando…` briefly.
- No business screen shows a blocking spinner during any pass (SC-004 verifiable by navigating between the home placeholder and whatever other screens exist during a slow pass — the indicator is the only visible sync signal anywhere).

---

## Phase 5: User Story 3 — Manual pull-to-refresh from the home screen (Priority: P2)

**Goal**: A pull-down gesture on the home screen fires a full pull-then-push pass and the refresh control releases as soon as the pass settles. Offline pull-to-refresh is a no-op (FR-005).

**Independent Test**: With `in-sync` visible on the home screen, modify one of the 5 seeded Supabase products (change a name). Pull down on the home screen. The indicator transitions `Sincronizando…` → `Dados em dia` and the modified product's new name is observable via whatever catalog view exists (for MVP, a debug inspector query from a REPL, since the catalog UI is a future feature). Offline: airplane mode on, pull down → refresh control stops immediately, indicator stays at `Sem internet`, no error dialog.

### Implementation for User Story 3

- [ ] T027 [US3] Create `src/features/sync/triggers/pullToRefreshTrigger.ts` per [contracts/triggers.md §T2](./contracts/triggers.md#t2-pulltorefreshtrigger--home-screen-gesture-wrapper):
  ```ts
  import { syncService } from '../service/syncService';
  export async function onPullToRefresh(): Promise<void> {
    await syncService.runSync({ trigger: 'pull-to-refresh' });
  }
  ```
  No branching; the offline short-circuit lives inside `runSync`. Depends T013.
- [ ] T028 [US3] Edit `src/features/sync/index.ts` barrel — add `export { onPullToRefresh } from './triggers/pullToRefreshTrigger';`. Depends T027.
- [ ] T029 [US3] Edit `src/features/home/screens/HomePlaceholderScreen.tsx` — wrap the body (below the header row added in T026) in a `<ScrollView refreshControl={...}>` and wire `onPullToRefresh`:
  ```tsx
  import { onPullToRefresh } from '@/features/sync';
  import { RefreshControl, ScrollView } from 'react-native';
  // ...
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await onPullToRefresh(); }
    finally { setRefreshing(false); }
  }, []);
  // ...
  <ScrollView
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    contentContainerStyle={{ flexGrow: 1 }}
  >
    {/* existing placeholder body: minute selector, Sair button, etc. */}
  </ScrollView>
  ```
  The header row added in T026 stays OUTSIDE the `<ScrollView>` so the gesture is scoped to the body, not to the indicator row (prevents a pull-to-refresh on the indicator itself from feeling awkward). Depends T028.

**Checkpoint**: US3 complete. Pull-to-refresh on the home screen triggers a full pass; offline pull-to-refresh is a no-op with no error feedback. `Falha ao sincronizar` can be recovered from via pull-to-refresh — a second pass that succeeds transitions `failed → in-sync`.

---

## Phase 6: User Story 4 — Opportunistic sync after order sent (Priority: P3)

**Goal**: When an order transitions to `sent` AND the device has connectivity, a background pass fires and the new order appears in the admin dashboard within 30 s (SC-002). If offline, the order stays locally queued; the engine does not attempt a pass.

**Independent Test**: Online. Create a draft order via `ordersRepository.create` + `markSent` from a REPL (the order-sending flow is a future feature; simulate the callsite for MVP). Immediately call `syncService.onOrderSent()`. Within 30 s the order is visible in the admin dashboard's `orders` table with the same `server_id` as `order.server_id`. Offline: same sequence with airplane mode on. The order stays locally queued. Turn airplane mode off and perform pull-to-refresh → the order lands in the admin dashboard within 30 s (US3 picks it up; this verifies US4's offline path is a genuine no-op rather than a silent failure).

### Implementation for User Story 4

- [ ] T030 [US4] Create `src/features/sync/triggers/orderSentTrigger.ts` — thin re-export of `syncService.onOrderSent` for test isolation and call-site discoverability. Even though `syncService.onOrderSent` was implemented in Phase 2 (T013), this file exists as the documented entry point the future order-sending feature imports:
  ```ts
  import { syncService } from '../service/syncService';
  export function onOrderSent(): void {
    syncService.onOrderSent();
  }
  ```
  This indirection is deliberate: it lets future callers `import { onOrderSent } from '@/features/sync'` without reaching into the service singleton, matching the convenience-import style used for `onPullToRefresh`. Depends T013.
- [ ] T031 [US4] Edit `src/features/sync/index.ts` barrel — add `export { onOrderSent } from './triggers/orderSentTrigger';`. The barrel now exports: `syncService, useSyncStatus, SyncProvider, SyncStatusIndicator, onPullToRefresh, onOrderSent, SyncError, SyncErrorCode (type), SyncStatus (type), SyncTrigger (type), SyncRunResult (type)`. Depends T030.
- [ ] T032 [P] [US4] Add a short JSDoc block at the top of `src/features/sync/triggers/orderSentTrigger.ts` describing the integration contract for the future order-sending feature. Wording derived from [quickstart.md §(b)](./quickstart.md#b-order-sending-flow-integration-future-feature): "Call immediately after `ordersRepository.markSent(orderId)` resolves. Fire-and-forget. No-op when offline. Do NOT await." **Do NOT modify `src/data/repositories/ordersRepository.ts`** — the trigger is called at the callsite of `markSent()`, not from inside the repo (preserves the data-layer-does-not-know-features rule). **Do NOT create a NOTES.md or any new documentation file** (root CLAUDE.md policy forbids unrequested *.md creation).

**Checkpoint**: US4 complete. `onOrderSent` is callable from any future feature without reaching into the service. Offline order-sent flows are no-ops; online flows trigger a pass. At this point the full four-trigger set — login, pull-to-refresh, order-sent, follow-up (internal coalesce) — is wired.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final checks before the feature ships.

- [ ] T033 [P] Run `pnpm typecheck` and `pnpm lint` — both green. Fix any warnings introduced by the new feature; do not widen `tsconfig` strictness carve-outs.
- [ ] T034 [P] Run `pnpm test` — all five new test files green (`conflictResolver`, `syncStatusStore`, `runPass`, `pushChanges`, `loginTrigger`). The full test suite (including 001–004's existing tests) stays green.
- [ ] T035 Re-run the Supabase schema verification queries from [contracts/supabase-schema.md §5](./contracts/supabase-schema.md#5-verification-checklist-for-the-admin) against the dev project to confirm all seven tables have both new columns and the trigger. Attach the output to the PR description.
- [ ] T036 Manually walk through [quickstart.md §(a) Verification](./quickstart.md#verification) on both a phone simulator (390×844) and a tablet simulator (820×1180). For each viewport, confirm each of the four indicator states appears correctly and the pull-to-refresh gesture works. This is the UX5 tablet compliance check for the component's placement in its host (the indicator itself is layout-neutral; the check validates the host renders it correctly on both form factors).
- [ ] T037 [P] Write a short "Integration guide for the order-sending flow" section in [quickstart.md](./quickstart.md) if not already covered — should match §(b) already present there. If it already matches, this task is a review-only pass: confirm the future order-sending feature will find a clear entry point. (Expected outcome: nothing to change; the Phase-1 quickstart.md already covers it.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Design)**: Skipped — component-only feature; no Pencil frames.
- **Phase 1 (Setup)**: Can start immediately. T001 and T002 are independent.
- **Phase 2 (Foundational)**: Depends on Phase 1. BLOCKS all user stories.
- **Phase 3 (US1)**: Depends on Phase 2. Unlocks the engine.
- **Phase 4 (US2)**: Depends on Phase 2 for the store/hook + Phase 3 for interesting states to display (US1 provides the syncing/in-sync transitions). Technically US2's code can be written on top of Phase 2 alone (the indicator would show `offline` until a trigger fires), but the verification steps require US1.
- **Phase 5 (US3)**: Depends on Phase 2. Independent of US1/US2 in code, but the verification steps assume US2's indicator is mounted.
- **Phase 6 (US4)**: Depends on Phase 2 (T013 already implements `onOrderSent` internally). Trivial wiring + docs.
- **Phase 7 (Polish)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2. The MVP core.
- **US2 (P1)**: Depends on Phase 2. Independent code; verification easier after US1.
- **US3 (P2)**: Depends on Phase 2. Independent code; verification easier after US1 + US2.
- **US4 (P3)**: Depends on Phase 2. Independent code; verification easier after US1.

### Within Each User Story

- All [P]-marked tasks within a phase can run in parallel.
- Setup/foundational tasks have sequential dependencies encoded in the "Depends T0XX" notes on each task.
- Tests live in their own files; [P] applies — they can run in parallel with other tests and with non-blocking implementation tasks.

### Parallel Opportunities

- **Phase 1**: T001 || T002.
- **Phase 2 primitives** (early): T003 [P], T004 [P], T006 [P], T008 [P], T016 [P], T017 [P], T019 [P].
- **Phase 2 core** (mid, after primitives land): T005, T007, T009, T010, T011 mostly sequential because of shared imports; the tests (T016, T017, T018, T019) are all [P] once their dependencies land.
- **US1**: T020 + T023 can land as a pair (test-drive the trigger); T021 + T022 are sequential integration edits.
- **US2**: T024 → T025 → T026 sequential.
- **US3**: T027 → T028 → T029 sequential.
- **US4**: T030 → T031 sequential; T032 [P] docs.
- **Polish**: T033 + T034 + T037 all [P].

---

## Parallel Example: Phase 2 Foundational

```bash
# Early-phase parallelism — independent files, no dependencies:
Task: "Create SyncError in src/features/sync/service/errors.ts"
Task: "Create deriveStatus + types in src/features/sync/state/derive.ts"
Task: "Create useSyncStatus hook in src/features/sync/hooks/useSyncStatus.ts"
Task: "Create mappers in src/features/sync/supabase/mappers.ts"

# Mid-phase parallelism (after derive + syncStatusStore land):
Task: "Create netinfoBridge in src/features/sync/connectivity/netinfoBridge.ts"
Task: "Create conflictResolver in src/features/sync/protocol/conflictResolver.ts"

# Test parallelism (after their deps land):
Task: "Conflict resolver tests in src/features/sync/tests/conflictResolver.test.ts"
Task: "Status store tests in src/features/sync/tests/syncStatusStore.test.ts"
Task: "pushChanges tests in src/features/sync/tests/pushChanges.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Phase 1: Setup — scaffold folders + Supabase schema prerequisite.
2. Phase 2: Foundational — the heavy lifting. Every primitive shared across user stories. Land with all five unit tests green.
3. Phase 3: US1 — engine goes live. Verify on dev simulator: login → pass → local DB populated.
4. Phase 4: US2 — indicator goes live on the home placeholder. Verify four states on both phone and tablet simulators.
5. Phase 5: US3 — pull-to-refresh gesture goes live. Verify online + offline paths.
6. **STOP and VALIDATE**: Demo the MVP slice to a stakeholder. The P1 + P2 slice is deployable.

### Incremental Delivery

1. MVP slice (Phases 1–5) → deploy/demo.
2. Add US4 (Phase 6) → the public `onOrderSent` hook is callable from the future order-sending feature. US4 ships inert until that feature lands; that's acceptable for P3.
3. Phase 7: Polish — final lint/typecheck/test sweep + manual verification.

### Solo Execution Strategy

Given this is a solo project (constitution §P3):

1. Phase 1 in one sitting.
2. Phase 2 primitives in one sitting (~6 hours): errors + derive + hook + mappers + conflict resolver + connectivity bridge + two of the tests.
3. Phase 2 core in another sitting (~6 hours): syncStatusStore + pullChanges + pushChanges + runPass + syncService + SyncProvider skeleton + barrel + remaining three tests.
4. US1 in one sitting (~3 hours): loginTrigger + SyncProvider extension + AppProviders edit + the loginTrigger test. Validate against the dev Supabase project.
5. US2 in one sitting (~2 hours): indicator + barrel + home screen header row. Validate all four states.
6. US3 in half a sitting (~1 hour): pullToRefreshTrigger + home screen RefreshControl.
7. US4 in half a sitting (~30 min): orderSentTrigger re-export + barrel + docs.
8. Polish + PR.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps each US-phase task to the spec's user-story priority.
- Each user story should be independently completable and testable via the Independent Test blurb.
- Tests MUST be green before a task is considered complete; `_internalSyncStatusStore.__resetForTests()` + `syncService.__resetForTests()` are the test-isolation primitives.
- Commit after each task or tight logical group; tasks are sized for one commit.
- Stop at any checkpoint to validate the story independently before proceeding.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence, reaching into non-barrel paths of 001/002/003/004 (the `_internalSessionStore` read in T020 is the sole exception, with a documented comment).
