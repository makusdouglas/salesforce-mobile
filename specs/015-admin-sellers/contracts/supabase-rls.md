# Contract — Supabase RLS policies

**Migration**: `supabase/migrations/0015_admin_sellers.sql`
**Depends on**: `public.is_admin(uid uuid)` helper function shipped in feature 014 (migration 0014).

## `public.salespeople`

Existing policies from prior features remain in place. This migration adds / tightens the following:

```sql
-- READ: admins read every row (active + inactive); sellers keep existing
-- read policy (their own row via auth_user_id = auth.uid()) unchanged.
drop policy if exists salespeople_admin_select on public.salespeople;
create policy salespeople_admin_select on public.salespeople
  for select using (public.is_admin(auth.uid()));

-- WRITE (insert/update): admin-only.
-- INSERT is used only by the admin-create-seller Edge Function (which uses
-- service_role and bypasses RLS), so the client-facing policy simply
-- forbids non-admin inserts and is defensive.
drop policy if exists salespeople_admin_insert on public.salespeople;
create policy salespeople_admin_insert on public.salespeople
  for insert with check (public.is_admin(auth.uid()));

drop policy if exists salespeople_admin_update on public.salespeople;
create policy salespeople_admin_update on public.salespeople
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- DELETE: forbidden for everyone at the RLS layer (FR-013 — history must
-- survive). Physical deletes, if ever needed, go through the Supabase
-- dashboard under a human review process.
drop policy if exists salespeople_no_delete on public.salespeople;
create policy salespeople_no_delete on public.salespeople
  for delete using (false);
```

## `public.user_roles`

```sql
-- READ: already allowed to the owning user (their own roles) and to admins
-- from feature 014. No change here.

-- INSERT: admins may assign the 'seller' role. Assigning 'admin' is
-- explicitly NOT covered by this feature (deferred to 016-admin-roles).
drop policy if exists user_roles_admin_insert_seller on public.user_roles;
create policy user_roles_admin_insert_seller on public.user_roles
  for insert
  with check (public.is_admin(auth.uid()) and role = 'seller');

-- DELETE: admins may revoke the 'seller' role only. Again, 'admin' role
-- revocation is deferred.
drop policy if exists user_roles_admin_delete_seller on public.user_roles;
create policy user_roles_admin_delete_seller on public.user_roles
  for delete
  using (public.is_admin(auth.uid()) and role = 'seller');
```

## Test coverage

Contract tests live in `supabase/tests/0015_admin_sellers_rls.sql` and cover:

| # | As | Operation | Expectation |
|---|----|-----------|-------------|
| 1 | anon | `select * from salespeople` | 0 rows (RLS blocks) |
| 2 | seller | `select * from salespeople where auth_user_id = <own>` | 1 row |
| 3 | seller | `select * from salespeople` | only own row |
| 4 | seller | `insert into salespeople ...` | `permission denied` |
| 5 | admin | `select * from salespeople` | all rows (active + inactive) |
| 6 | admin | `update salespeople set active = false ...` | success |
| 7 | anyone | `delete from salespeople ...` | `permission denied` |
| 8 | seller | `insert into user_roles (auth.uid(), 'admin')` | `permission denied` (self-promotion guard) |
| 9 | admin | `insert into user_roles (<x>, 'seller')` | success |
| 10 | admin | `delete from user_roles where role = 'admin'` | `permission denied` (blocks self-demotion via this feature; 016 will cover role moves) |
| 11 | admin | `select public.deactivate_seller(<own_auth_user_id>)` | raises `cannot_deactivate_self` |

Tests are a task in Phase 1 Setup and MUST run before any screen task is marked complete.
