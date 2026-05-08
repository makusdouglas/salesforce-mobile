# Data Model — Product Lifecycle + Granular Admin Roles

**Feature**: `016-product-lifecycle-roles`
**Date**: 2026-04-24

This feature extends two existing entities. No new tables.

## Entity: `products` (extended)

Existing table from feature 014. Adds the active-lifecycle columns.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | no | `gen_random_uuid()` | Unchanged PK. |
| `name` | text | no | — | Unchanged. |
| `description` | text | yes | — | Unchanged. |
| `category` | text | yes | — | Unchanged. |
| `base_price_cents` | integer | no | — | Unchanged. |
| `image_url` | text | yes | — | Unchanged. |
| `updated_at` | timestamptz | no | `now()` | Unchanged; sync pivot. |
| **`active`** | boolean | no | `true` | **New.** Seller-side queries filter on this; admin can toggle. |
| **`deactivated_at`** | timestamptz | yes | `null` | **New.** Stamped when the admin flips `active` → `false`; cleared when flipped back. |

**Invariants**:

- `active = false` ⇒ `deactivated_at IS NOT NULL`.
- `active = true` ⇒ `deactivated_at IS NULL`.
- Enforced by a CHECK constraint in migration 0016: `CHECK ((active IS TRUE AND deactivated_at IS NULL) OR (active IS FALSE AND deactivated_at IS NOT NULL))`.

**Triggers / functions**:

- No new triggers on this table. Admin writes update both `active` and `deactivated_at` in the same statement.

**Sync semantics**:

- Both new columns are synced by the existing pull pipeline (feature 5). WatermelonDB schema version bumps from `13` to `14`; a migration adds the two columns locally.
- Last-write-wins by `updated_at` per D1/D2 applies uniformly.

**Seller-side read path**:

- `catalogSelectors.ts` adds `WHERE active = true` to the list query.
- Order-assembly's `addLine(productId)` re-reads the product and refuses when `active = false`.
- Draft-open hooks run a single batch read over the draft's `order_items[].product_id` and find any with `active = false`.

**Admin-side write path**:

- Writes run as plain authenticated Supabase RPC. RLS (see `contracts/supabase-rls.md`) requires `is_superuser() OR is_manage_products()`.
- After a successful write, the admin client calls the existing `adminWriteTrigger()` (feature 014) to enqueue a sync pull.

---

## Entity: `user_roles` (extended)

Existing table from feature 014. This feature widens the allowed values of `role` and rewrites legacy rows.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `user_id` | uuid | no | — | FK to `auth.users(id)`. Unchanged. |
| `role` | text | no | — | **Widened.** See "Values" below. |
| `created_at` | timestamptz | no | `now()` | Unchanged. |

**Primary key**: `(user_id, role)` — unchanged. A user holds at most one row per role.

**CHECK constraint** (replaces the feature-014 check):

```sql
role in ('seller', 'manage-products', 'manage-salespersons', 'manage-clients', 'superuser')
```

**Data migration** (part of migration 0016):

```sql
UPDATE user_roles SET role = 'superuser' WHERE role = 'admin';
```

**Invariants**:

- At least one row with `role = 'superuser'` MUST exist at all times after the migration completes. Enforced by a trigger:

```sql
CREATE FUNCTION enforce_at_least_one_superuser() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'superuser') THEN
    RAISE EXCEPTION 'at_least_one_superuser_required';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER user_roles_single_superuser
AFTER DELETE OR UPDATE ON user_roles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_at_least_one_superuser();
```

The `DEFERRABLE INITIALLY DEFERRED` clause permits a superuser-swap pattern (DELETE old + INSERT new) inside one transaction.

**Sync semantics**:

- `user_roles` is not synced to WatermelonDB (admin-only data). The session module fetches roles for the signed-in user only, via a direct SELECT.
- Role changes take effect on next app focus or sync pull (FR-027, SC-007).

---

## Entity-less derived values

These are computed on demand; not persisted.

### `DraftUsageCount` (Part A)

- Signature: `listDraftsUsingProduct(productId: uuid): Promise<number>`.
- Implementation: `SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = $1 AND o.status = 'draft'`.
- Called once when the `AdminProductDeactivateConfirmModal` opens; value is cached for the lifetime of the modal.

### `SessionRoles` (Part B)

- Signature: `sessionRoles(): readonly Role[]`.
- Implementation: reactive store populated after login (feature 14) and refreshed on `AppState=active` and on each sync-pull success.
- Consumers: `useAdminGate(requiredRole)`, `AdminMenu` tile visibility, `ProfileScreen → Suas funções` section.

### `RoleBadgeMapping` (Part B)

Single source of truth for display of role values across `AdminUsersList`, `AdminUserRolesForm`, and `ProfileScreen`:

| Role | Portuguese label | Badge style |
|------|------------------|-------------|
| `superuser` | "Super usuário" | destructive |
| `manage-products` | "Gerenciar produtos" | default |
| `manage-salespersons` | "Gerenciar vendedores" | default |
| `manage-clients` | "Gerenciar clientes" | default |
| `seller` | "Vendedor" | secondary |

---

## State transitions

### Product lifecycle

```
active = true  ──(admin toggles off + confirms)──▶  active = false, deactivated_at = now()
active = false ──(admin toggles on)────────────────▶  active = true,  deactivated_at = null
```

- No intermediate states. No "pending deactivation" / "scheduled" semantics.

### User role lifecycle

```
(user has no roles)  ──(superuser grants role R)──▶  (user_roles row inserted with role = R)
(user has role R)    ──(superuser revokes role R)──▶  (user_roles row deleted)
```

- `seller` is granted exclusively through feature 15's Edge Function; not editable here.
- A user may gain or lose multiple roles in the same session; each is one row insert/delete.

---

## Foreign-key integrity

No FK changes. The existing `order_items.product_id → products.id` foreign key remains FK-strict; deactivated products are never deleted, so referential integrity is untouched. Historical orders can always resolve their `product_id` joins even after a product is deactivated.

---

## Indexes

No new indexes required. The existing indexes on `products(id)` and `order_items(product_id)` cover the deactivation-modal draft-count query at MVP scale.
