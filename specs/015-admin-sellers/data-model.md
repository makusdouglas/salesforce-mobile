# Data Model — Admin-side Seller Management

No new tables. The feature adds one boolean column and two database functions.

## Existing tables touched

### `auth.users` (Supabase built-in)

Not modified — only read via the Admin API inside the Edge Function. No new policies.

### `public.salespeople`

Owns the seller's business profile. Each row already maps to an `auth.users` row via `auth_user_id uuid references auth.users(id)`.

**New column**:

| Column | Type | Default | Null | Notes |
|--------|------|---------|------|-------|
| `active` | `boolean` | `true` | not null | Flipped to `false` on deactivation; remains `true` for newly-provisioned sellers. If the column already exists from a prior feature, the migration is a no-op. |

**Validation rules carried over from spec**:

- `name` MUST be non-empty (FR-004) — enforced client-side and by a pre-existing `check (length(trim(name)) > 0)` constraint, added by this migration if missing.
- The row is **never deleted** for a deactivated seller (FR-010, FR-013, SC-005).

**State transitions** (encoded by `active` + the paired `user_roles.seller` entry):

```
         ┌──────────── deactivate() ─────────────┐
         ▼                                        │
    ACTIVE (active=true, role='seller')    INACTIVE (active=false, no role)
         ▲                                        │
         └──────────── reactivate() ──────────────┘
```

`NEW` is the implicit pre-state before `admin-create-seller`. Only the Edge Function can produce an `ACTIVE` row from `NEW` (needs `service_role`). Transitions between `ACTIVE` and `INACTIVE` are RLS-gated to admins.

### `public.user_roles`

Shipped in feature 014. Structure unchanged:

```sql
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','seller')),
  primary key (user_id, role)
);
```

This feature adds two RLS policy lines (INSERT / DELETE for admins on rows where `role = 'seller'`) — see `contracts/supabase-rls.md`.

## New database functions

### `public.deactivate_seller(p_auth_user_id uuid) returns void`

- **Security**: `security definer`, `set search_path = public`, owned by a role that can bypass RLS for these two tables. The function itself starts by asserting `is_admin(auth.uid())` and raising `permission_denied` otherwise. Also raises `cannot_deactivate_self` if `p_auth_user_id = auth.uid()`.
- **Body**:
  ```sql
  delete from public.user_roles
    where user_id = p_auth_user_id and role = 'seller';
  update public.salespeople
    set active = false
    where auth_user_id = p_auth_user_id;
  ```
- **Atomicity**: executes inside the caller's implicit transaction. If either statement fails, nothing persists.

### `public.reactivate_seller(p_auth_user_id uuid) returns void`

- **Security**: same pattern as above. Rejects non-admin callers.
- **Body**:
  ```sql
  insert into public.user_roles (user_id, role)
    values (p_auth_user_id, 'seller')
    on conflict (user_id, role) do nothing;
  update public.salespeople
    set active = true
    where auth_user_id = p_auth_user_id;
  ```

Both functions are exposed to the client via PostgREST (`supabase.rpc('deactivate_seller', ...)`). Admin-only access is re-asserted at the RPC layer too — see `contracts/client-api.md`.

## Entities (spec cross-reference)

| Spec entity | Storage |
|-------------|---------|
| **Seller** | `auth.users` (credentials) + `public.salespeople` (profile, `active`) + `public.user_roles` (`role='seller'`) |
| **Admin** | `auth.users` + `public.user_roles` (`role='admin'`) — unchanged by this feature |
| **Invite** | Ephemeral Supabase construct (no local table). Created by `auth.admin.inviteUserByEmail`; no app-side persistence. |

## Migrations checklist

- `supabase/migrations/0015_admin_sellers.sql`:
  1. `alter table public.salespeople add column if not exists active boolean not null default true;`
  2. `alter table public.salespeople add constraint salespeople_name_not_empty check (length(trim(name)) > 0);` — wrapped in `do $$ ... exception when duplicate_object then null; end $$;` to stay idempotent.
  3. `create or replace function public.deactivate_seller(...)` + `public.reactivate_seller(...)`.
  4. RLS policies (see `contracts/supabase-rls.md`).
  5. `grant execute on function public.deactivate_seller, public.reactivate_seller to authenticated;` — execute is still RLS-gated internally.

Rollback: a separate `down` SQL or the symmetric `drop` block is not required at this MVP stage (P3 — avoid premature tooling).
