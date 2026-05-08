# Contract: Pull phase *(Supabase → device)*

The **pull adapter** implements the `pullChanges` callback that WatermelonDB's `synchronize()` invokes at the start of every pass. It reads from Supabase and returns the server's view of "everything that changed since `lastPulledAt`" in the exact shape Watermelon expects.

---

## Signature

```text
async function pullChanges(args: {
  lastPulledAt: number | null
  schemaVersion: number
  migration: MigrationSyncChanges | null
}): Promise<SyncPullResult>

type SyncPullResult = {
  changes: SyncDatabaseChangeSet   // { [tableName]: { created, updated, deleted } }
  timestamp: number                // server clock in ms; Watermelon stores this as the new lastPulledAt
}
```

(Types match `@nozbe/watermelondb/sync`.)

---

## Behavior

For each of the seven synced tables — `salespeople`, `clients`, `products`, `product_variants`, `orders`, `order_items`, `payment_receipts` — the pull adapter issues:

```text
SELECT *
FROM <table>
WHERE updated_at > to_timestamp($lastPulledAt / 1000)
   OR deleted_at > to_timestamp($lastPulledAt / 1000)
```

(When `lastPulledAt === null`, the filter becomes `WHERE deleted_at IS NULL` — skip all soft-deleted rows on the first-ever pull, since the local DB doesn't know them and doesn't need to be told they exist.)

Each returned row is routed by its `deleted_at`:

- `deleted_at IS NULL` and local row does not exist → `created[]`
- `deleted_at IS NULL` and local row already exists → `updated[]`
- `deleted_at IS NOT NULL` → `deleted[]` (as server_id strings)

The "already exists" check is answered by WatermelonDB during the merge phase — the adapter returns **all** non-deleted rows as `updated[]` (safe), and Watermelon's sync machinery + the conflict resolver handle the "insert vs. update" distinction. Following Watermelon's docs, all non-deleted rows going into `updated[]` is the recommended shape when the server doesn't track which rows are "new to a given client".

The `timestamp` returned is the server-side `NOW()` captured at the start of the pull via the `public.sync_now_ms()` RPC (installed by [supabase-schema.md §1a](./supabase-schema.md#1a-server-clock-rpc)), run before the table queries. This guarantees monotonic cursor advance even with clock skew.

---

## Filtering scope *(who sees what)*

The pull adapter does **not** implement scope filtering. Supabase RLS policies, maintained by the admin, decide which rows each salesperson can read. The adapter issues the same query shape for every salesperson and relies on the server to return only what they're authorized to see.

Load-bearing consequence: the spec's "orders from other salespeople on the same base visible to this salesperson" requirement is resolved entirely on the server. If the admin changes the RLS policy, the next pull automatically reflects the new scope; no app change needed.

---

## Column mapping *(snake_case → camelCase)*

The Supabase rows arrive in snake_case (Postgres convention). Watermelon expects camelCase field names for the `created[]` / `updated[]` arrays. The `mappers.ts` module defines one mapper per table. Example:

```text
// Postgres row
{ id, salesperson_id, name, tax_id, phone, email, address_line, notes, updated_at, deleted_at }

// Watermelon 'updated[]' entry
{ id, salesperson_id, name, tax_id, phone, email, address_line, notes, updated_at, deleted_at }
```

Watermelon's convention accepts snake_case field names in the changeset if they match the column names declared in the schema. The 002 schema declares columns in snake_case (`salesperson_id`, `updated_at`, `server_id`, etc.), so **no case conversion is needed** between the Postgres row and the Watermelon changeset — the row can be passed through with minimal shaping. The mapper's real job is:

1. Rename Postgres `id` (the server's primary key) to `server_id` (Watermelon's column that tracks it). Watermelon's own `id` is a locally generated random id.
2. Convert `updated_at` and `deleted_at` from ISO-8601 strings to milliseconds-since-epoch.
3. Drop any Postgres-internal columns that don't exist in the Watermelon schema.

---

## Error handling

| Failure | Handling |
|---------|----------|
| Network failure (NetInfo says offline, or fetch rejects) | Adapter throws `SyncError('NETWORK')`. Pass ends in `failed`; `lastPulledAt` is not advanced. |
| Supabase 401 / JWSError / PGRST301 | Adapter throws `SyncError('AUTH_REJECTED')`. `runPass` catches and calls `authService.refresh({ reason: 'requireSession' })` once (research R10). Pass ends in `failed` regardless of the refresh outcome. |
| Supabase 5xx / non-2xx | Adapter throws `SyncError('PULL_REJECTED')`. Pass ends in `failed`. |
| Malformed row (schema drift) | Adapter logs the offending row (dev only) and throws `SyncError('SERVER')`. Pass ends in `failed`. Running the pass again without fixing the server will keep failing — this is intentional (fail loud in dev, visible in the admin dashboard via admin's own monitoring). |

No retry within a single pass. The next natural trigger retries.

---

## Constraints

- **Query parallelism**: the seven per-table queries MAY run in parallel (`Promise.all`) to minimize wall-clock time. At MVP scale this is safe; the Supabase client enforces its own connection pooling and RLS checks per query.
- **Row volume cap**: no explicit pagination. At MVP scale (low-hundreds per table), the rows fit in one response. If a future test or production dataset exceeds this, the first symptom will be the pass missing SC-001's 15-second budget — that's the signal to introduce pagination, not before.
- **No side effects on failure**: a failed pull MUST NOT have modified any local row. `synchronize()` guarantees this by wrapping the merge in a transaction that rolls back on any thrown error from `pullChanges`. The adapter must throw from a point where no local write has happened — which is automatic because `pullChanges` only reads from Supabase and returns a payload; Watermelon does the merge in its own transaction.
