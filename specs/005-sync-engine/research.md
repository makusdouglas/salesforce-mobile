# Research: Sync Engine

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Date**: 2026-04-21

Ten research items, each resolving a concrete unknown or pinning a design decision. Entries are ordered by how load-bearing they are for the rest of the feature. No Phase-0 clarifications remain after this document.

---

## R1 — Sync transport: WatermelonDB `synchronize()` vs. custom loop

**Decision**: Use WatermelonDB's built-in `synchronize()` helper from `@nozbe/watermelondb/sync`.

**Rationale**:

- The 002 data layer was specifically provisioned for this helper. The `server_id`, `updated_at`, `_status`, and `_changed` columns on every table match what `synchronize()` expects without any adaptation. The inline comment in `src/data/schema/tables.ts` — *"`_status` and `_changed` are WatermelonDB-reserved system columns…managed end-to-end by Watermelon's sync machinery"* — is a direct hand-off to this feature.
- `synchronize()` handles transactional correctness: pull applies inside a write transaction, push happens after pull, `setLastPulledAt()` is advanced only on a successful pass. A failed pass leaves change-tracking untouched (critical for P5 / SC-005).
- The helper exposes a `conflictResolver` option precisely for cases like ours — we pass a pure LWW function and get deterministic per-row resolution for free.
- The API surface is narrow: we implement `pullChanges` (returns `{ changes, timestamp }`) and `pushChanges` (accepts `{ changes, lastPulledAt }`), plus an optional `conflictResolver`. That's it.

**Alternatives considered**:

- **Custom pull/push loop** — rejected. Would duplicate transaction wrapping, change-tracking, and cursor management. Every line we write is a line that can be wrong in the presence of network drops, crashes, or race conditions with local writes.
- **TanStack Query or similar** — rejected. These are for network-cache-on-top-of-components, not for bidirectional sync with a local transactional DB. Wrong tool for the job.

---

## R2 — Supabase transport: direct table reads vs. Edge Functions

**Decision**: Direct table reads and upserts via the existing `supabase` client for the MVP. The pull adapter issues one `supabase.from(table).select(...)` per synced table, filtered by `updated_at > lastPulledAt`. The push adapter issues one `supabase.from(table).upsert([...])` per table with changed rows.

**Rationale**:

- Supabase Row Level Security provides the authorization boundary we need (D5 / spec Assumptions) — the device can only read rows the session is authorized to see, and the server-side policy is the source of truth for the `peer orders visible to this salesperson` scope question.
- At MVP scale (1–2 salespeople, low-hundreds of rows per table), seven `SELECT ... WHERE updated_at > $1` queries plus up to four `UPSERT` calls complete well within the SC-001 (15 s for first pull) and SC-002 (30 s post-order visibility) budgets.
- An Edge Function buys server-side shaping of the payload (smaller, one round trip) but costs another deployable unit with its own auth, logging, versioning, and CI path. P3 says: simpler first.
- Migration path: if request counts or latency ever matter, the pull adapter can be swapped for a single Edge Function call returning the aggregated `{ changes, timestamp }` shape WatermelonDB expects — with zero change to the `synchronize()` call site, the conflict resolver, the status store, or the component contract. The seam is clean.

**Alternatives considered**:

- **Edge Function for pull only** — deferred (not rejected). Future optimization if the 7-query fan-out ever becomes the bottleneck. Won't be noticeable at MVP scale.
- **Supabase Realtime subscriptions** — rejected. Realtime is push-from-server, which conflicts with the spec's "three triggers only, no periodic sync" rule (FR-004). Also couples the app to a long-lived socket, which complicates offline-first semantics.

---

## R3 — Last-pulled-at cursor: where does it live?

**Decision**: Use WatermelonDB's internal `Database.getLastPulledAt()` / `setLastPulledAt()`, which `synchronize()` manages for us. No separate storage, no per-table cursor, no secure-store entry.

**Rationale**:

- WatermelonDB stores the cursor inside its own SQLite file (`salesforce.db`), co-located with the data it governs. When the salesperson logs out, WatermelonDB's DB is cleared by the data-layer's reset path — the cursor is cleared at the same time, naturally keeping it consistent with the data state.
- A single cursor across all tables is correct under last-write-wins: we pull all tables at the same `lastPulledAt` boundary in a single pass. If we used per-table cursors, we'd have to reason about partial-pass failures that advanced some cursors but not others, and about per-table race windows.
- The server-returned `timestamp` in `pullChanges` is what `synchronize()` will store; we get that from Supabase's server clock (`select now()` in a small helper call at the start of pull) so the cursor advances to a value the server is certain about, not a value derived from the device clock.

