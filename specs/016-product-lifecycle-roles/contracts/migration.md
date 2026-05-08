# Migration Contract — `0018_product_lifecycle_and_granular_roles.sql`

**Feature**: `016-product-lifecycle-roles`
**Date**: 2026-04-24

Single migration file, single transaction. Runs column additions, role rewrite, CHECK widening, helper (re)definitions, RLS policy rewrites, and the superuser-floor trigger.

## Ordering inside the transaction

1. `ALTER TABLE products ADD COLUMN active boolean NOT NULL DEFAULT true`.
2. `ALTER TABLE products ADD COLUMN deactivated_at timestamptz NULL`.
3. `ALTER TABLE products ADD CONSTRAINT products_active_deactivated_at_consistent CHECK (...)` — see `data-model.md`.
4. Redefine `is_admin()` to return `is_superuser()` (aliases exist simultaneously before step 6).
5. Create the new helpers: `is_superuser()`, `is_manage_products()`, `is_manage_salespersons()`, `is_manage_clients()`, `is_seller()`.
6. `UPDATE user_roles SET role = 'superuser' WHERE role = 'admin'`.
7. `ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check`, then `ADD CONSTRAINT user_roles_role_check CHECK (role IN ('seller','manage-products','manage-salespersons','manage-clients','superuser'))`.
8. Drop then recreate all policies listed in `contracts/supabase-rls.md`. Using the new helper names.
9. Create the `enforce_at_least_one_superuser()` function and attach the deferrable constraint trigger `user_roles_single_superuser`.
10. Create the `admin_users_view` (joins `auth.users`, `salespeople`, and an aggregated `user_roles` array). Grant SELECT to `authenticated`; RLS on the underlying tables continues to enforce access.

## Idempotency

The migration is not idempotent (it modifies constraints). The Supabase migration runner already tracks applied migrations by filename; we rely on that rather than guarding each statement.

## Rollback plan

A companion down-migration `0018_product_lifecycle_and_granular_roles.down.sql` (shipped in the same PR) reverses the CHECK-constraint widening and the `admin → superuser` rewrite. Column additions are left in place (harmless) to avoid data loss in case the down migration is accidentally run on a production device. Trigger and helper functions are dropped.

## Tests

Located under `tests/sql/`:

- `0016_rls_products.test.sql` — matrix: each role attempts SELECT/INSERT/UPDATE/DELETE on `products` and `product_variants`.
- `0016_rls_salespeople.test.sql` — same for `salespeople`.
- `0016_rls_clients.test.sql` — same for `clients`, including the seller-owner branch.
- `0016_rls_user_roles.test.sql` — same for `user_roles`; includes the self-SELECT path.
- `0016_single_superuser_trigger.test.sql` — DELETE of the only superuser row MUST raise `at_least_one_superuser_required`.
- `0016_role_rewrite.test.sql` — verifies that a row inserted with `role = 'admin'` prior to migration becomes `role = 'superuser'` after the migration runs.

Each test uses the existing inline pgTAP helper (`plan() → ok() → finish()`) from feature 015.

## Migration window notes

- Running this migration against a database that has in-flight client sessions is safe: the legacy `is_admin()` continues to resolve correctly because it delegates to `is_superuser()`, and the UPDATE to `user_roles` runs before any new-constraint check.
- No application downtime is required; old app binaries continue to work because every RLS policy they reference either survives verbatim or is replaced by an equivalent-or-broader policy.
