# RLS Contract — Product Lifecycle + Granular Admin Roles

**Migration**: `supabase/migrations/0018_product_lifecycle_and_granular_roles.sql`
**Date**: 2026-04-24

This contract enumerates every RLS policy added or rewritten by this feature. Policies are grouped by table. Each row names the policy, the command it covers, the USING and WITH CHECK clauses, and the test that proves it.

## Helper functions

All defined in migration 0016. They are `SECURITY DEFINER`, `STABLE`, and read `auth.uid()`.

| Function | Body |
|----------|------|
| `is_superuser()` | `SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superuser')` |
| `is_manage_products()` | `SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manage-products')` |
| `is_manage_salespersons()` | `SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manage-salespersons')` |
| `is_manage_clients()` | `SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manage-clients')` |
| `is_seller()` | `SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'seller')` |
| `is_admin()` | `SELECT is_superuser()` — **redefined** as alias for `is_superuser()` so legacy policy references keep working during the migration window. |

## `products`

| Policy | Command | USING | WITH CHECK | Test |
|--------|---------|-------|-----------|------|
| `products_select_all` | SELECT | `true` | — | Anyone authenticated reads the catalog (feature 6 requirement). |
| `products_insert_admin` | INSERT | — | `is_superuser() OR is_manage_products()` | `0016_rls_products.test.sql` — `manage-products` allowed, `seller` denied. |
| `products_update_admin` | UPDATE | `is_superuser() OR is_manage_products()` | `is_superuser() OR is_manage_products()` | Same. Covers the `active` / `deactivated_at` writes. |
| `products_delete_admin` | DELETE | `is_superuser() OR is_manage_products()` | — | Hard delete is rare; kept for admin parity. |

## `product_variants`

| Policy | Command | USING | WITH CHECK | Test |
|--------|---------|-------|-----------|------|
| `product_variants_select_all` | SELECT | `true` | — | Seller reads variants. |
| `product_variants_insert_admin` | INSERT | — | `is_superuser() OR is_manage_products()` | `0016_rls_products.test.sql`. |
| `product_variants_update_admin` | UPDATE | `is_superuser() OR is_manage_products()` | `is_superuser() OR is_manage_products()` | Same. |
| `product_variants_delete_admin` | DELETE | `is_superuser() OR is_manage_products()` | — | Same. |

## `salespeople`

| Policy | Command | USING | WITH CHECK | Test |
|--------|---------|-------|-----------|------|
| `salespeople_select_all` | SELECT | `true` | — | Every seller reads their peers (feature 15 already had this). |
| `salespeople_insert_admin` | INSERT | — | `is_superuser() OR is_manage_salespersons()` | `0016_rls_salespeople.test.sql`. |
| `salespeople_update_admin` | UPDATE | `is_superuser() OR is_manage_salespersons()` | `is_superuser() OR is_manage_salespersons()` | Same. |
| `salespeople_delete_admin` | DELETE | `is_superuser() OR is_manage_salespersons()` | — | Same. |

## `clients`

Adds the admin write path only. The seller write path stays under the
permissive `clients_dev_all` policy installed by 0005 until feature 17
(Admin Clients Management) tightens it. Reason: `clients.salesperson_id`
references `salespeople.id` (not `auth.users.id`), so a "seller owns
row" branch needs the `salesperson_id IN (SELECT id FROM salespeople
WHERE auth_user_id = auth.uid())` traversal that belongs in feature 17
alongside the seller-side policy rewrite, not here.

| Policy | Command | USING | WITH CHECK | Test |
|--------|---------|-------|-----------|------|
| `clients_dev_all` *(unchanged from 0005)* | ALL | `true` | `true` | Permissive seller path; tightened in feature 17. |
| `clients_admin_insert` | INSERT | — | `is_superuser() OR is_manage_clients()` | `0018_rls_clients.test.sql`. |
| `clients_admin_update` | UPDATE | `is_superuser() OR is_manage_clients()` | `is_superuser() OR is_manage_clients()` | Same. |
| `clients_admin_delete` | DELETE | `is_superuser() OR is_manage_clients()` | — | Same. |

## `user_roles`

| Policy | Command | USING | WITH CHECK | Test |
|--------|---------|-------|-----------|------|
| `user_roles_select_self_or_admin` | SELECT | `user_id = auth.uid() OR is_superuser()` | — | A user sees their own roles; only a superuser can list everyone. |
| `user_roles_insert_superuser` | INSERT | — | `is_superuser()` | `0016_rls_user_roles.test.sql` — `manage-products` denied. |
| `user_roles_update_superuser` | UPDATE | `is_superuser()` | `is_superuser()` | Same. |
| `user_roles_delete_superuser` | DELETE | `is_superuser()` | — | Same. |

## Single-superuser trigger

Defined in migration 0016 (see `data-model.md`). Raises `at_least_one_superuser_required` on any DELETE or UPDATE that would leave zero superusers. Deferrable so superuser-swap in one transaction works.

Test: `0016_single_superuser_trigger.test.sql`.

## Out of scope

- `orders`, `order_items`, `payment_receipts` — RLS unchanged. Historical orders still render discontinued lines verbatim (FR-014) because `products` rows are never deleted on deactivation.
- Edge Functions — none introduced.
- Storage buckets — untouched.

## Decommissioning the legacy alias

`is_admin()` remains as an alias for `is_superuser()` after this migration to keep older policies working. A follow-up migration (tracked outside this feature) will drop `is_admin()` once every call site has been rewritten.
