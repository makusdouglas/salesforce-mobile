# Contract: Push phase *(device → Supabase)*

The **push adapter** implements the `pushChanges` callback that WatermelonDB's `synchronize()` invokes after a successful pull. It writes local changes to Supabase and resolves with no value on success; a rejection rolls back the local "synced" transition.

---

## Signature

```text
async function pushChanges(args: {
  changes: SyncDatabaseChangeSet
  lastPulledAt: number
}): Promise<void>
```

(Types match `@nozbe/watermelondb/sync`.)

---

## Behavior

The `changes` payload from Watermelon has this shape:

```text
{
  [tableName]: {
    created: Row[],   // records created locally since last sync
    updated: Row[],   // records updated locally since last sync
    deleted: string[] // Watermelon ids of records marked deleted locally
  }
}
```

For each of the four **pushable** tables — `clients`, `orders`, `order_items`, `payment_receipts` — the adapter emits:

### Inserts (records with `server_id === null`)

```text
supabase
  .from(<table>)
  .insert(payload)
  .select('id, updated_at')
  .single()
```

The response `id` is written back to the local row's `server_id` by the push adapter via a small companion helper (`applyServerAck(localId, serverId, serverUpdatedAtMs)`), which also overwrites the local `updated_at` with the server-returned value. Watermelon then marks the row `synced` on successful `pushChanges` resolution.

### Updates (records with `server_id !== null`)

```text
supabase
  .from(<table>)
  .update(payload)
  .eq('id', row.server_id)
  .select('updated_at')
  .single()
```

The server-returned `updated_at` overwrites the local one so subsequent LWW comparisons use the server's clock.

### Deletes

```text
supabase
  .from(<table>)
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', row.server_id)
```

(Soft delete. See research R4.)

Rows in `deleted[]` with `server_id === null` — never-synced locally-deleted rows — are silently dropped; there is nothing to tell the server about.

---

## Tables NOT pushed

The push adapter explicitly filters out:

- `salespeople` — reference data managed by the admin.
- `products` — catalog; D2 mandates read-only on the device.
- `product_variants` — catalog; same.

If Watermelon surfaces changes for these tables in the payload (it shouldn't — the 002 repositories disallow writes), the adapter drops them without emitting a request. This is a second line of defense aligned with constitution D2.

---

## Per-table order

Inside a single `pushChanges` call, the adapter executes table writes **in referential-integrity order** to avoid foreign-key violations on the Supabase side:

1. `clients` (parent of `orders`)
2. `orders` (parent of `order_items` and `payment_receipts`)
3. `order_items` (child of `orders`)
4. `payment_receipts` (child of `orders`)

Within each table, inserts-then-updates-then-deletes. The four tables run **sequentially**, not in parallel, to keep this ordering deterministic. At MVP scale the total wall-clock cost is dominated by network round-trips, not table-to-table sequencing.

---

## Idempotency

Once a record's Watermelon `_status` transitions to `synced`, Watermelon no longer surfaces it in `fetchLocalChanges`. That's the idempotency mechanism — the adapter never sees already-synced records. If a pass fails mid-push (e.g., after `clients` but before `orders`), the records successfully pushed in this pass are already on the server, but their **local** `_status` transition to `synced` is rolled back because Watermelon only commits the transition on a successful `pushChanges` resolution.

The next pass will re-enumerate these records, and the upserts will be issued again — safe because inserts by `server_id` correlation (`server_id` is set on first successful insert) become no-ops if the record already exists on the server with the same `server_id`, and updates are idempotent.

**Exception**: a record that was INSERTed in a failed pass (its `server_id` was written back locally before the failure) becomes an UPDATE on the next pass — safe and correct.

This is the FR-012 "idempotent push" guarantee: no data duplication across a failed-then-successful pass sequence.

---

## Error handling

| Failure | Handling |
|---------|----------|
| Network failure mid-push | Adapter throws `SyncError('NETWORK')`. Watermelon rolls back the in-progress `_status` transitions. Pass ends in `failed`. |
| Supabase 401 / JWSError | Adapter throws `SyncError('AUTH_REJECTED')`. `runPass` catches and calls `authService.refresh({ reason: 'requireSession' })`. Pass ends in `failed`. |
| Supabase RLS rejection (403 / `code: 42501`) | Adapter throws `SyncError('PUSH_REJECTED')`. Pass ends in `failed`. Local data is preserved. The failure logs the offending row (dev only) with enough info to diagnose RLS misconfiguration. This condition should not occur if RLS policies are correctly authored; it's a correctness tripwire. |
| Supabase validation (400 / check-constraint violation) | Adapter throws `SyncError('PUSH_REJECTED')`. Same treatment as RLS rejection. Logs the offending row. |
| Supabase 5xx | Adapter throws `SyncError('SERVER')`. Pass ends in `failed`. |

No retry within a single pass. The next natural trigger retries.

---

## Connectivity loss mid-push

If NetInfo flips to offline while the push is in progress, the next query rejects at the network layer. The adapter converts this to `SyncError('NETWORK')`. Watermelon rolls back local `_status` transitions. `_lastOutcome` is set to `'failed'`, but the status-derive rule flips `offline` on as soon as NetInfo registers the change (typically within a few hundred ms), so the indicator reads `offline` — not `failed` — at rest.

---

## What the push adapter does NOT do

- Does not talk to Supabase Auth. Token refresh is 003's job (research R10).
- Does not push `server_id` in the payload. The server controls its own primary keys; on insert, the server's `id` is returned and written back locally.
- Does not push the Watermelon `id` column. That's a local identifier. Correlation between Watermelon rows and Supabase rows is by `server_id`.
- Does not push Watermelon's `_status` / `_changed` columns. Those are purely local bookkeeping.
- Does not push `created_at` or `sent_at_ms` as sync-managed fields. Those are domain timestamps set by the 002 repositories and travel with the row payload like any other data column.
