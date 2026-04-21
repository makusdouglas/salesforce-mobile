# Data Model: Sync Engine

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This feature introduces **zero** new business entities. It introduces one **in-memory runtime singleton** (the sync-status store), one **server-side operational extension** to existing tables (two columns + a trigger), and **reuses** WatermelonDB's built-in sync plumbing for the cursor.

---

## 1. Server-side schema extensions *(Supabase)*

The seven business tables that sync — `salespeople`, `clients`, `products`, `product_variants`, `orders`, `order_items`, `payment_receipts` — each gain two columns and one trigger. These are **prerequisite operational changes** applied by the admin via the Supabase dashboard SQL editor, documented concretely in [contracts/supabase-schema.md](./contracts/supabase-schema.md). No app-side migration runs.

### New columns (per table)

| Column | Type | Nullable | Default | Purpose |
|--------|------|:-:|--------|---------|
| `updated_at` | `timestamptz` | No | `now()` | Authoritative last-write timestamp; used by LWW. Maintained by `BEFORE UPDATE` trigger `set_updated_at()`. |
| `deleted_at` | `timestamptz` | Yes | `NULL` | Server-authoritative soft-delete marker. A non-null value signals the row is deleted; the pull adapter emits these as Watermelon `deleted: []` entries. |

### Trigger (per table)

```text
BEFORE UPDATE ON <table>
FOR EACH ROW
EXECUTE FUNCTION set_updated_at()
```

`set_updated_at()` is a reusable function that sets `NEW.updated_at = now()`. See `contracts/supabase-schema.md` for the exact SQL.

### Row Level Security

Existing RLS policies are unaffected by the column additions. The sync engine relies on whatever RLS the admin configures — the spec's "orders from other salespeople visible to the current salesperson" is a policy concern, not an engine concern.

---

## 2. WatermelonDB sync-readiness columns *(already present)*

The 002 data layer already provisioned four columns on every synced table:

| Column | Owner | Purpose |
|--------|-------|---------|
| `server_id` | This feature | Server-side primary key after the first successful push. `null` for records created locally and not yet pushed. Indexed. |
| `updated_at` | This feature | Milliseconds-since-epoch. Mirrors the server's `updated_at` after every successful pull/push. Drives LWW. |
| `_status` | WatermelonDB | One of `created | updated | deleted | synced`. Managed by Watermelon's change-tracking and consumed by `fetchLocalChanges`. |
| `_changed` | WatermelonDB | Comma-separated list of changed columns since last sync. Managed by Watermelon. |

The sync feature **reads** these columns via Watermelon's sync helper; it does **not** write them directly. The `_touch` helpers in `src/data/repositories/_touch.ts` handle `updated_at` bumps on local writes via `applyTouchOnCreate` / `applyTouchOnUpdate` / `applyTouchOnSoftDelete`.

---

## 3. Last-pulled-at cursor *(delegated to WatermelonDB)*

| Property | Value |
|----------|-------|
| **Storage** | Inside WatermelonDB's SQLite file (`salesforce.db`) via `Database.getLastPulledAt()` / `setLastPulledAt()`. |
| **Scope** | Single cursor shared across all seven synced tables. One boundary, one pass. |
| **Initial value** | `null` — signals a first-ever pull (adapter treats this as "pull everything"). |
| **Advance rule** | Only on a successful pass. Watermelon's `synchronize()` calls `setLastPulledAt(timestamp)` only after both pull and push complete without error. Failed passes leave the cursor at its previous value; the next pass re-requests anything newer than the last successful cursor. |
| **Lifecycle** | Cleared whenever WatermelonDB is reset (e.g., a future explicit "reset local data" path). This feature does not reset it. |

---

## 4. Sync status singleton *(in-memory)*

A single module-level state, owned by `src/features/sync/state/syncStatusStore.ts`, emitting to subscribers. Same shape as `sessionStore` and `lockStore`. Lost on process kill; re-derived on next boot by the `SyncProvider`.

### Public snapshot *(exposed via `useSyncStatus()`)*

```text
type SyncStatus = 'in-sync' | 'syncing' | 'offline' | 'failed'
type SyncStatusSnapshot = { status: SyncStatus }
```

### Internal state *(not exposed)*

| Field | Type | Purpose |
|-------|------|---------|
| `_inFlight` | `boolean` | Is a pass currently running? Toggled by `syncService.runSync`. |
| `_followUpQueued` | `boolean` | Was a new trigger fired while `_inFlight` was true? Consumed once at pass end. |
| `_online` | `boolean` | Mirror of NetInfo's "connected AND internet-reachable" signal. Updated by `netinfoBridge`. |
| `_lastOutcome` | `'initial' | 'ok' | 'failed'` | Outcome of the most recent completed pass. `'initial'` before any pass has run. |
| `_hasQueuedChanges` | `boolean` | Are there any local records with `_status !== 'synced'`? Derived from Watermelon's change-tracking at status-derive time. Not authoritative mid-pass; only read when `_inFlight === false`. |

### Derivation rule *(pure, testable)*

The public `status` is derived by `deriveStatus()` from the five internal fields:

```text
if _inFlight                  → 'syncing'
else if not _online           → 'offline'
else if _lastOutcome=='failed' → 'failed'
else                          → 'in-sync'
```

