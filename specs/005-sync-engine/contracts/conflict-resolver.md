# Contract: Conflict resolver *(LWW by `updated_at`, deterministic tiebreaker)*

A pure function wired as WatermelonDB's `synchronize({ conflictResolver })` hook. Called by Watermelon during the pull merge whenever an incoming server record and a locally pending change touch the same Watermelon `id`.

---

## Signature

```text
function conflictResolver(
  table: TableName,
  local: RawRecord,         // the local row with pending changes
  remote: DirtyRaw,         // the incoming server row
  resolved: DirtyRaw        // Watermelon's tentative merge (remote ∪ local where local._changed)
): DirtyRaw
```

Returns the raw record that Watermelon should persist locally. No side effects.

---

## Rule *(constitution P2 — LWW by timestamp)*

```text
if remote.updated_at > local.updated_at
  → keep REMOTE (server won)
elif remote.updated_at < local.updated_at
  → keep LOCAL (device won; push will carry it forward)
else  // remote.updated_at === local.updated_at (rare, ms-precision tie)
  if remote.server_id < local.server_id   // lexicographic string compare
    → keep REMOTE
  else
    → keep LOCAL
```

Returned shape:

- **REMOTE wins**: return `remote` (equivalent to `{ ...remote }`). Watermelon applies the server row wholesale; local pending changes for this row are discarded. The row's local `_status` goes from `'updated'` back to `'synced'` after the merge.
- **LOCAL wins**: return `resolved` (Watermelon's default — server row with local's changed fields overlaid). Effectively a no-op for the resolver, but we go through the function to guarantee every conflict is explicitly decided by our rule, not by silent defaulting.

---

## Why the tiebreaker

Exact `updated_at` ties are rare at millisecond precision, but they happen: two devices syncing within the same millisecond window, or test fixtures that seed rows with identical timestamps. The `server_id` lexicographic comparison is:

- **Deterministic** — both devices see the same `server_id` values, so both pick the same winner regardless of which pulled first. This is what SC-006 tests.
- **Stable** — `server_id` doesn't change after the first successful push (it's the server's permanent primary key for that row).
- **Arbitrary-but-fine** — the tie case means the writes are semantically identical in timestamp; picking either is acceptable. We pick deterministically so tests don't flake.

A `null`-vs-non-null `server_id` tie cannot happen in practice: one side having `server_id === null` means that side has never synced, which means the other side's `updated_at` will be strictly newer (it was already on the server), so the primary rule resolves without reaching the tiebreaker.

---

## What this contract does NOT decide

- **Deletes** (rows with `deleted_at !== null`) are handled by the pull adapter mapping them into Watermelon's `deleted[]` array, not by the resolver. The resolver is only consulted when both sides have a non-deleted version of a record.
- **Schema-level conflicts** (different columns added or dropped) are out of scope. The 002 schema and the Supabase schema must stay in step; drift is a migration problem, not a resolver problem.
- **Cross-row invariants** (e.g., "an order's total must match the sum of its items") are application-level concerns, not sync-level. LWW operates per-row; it is up to the 002 repositories' invariants to hold post-merge. For the MVP, no such cross-row invariant currently depends on a single pass's atomicity — but a future feature that introduces one will need to revisit this contract.

---

## Testability

Three tests cover the contract exhaustively:

1. **`remote.updated_at > local.updated_at` → remote wins**. Assert returned value deep-equals `remote`.
2. **`remote.updated_at < local.updated_at` → local wins**. Assert returned value deep-equals `resolved` (Watermelon's default merge with local's `_changed` fields preserved).
3. **Tie with `remote.server_id < local.server_id` → remote wins**. Assert returned value deep-equals `remote`.
4. **Tie with `remote.server_id >= local.server_id` → local wins**. Assert returned value deep-equals `resolved`.

Pure function; no Watermelon database, no Supabase, no async. Tests live in `src/features/sync/tests/conflictResolver.test.ts`.