**Alternatives considered**:

- **Per-table cursors** — rejected. Adds state without benefit at MVP scale.
- **Stamp the cursor from device clock** — rejected. Would drift against server `updated_at` under clock skew and cause LWW to misbehave (R5).

---

## R4 — Soft-delete strategy: `deleted_at timestamptz` (server-authoritative)

**Decision**: Each synced table on Supabase adds a nullable `deleted_at timestamptz` column. The admin's "delete" action is `UPDATE ... SET deleted_at = now()`, not a `DELETE`. The pull adapter selects rows where `updated_at > lastPulledAt OR deleted_at > lastPulledAt`; rows with a non-null `deleted_at` are mapped into Watermelon's `deleted: []` array for that table, rows with a null `deleted_at` go into `updated: []` (or `created: []` if Watermelon doesn't know them yet). On the device, tombstoned rows are removed via Watermelon's `markAsDeleted` path.

**Rationale**:

- Admin-only deletes (D2, D3) fit this pattern cleanly: the salesperson never issues a delete; the admin marks a product or client deleted, and the change propagates on the next pull.
- Using a timestamp column (rather than a `deleted boolean`) means the pull query uses the same `> lastPulledAt` predicate shape for inserts, updates, AND deletes — one query per table, not two.
- `deleted_at` participates in LWW. If a local update has a newer `updated_at` than the server's `deleted_at`, the local update wins (conflict-resolver pick — see R5). In practice the local edit would then be pushed and the admin's delete would be re-evaluated, but for MVP the catalog is read-only and client edits are narrow, so this race is extraordinarily unlikely.

**Alternatives considered**:

- **Hard DELETE on the server** — rejected. Watermelon would have no way to see the delete on the next pull (the row is gone; there's nothing to return). Would require a separate "deletions" table or a Postgres replication log. Both add complexity.
- **`deleted boolean` flag** — rejected (see above).

---

## R5 — Conflict resolver: LWW by `updated_at`, with a deterministic tiebreaker

**Decision**: Implement `conflictResolver` as a pure function:

```text
resolveConflict(local, remote):
  if remote.updated_at > local.updated_at → return remote
  if remote.updated_at < local.updated_at → return local
  # tie — rare (ms-precision ties usually mean the same write)
  if remote.server_id < local.server_id (lexicographic) → return remote
  else → return local
```

**Rationale**:

- Constitution P2 mandates LWW by timestamp — the resolver is the single place this is enforced and tested.
- The tiebreaker handles the pathological case of two writes with identical `updated_at`. Using a lexicographic comparison of `server_id` is deterministic across devices and produces the same result regardless of which device pulled first, satisfying SC-006 (100% convergence).
- The resolver is called by `synchronize()` only when both sides have changed a record since the last pull — the common case of "server changed, local didn't" never reaches the resolver, so its behavior on the tie path is genuinely a rare-edge-case concern, not a hot path.

**Alternatives considered**:

- **Server always wins** — rejected by constitution P2 (explicit LWW by timestamp).
- **Client always wins** — rejected for the same reason.
- **Field-level three-way merge** — rejected by P3. Overkill at MVP scale; introduces semantic decisions (which field wins?) that the constitution does not authorize.

---

## R6 — Trigger wiring: subscribing to the session and exposing a public hook

**Decision**: Three trigger wirings, each with a clear boundary.

1. **Login / silent-refresh-that-queued-sync trigger** — `loginTrigger.ts` subscribes to `sessionStore` via `subscribe()` (same pattern as `useSession`). On every emission, read the snapshot; if the previous snapshot's status was not `Authenticated` and the new snapshot's status is `Authenticated`, fire a pass. This covers:
   - Fresh login (`NotAuthenticated → Authenticated`) — the canonical trigger.
   - Re-login from the `RequiresRelogin` state — resolves any `_queuedSync` flag set by the earlier auth failure.
   - Silent refresh on connectivity-return — handled implicitly because 003 sets `_queuedSync` on `setRequiresRelogin({ queueSync: true })` and clears it on a successful refresh (via `setAuthenticated({ clearQueuedSync: false })` which preserves the queued flag, then the sync pass itself clears it on success). We read the internal `_queuedSync` flag on each snapshot transition and fire a pass if it's true and the status is `Authenticated`.

2. **Pull-to-refresh trigger** — the home screen's `<ScrollView>` or `<FlatList>` `refreshControl` calls `syncService.runSync({ trigger: 'pull-to-refresh' })`. A thin wrapper in `pullToRefreshTrigger.ts` exists only to localize the call-site ergonomics (resolves after the pass ends so the refresh spinner stops).

3. **Post-order-sent trigger** — `syncService.onOrderSent()` is a public function the order-sending flow calls after `ordersRepository.markSent()` resolves. It checks connectivity; if online, it calls `runSync({ trigger: 'order-sent' })`; if offline, it returns immediately and the next natural trigger picks up the pushed order.

**Rationale**:

- The login/silent-refresh path is subtle but already wired by 003. The `_queuedSync` field on the internal session state was added by 003 (see `src/features/auth/session/session.ts`) specifically to signal "a sync needs to run once we get a valid session back". We honor that signal here — no new field, no auth-feature modification.
- The pull-to-refresh wiring returns a promise so the refresh control can spin until the pass settles. The indicator reflects `syncing`; the refresh control reflects "awaiting completion" in the gesture sense. The two overlap during a manual pull but are not redundant — the refresh control is gestural (disappears when the user lifts), the indicator is persistent.
- The explicit `onOrderSent()` hook keeps the data layer agnostic of the sync feature (R1 dependency direction). The order-sending flow is a future feature; until it is built, this trigger is inert — that's acceptable because US4 is P3.

**Alternatives considered**:

- **Auto-subscribe to `ordersRepository.observeRecentlySent()` from sync** — rejected. Data layer should not emit feature-specific events (see plan "Rejected alternatives"). Explicit call is cleaner.
- **Fire sync on every `Authenticated` snapshot** — rejected. Would cause a pass on every silent refresh even when nothing changed; wasteful and would briefly flip the indicator to `syncing` on every refresh. Gating on `_queuedSync` (or on the status transitioning *into* `Authenticated`) is the right filter.

---

## R7 — Status store + indicator component: the exact four states

**Decision**: The derivation is a pure function `deriveStatus({ inFlight, online, lastOutcome, hasQueuedChanges }) → SyncStatus` with this table:

| `inFlight` | `online` | `lastOutcome` | `hasQueuedChanges` | → `SyncStatus` |
|:-:|:-:|:-:|:-:|:-|
| true  | *  | *       | * | `syncing` |
| false | false | *    | * | `offline` |
| false | true  | `failed` | * | `failed` |
| false | true  | `ok` or `initial` | false | `in-sync` |
| false | true  | `ok` or `initial` | true | `in-sync` (with subtle pending badge, see below) |

**Rationale**:

- `in-sync` semantically means "we've successfully synced and there's nothing outstanding that blocks calling our data current". Having locally queued changes is normal during offline work; it's not an error state. We mark `in-sync` in that case — the next natural trigger will push the queued changes. The indicator shows the same `in-sync` label regardless; the internal `hasQueuedChanges` bit is tracked so the `syncing` → `in-sync` transition can check whether a pass actually flushed everything.
- `offline` takes precedence over `failed` when the device is offline — "you have no network" is more actionable feedback than "the last attempt failed". When connectivity returns, the indicator will naturally transition to `in-sync` (if a login/connectivity-return triggered a successful pass) or stay at `failed` (if no natural trigger fired yet and the previous failure outcome persists).
- `syncing` is entered the moment `runSync()` sets `_inFlight = true`; exited the moment the pass resolves. The pass duration should be short enough that this doesn't feel like a permanent state (SC-001, SC-002). The pass itself is synchronous-like: `_inFlight = true → pull → push → _inFlight = false` in one `runPass()` invocation.

**Alternatives considered**:

- **Five states (add `pending` for "has queued local changes but not actively syncing")** — rejected. Spec FR-014 says "exactly four states. No other states." Adding a visible `pending` would conflict with the UX4 discretion rule and the explicit state list.
- **Let the indicator reflect a progress percentage during `syncing`** — rejected. The pass is fast enough that a percentage is both unreliable and distracting. A static "syncing" spinner is enough.

---

## R8 — Overlap and coalesce: single-in-flight with a bounded follow-up

**Decision**: `syncService.runSync({ trigger })` is guarded by a single module-level flag `_inFlight: boolean` and a single `_followUpQueued: boolean`. On entry:

```text
runSync(trigger):
  if _inFlight:
    _followUpQueued = true
    return the in-flight promise   // callers that awaited get the current pass's outcome
  _inFlight = true
  try:
    await runPass(trigger)
    _lastOutcome = 'ok'
  catch error:
    _lastOutcome = 'failed'
    rethrow nothing to callers (triggers swallow; tests can still observe via status)
  finally:
    _inFlight = false
    if _followUpQueued:
      _followUpQueued = false
      fire runSync({ trigger: 'follow-up' }) (no await)
```

**Rationale**:

- FR-003 mandates at most one in-flight pass. A module-level flag is the simplest correct implementation in a single-threaded JS runtime — no mutex primitive is needed because we only yield at `await` points and the flag is checked synchronously at `runSync()` entry.
- FR-003 also allows one queued follow-up. The `_followUpQueued` flag captures that bounded queue. Three triggers arriving during an in-flight pass collapse to one follow-up, not three — any subsequent `runSync()` during the same in-flight window is a no-op that sets the already-true `_followUpQueued` flag again.
- The follow-up pass runs once `_inFlight` returns to false. It is fire-and-forget — triggers await the current pass only, not the follow-up. This matches the spec's "opportunistic" semantics: a rapid burst of triggers converges on being current, rather than on running every trigger-to-pass one-to-one.

**Alternatives considered**:

- **Queue every trigger** — rejected. A trigger burst during a long pass would enqueue many passes, most of which would be redundant (every pass does a full pull+push, not a per-trigger delta). One follow-up is sufficient to guarantee convergence after the burst settles.
- **Reentrant lock / promise chain** — rejected for the same reason. Adds complexity; a boolean suffices.

---

## R9 — Offline detection: reuse NetInfo, subscribe independently

**Decision**: The sync feature has its own NetInfo subscription in `netinfoBridge.ts` that writes `_online` into the `syncStatusStore`. This is a peer of the auth feature's `startConnectivityListener`, not a coupling.

**Rationale**:

- Decoupling the two subscribers keeps each feature's reasoning local. The auth listener reacts to transitions-up by triggering a silent refresh; the sync listener reacts to transitions-up by… not much directly (the login trigger will fire if the refresh succeeds and sets `_queuedSync`). Mostly the sync listener just tracks `_online` so the status-derive function can flip `offline` on and off.
- Debounce is set to the same 500 ms as the auth listener for consistency. Transient flickers (tunnel, elevator) don't flap the indicator.
- Both listeners are cheap: NetInfo's event emitter fires only on actual state changes, not continuously.

**Alternatives considered**:

- **Share a single NetInfo listener via a shared module** — rejected for the MVP. The coupling pays for itself only if we had many subscribers; we have two. Keeping them independent means each feature can be tested in isolation without a shared harness.
- **Poll `NetInfo.fetch()` before every pass** — rejected. NetInfo's subscription is event-driven; polling is strictly worse.

---

## R10 — Auth failure propagation: route through the 003 contract, do not talk to Supabase Auth directly

**Decision**: When a Supabase query during a pass returns a 401 / `PGRST301` / `JWSError`, the pull or push adapter maps it to `SyncError('AUTH_REJECTED')`, the pass catches, ends in `failed`, and calls `authService.refresh({ reason: 'requireSession' })` once. If the refresh succeeds, the pass is over (indicator settles on `failed` with the queued `_queuedSync` flag); on the next natural trigger the sync re-runs. If the refresh fails with `RELOGIN_REQUIRED`, 003's existing flow transitions the session to `RequiresRelogin` and nothing more is needed from the sync feature.

**Rationale**:

- R1 says the sync feature is the single consumer of Supabase for business data. Auth is 003's surface. Calling `supabase.auth.refreshSession()` from sync would duplicate 003's logic and create two code paths for the same concern.
- `authService.refresh()` handles the refresh-token-expired case, preserves the last email, sets `_queuedSync`, and transitions the session — all behaviors the sync feature would otherwise have to re-implement. Reusing it is a net -N lines of code for us.
- The sync pass does NOT retry after a 401 within the same pass. A single auth-rejected pass ends in `failed`, and the auth flow owns the recovery. This keeps each pass short and deterministic.

**Alternatives considered**:

- **Refresh the token mid-pass and retry** — rejected. Would turn a simple linear pass into a state machine with its own retry budget. 003 already owns refresh; let it own it. If the refresh is fast, the next trigger fires a new pass shortly after.
- **Call `supabase.auth.refreshSession()` directly from sync** — rejected per R1-adjacent principle: each feature owns its contracts.

---

## Summary

All Phase-0 unknowns are resolved. The feature builds on WatermelonDB's existing sync primitives, reuses the 002 schema sync-readiness columns, reuses the 003 session `_queuedSync` flag and connectivity source, reuses the 004 lock gate transparently, and introduces no new runtime dependencies. The single operational prerequisite — `updated_at` + `deleted_at` columns with triggers on the seven Supabase tables — is documented in `contracts/supabase-schema.md` and executed by the admin before the feature ships.