`_hasQueuedChanges` is tracked for diagnostics and tests but does NOT produce a separate public state (spec FR-014 mandates exactly four).

### State transitions

```text
                 runSync() fires
initial  ───────────────────────────►  syncing
                                        │
          pass succeeds                 │ pass fails (network/server/auth)
          _lastOutcome='ok'             │ _lastOutcome='failed'
          ◄─────────────────────────────┤
          in-sync                        failed
          ▲                              ▲
          │ _online flips true           │ _online flips true
          │ (and no failure)             │ (and failure persists)
offline  ─┴──────────────────────────────┘
          ▲
          │ _online flips false (from any state except syncing)
          │ syncing keeps priority while a pass is in flight; connectivity drop
          │ mid-pass lets the pass fail naturally and the final state is offline.
```

Invariants:

- `_inFlight = true` implies status = `syncing`, unconditionally.
- `_online = false` with `_inFlight = false` implies status = `offline`, unconditionally.
- `failed` and `in-sync` are mutually exclusive, both require `_online = true` and `_inFlight = false`.
- Transitions are non-reentrant — setters guard against emitting from within a subscriber callback (same guard as `sessionStore`).

---

## 5. Sync-pass snapshot *(ephemeral, transient)*

Not persisted. Exists only for the lifetime of a single `runPass()` invocation. Carries no identity.

| Field | Type | Purpose |
|-------|------|---------|
| `trigger` | `'login' | 'pull-to-refresh' | 'order-sent' | 'follow-up'` | Why this pass fired; used for logging only. |
| `startedAtMs` | `number` | `Date.now()` at pass start; used for telemetry / debug. |
| `phase` | `'pull' | 'push' | 'done' | 'error'` | Current position within the pass; used for error-location reporting. |
| `error` | `SyncError | null` | If the pass failed, the mapped error. |

Not an entity in any persistence sense. A tuple the service passes to its internal logger and, on error, to `_lastOutcome`-setting.

---

## 6. Push-queue *(derived, not stored)*

The "push queue" is the set of Watermelon rows where `_status !== 'synced'`. WatermelonDB's built-in `fetchLocalChanges` surface returns this to `synchronize()` on demand. **It is not a separate entity** — it's a view onto the existing data. Enumerated here only because FR-020 ("local changes MUST survive app restarts") makes a persistence claim about it, and the answer is: the data is already in SQLite, and `_status` is already persisted. Nothing new to store.

---

## 7. Validation rules and invariants

1. **`server_id` is the post-push anchor**. A record with `server_id = null` has never been acknowledged by the server. Push phase treats `null` as a signal to `INSERT` on Supabase; the response provides the new `server_id`, which the push adapter writes back before Watermelon marks the record `synced`.
2. **`updated_at` always moves forward or stays equal**. The server trigger guarantees monotonic updates server-side. Local `applyTouchOnUpdate` uses `Date.now()`. A pull that overwrites a local row installs the server's `updated_at`, which is either newer than or equal to the local one by LWW; equal values are resolved by the `server_id` tiebreaker (research R5).
3. **No record with `_status === 'deleted'` is ever pushed as an UPDATE**. The push adapter distinguishes Watermelon deletions (rows with `_status === 'deleted'` plus a non-null `server_id`) from rows that were never synced (`server_id === null`, `_status === 'deleted'`). The former pushes an `UPDATE ... SET deleted_at = now()` by `server_id`; the latter is dropped without a server round-trip. *(Note: for MVP, D2/D3/D4 mean the client never initiates deletes on shared data — this path exists for correctness, not for the MVP's happy path.)*
4. **The catalog is never pushed**. Push adapter filters `products` and `product_variants` out before calling Supabase. Belt-and-suspenders on top of the 002 repositories' write restrictions.
5. **Status store transitions are atomic with respect to subscribers**. Same reentrancy guard used by `sessionStore` (`guardReentrancy()` throws in DEV when a setter is called during `emit()`).

---

## 8. Summary diagram *(dependencies)*

```text
    ┌──────────────────┐
    │  sessionStore    │  (003, read-only by sync)
    └────────┬─────────┘
             │ subscribe + read _queuedSync
             ▼
    ┌─────────────────────────┐
    │  syncService / triggers │
    └────────┬────────────────┘
             │
             ▼                                        ┌────────────────┐
    ┌──────────────────┐        synchronize()         │ WatermelonDB   │
    │  runPass()       │ ◄──────────────────────────► │ (002)          │
    └────────┬─────────┘                              │  +sync cursor  │
             │ pullChanges / pushChanges              └────────────────┘
             ▼
    ┌──────────────────┐
    │ supabase client  │ (002, reused)
    └──────────────────┘
             ▲
             │ writes/reads
             ▼
    ┌──────────────────┐
    │ Supabase tables  │ (with +updated_at, +deleted_at, +trigger)
    └──────────────────┘

    ┌──────────────────┐     observed by      ┌──────────────────┐
    │ syncStatusStore  │ ──────────────────► │ useSyncStatus()   │
    └──────────────────┘                      └──────────────────┘
                                                      ▲
                                                      │
                                              ┌───────┴───────────┐
                                              │ SyncStatusIndicator│
                                              └────────────────────┘
```

No cycles. The sync feature consumes session, lock, and data; no feature consumes sync except the home screen (indicator) and the future order-sending flow (`onOrderSent` hook).
