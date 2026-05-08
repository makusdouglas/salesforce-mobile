# Supabase migrations

Per-feature incremental SQL for the Postgres + Storage side of the project.
Each file is named `00NN_<feature-short-name>.sql` where `NN` matches the
feature number in `specs/NNN-<feature>/`. Migrations only exist for features
that actually touch schema; feature numbers with no file here had no
server-side prerequisite (e.g. 003-online-auth, 004-local-lock, 010-repeat-last-order).

## Applying

Pick **one** of the two equivalent paths:

### Option A — Supabase CLI

```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

### Option B — SQL Editor (manual)

Open the Supabase Dashboard → SQL Editor and run each file **in numerical
order** against a fresh project.

## Relationship to `docs/bootstrap.md`

`docs/bootstrap.md` §4 contains the **consolidated** post-latest schema for a
single-shot fresh project setup. The files in this folder are the
**incremental** history — what each feature actually added on top of the
previous state. Both paths converge on the same final shape, so:

- Fresh onboarding → either run `bootstrap.md` §4 once **or** run these
  files in order. Do not run both.
- Evolving an existing DB that is already on feature N → apply only the
  files with number > N.

## Idempotency

Every file uses `CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
`DROP POLICY IF EXISTS` + `CREATE POLICY`, and `INSERT ... ON CONFLICT`,
so re-running is safe. The one caveat: `ALTER TABLE ... RENAME COLUMN`
(used in 0012) is not idempotent; the file wraps it in a `DO $$ ... $$`
block that checks `information_schema.columns` first.

## File list

| File | Feature | What it does |
|------|---------|--------------|
| `0002_local_data_layer.sql` | 002 | Creates the seven MVP tables from constitution R2 (v1 shape). |
| `0005_sync_engine.sql` | 005 | `set_updated_at()` trigger function, per-table triggers, `sync_now_ms()` RPC, permissive dev RLS. |
| `0006_product_catalog.sql` | 006 | Adds `products.category`, creates public `product-images` Storage bucket + 4 policies. |
| `0009_order_assembly.sql` | 009 | Adds `discount_mode` to `orders` + `order_items`; `canceled_at_ms` to `orders`. |
| `0011_order_email_delivery.sql` | 011 | Adds `orders.order_number` with partial-unique index for `#YYYY-NNNN` allocator. |
| `0012_payment_receipts.sql` | 012 | Renames `payment_receipts.image_url` → `attachment_url`; adds 5 append-only attachment columns + `correction_of_receipt_id` self-FK; swaps method CHECK from `card` → `check`; creates private `receipt-attachments` Storage bucket + 2 policies. |

Features without a migration here (no schema changes): 001, 003, 004, 007, 008, 010.
