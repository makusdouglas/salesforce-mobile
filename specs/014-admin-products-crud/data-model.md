# Data Model — 014 Admin role + products/variants CRUD

## New table: `public.user_roles`

| Column   | Type     | Null | Default | Notes |
|----------|----------|------|---------|-------|
| user_id  | uuid     | NO   | —       | FK to `auth.users(id)` ON DELETE CASCADE |
| role     | text     | NO   | —       | CHECK `role IN ('admin', 'seller')` |
| created_at | timestamptz | NO | `now()` | |

- **Primary key**: `(user_id, role)`.
- **RLS**:
  - `SELECT`: authenticated users may read their OWN rows only
    (`user_id = auth.uid()`).
  - `INSERT` / `UPDATE` / `DELETE`: denied to authenticated users. All
    role writes are performed via migrations or by the Supabase
    dashboard using `service_role`. First admin is seeded in
    `0014_user_roles_and_admin_rls.sql`.

## Changes to `public.products`

Existing columns (from migration 0002): `id`, `name`, `description`,
`image_url`, `unit`, `updated_at`, `deleted_at`. `category` was added in
migration 0006.

Added in this feature:

| Column     | Type           | Null | Default | Notes |
|------------|----------------|------|---------|-------|
| barcode    | text           | YES  | NULL    | Unique among live rows (partial index below). |
| base_price | numeric(12, 2) | NO   | 0       | Backfilled to 0 for existing rows. |

- **Indexes**:
  - `products_barcode_live_idx UNIQUE (barcode) WHERE deleted_at IS NULL AND barcode IS NOT NULL` — satisfies FR-017 without blocking reuse of a soft-deleted barcode.
- **Backfill strategy** (executed inside the migration, in this order):
  1. Add the column with `DEFAULT 0` so the schema change is
     non-blocking.
  2. `UPDATE public.products p SET base_price = sub.min_price FROM (
       SELECT product_id, MIN(price) AS min_price
       FROM public.product_variants
       WHERE deleted_at IS NULL
       GROUP BY product_id
     ) sub WHERE p.id = sub.product_id AND p.deleted_at IS NULL;` —
     seeds every live product with the cheapest live variant price so
     seller devices do not display R$ 0,00 right after the migration.
  3. Products without any live variant keep the `DEFAULT 0` value; admins
     can fix those individually from the form.
- **RLS** (new policies, replacing any existing permissive admin-write gap):
  - `SELECT`: authenticated users (no change) — sellers keep reading.
  - `INSERT` / `UPDATE` / `DELETE`: only users with a matching
    `user_roles` row where `role = 'admin'`.

## Changes to `public.product_variants`

Existing columns (from migration 0002): `id`, `product_id`, `label`,
`price`, `barcode`, `updated_at`, `deleted_at`.

This feature does NOT add new columns — the admin form reuses `label` as
the attribute text and `price` as the per-variant price. The existing
`barcode` column on `product_variants` is left unchanged; it is not part
of the lookup flow in MVP.

- **RLS**:
  - `SELECT`: authenticated users (no change).
  - `INSERT` / `UPDATE` / `DELETE`: only users with a matching
    `user_roles` row where `role = 'admin'`.

## Deletes

- Admin "delete" is modeled as `UPDATE ... SET deleted_at = now()`
  (soft delete). Hard delete is not exposed from the client. Variant
  deletion on the form performs the same soft-delete update.

## Timestamps and sync hooks

- All writes `UPDATE public.<table> SET updated_at = now() ...` so the
  feature-5 sync engine picks them up on the next pull (FR-022). The
  client-side admin write trigger explicitly calls
  `pullToRefreshTrigger()` after success to reduce catalogue staleness
  on seller devices.

## Out of scope

- Structured variant attributes (key/value pairs).
- Admin self-signup / role management UI (deferred; per D7 the
  constitution notes a future 014-admin-sellers track).
- Read-only / limited admin roles.
