# Phase 1 — Data Model: Order Email Delivery

Additive schema changes only. No new business entities; one supporting-infrastructure table.

## Entity changes

### `Order` *(existing)*

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | text | no | existing |
| `client_id` | text (fk) | no | existing |
| `salesperson_id` | text (fk) | no | existing |
| `status` | text | no | `draft` \| `sent` \| `canceled` (existing, D4) |
| `discount_amount` | int (cents) | no | existing (009) |
| `discount_mode` | text | no | existing (009) |
| `created_at_ms` | int | no | existing |
| `sent_at_ms` | int | yes | existing (009); this feature writes it in concert with the new `order_number` + `pdf_path` fields whenever the order transitions to `sent` |
| `canceled_at_ms` | int | yes | existing (009) |
| **`order_number`** | text | yes | **NEW** — `#YYYY-NNNN`. Non-null once the order has passed send-intent. Unique across the seller's devices after sync reconciliation. |
| **`pdf_path`** | text | yes | **NEW** — absolute device path to the persisted PDF. Non-null once the PDF has been materialized. **Device-local only; excluded from Supabase sync.** |
| `updated_at` | int | no | existing |

**Validation rules:**

- `order_number` must match `/^#\d{4}-\d{4}$/` when non-null.
- `order_number` must be non-null whenever `status = 'sent'`.
- `pdf_path` should be non-null whenever `status = 'sent'` (FR-017 allows regeneration if the file vanished after the fact).
- `order_number` uniqueness is enforced server-side by a partial unique index: `CREATE UNIQUE INDEX ON orders (order_number) WHERE order_number IS NOT NULL`.

**State transitions** (unchanged from 009; this feature only populates the existing `draft → sent` transition):

```text
draft ──[markSent]──► sent
draft ──[cancel]───► canceled
sent  ──► (terminal)
canceled ──► (terminal)
```

`markSent` now takes `{ orderNumber, pdfPath, sentAtMs }` and writes all four fields in one transaction.

### `OrderNumberCounter` *(new — local infrastructure)*

A single-row-per-year allocator. Not a business entity — not synced to Supabase.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `year` | int | no | calendar year (device local time at allocation) — primary key |
| `next_value` | int | no | next counter value to allocate (1-indexed). Starts at 1 on first use for a given year. |

**Invariants:**

- Exactly one row per `year` the device has ever allocated from.
- `next_value` is monotonically non-decreasing within a row's lifetime (may jump forward on sync-reconciliation rewrites, never backward).
- Reads + writes happen inside the same `database.write(...)` as the caller that persists the allocated number, preventing same-device races.

**Sync**: not synced. Local-only infrastructure.

## Indexes

- **Local (WatermelonDB)**: existing indexes on `orders` cover the queries this feature needs (`client_id`, `status`, `sent_at_ms`). No new local index.
- **Remote (Supabase)**: one new partial unique index: `CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique ON public.orders (order_number) WHERE order_number IS NOT NULL`.

## Relationships

Unchanged. `Order → OrderItem` (existing), `Order → Client` (existing, snapshotted fields on the order row same as 009). The new fields are scalar; no new foreign keys.

## Migration

One new migration file: `src/data/schema/migrations/0011_order_email_delivery.ts` (WatermelonDB schema version bump) + a matching Supabase SQL migration adding the same columns + the partial unique index. The migration is additive only; no backfill (existing `sent` orders from 009 keep `order_number = NULL` and `pdf_path = NULL` — they are still readable; re-sending them allocates fresh values).
