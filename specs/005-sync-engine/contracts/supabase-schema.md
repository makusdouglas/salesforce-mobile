# Contract: Supabase schema prerequisites *(operational)*

Server-side schema changes that the admin MUST apply before the sync engine is useful. Executed once, via the Supabase dashboard SQL editor, against the dev + prod projects. No app-side migration runs.

---

## Scope

The seven business tables that the app syncs:

1. `salespeople`
2. `clients`
3. `products`
4. `product_variants`
5. `orders`
6. `order_items`
7. `payment_receipts`

For each, add two columns and one trigger.

---

## 1. Reusable trigger function *(one-time, database-level)*

```sql
-- Run once per project (dev, prod). Idempotent via CREATE OR REPLACE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

**Notes**:

- `plpgsql` (not `sql`) because we assign to `NEW`.
- Returns `trigger`, not `void`.
- Owned by `public`; callers are the seven `BEFORE UPDATE` triggers below.

### 1a. Server-clock RPC

The sync engine's pull adapter reads a consistent server-side timestamp at the start of every pass and stores it as WatermelonDB's new `lastPulledAt` cursor. A small RPC exposes this:

```sql
-- Run once per project. Idempotent via CREATE OR REPLACE.
create or replace function public.sync_now_ms()
returns bigint
language sql
stable
as $$
  select (extract(epoch from now()) * 1000)::bigint;
$$;

-- Allow the salesperson role (and any future authenticated role) to call it.
grant execute on function public.sync_now_ms() to authenticated;
```

**Notes**:

- `stable` because the result is constant within a single statement but not across calls.
- `bigint` because ms-since-epoch will soon exceed the 2^31 range (already has).
- Grant is to the Supabase `authenticated` role — RLS on the called function is implicit via the grant. If the admin uses a different role naming, substitute accordingly.
- The sync engine calls it once per pass via `supabase.rpc('sync_now_ms')`. No table scan, no writes — the call is effectively free.

---

## 2. Per-table schema changes

For each of the seven tables, run:

```sql
-- Substitute <table> with each of the seven names in turn.
alter table public.<table>
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz null;

create index if not exists <table>_updated_at_idx
  on public.<table> (updated_at);

create index if not exists <table>_deleted_at_idx
  on public.<table> (deleted_at)
  where deleted_at is not null;

drop trigger if exists <table>_set_updated_at on public.<table>;
create trigger <table>_set_updated_at
  before update on public.<table>
  for each row
  execute function public.set_updated_at();
```

The partial index on `deleted_at IS NOT NULL` keeps the index small — most rows live, only a minority tombstoned. This makes the pull-adapter's `WHERE deleted_at > $lastPulledAt` cheap even as the table grows.

**Column placement**: both columns SHOULD be last in the table definition for readability, but Postgres does not enforce column order and the app does not read by position.

**Backfill**: `updated_at` defaults to `now()` on insert and is maintained by the trigger on update. Existing rows (if any) receive `now()` at `ALTER TABLE` time, which means all pre-existing rows will appear in the very first pull for every device. Acceptable — the alternative (backfill with the row's original created-at) requires a separate `UPDATE` statement per table and has no observable benefit for MVP.

---

## 3. Row Level Security *(unchanged)*

RLS policies authored by the admin continue to apply. Two new columns are data, not policy — existing `SELECT` / `INSERT` / `UPDATE` policies cover them automatically. No policy change is required by this feature.

**Consistency check**: for every table the app pulls, the admin's `SELECT` policy MUST allow the current salesperson to read rows where `updated_at > X OR deleted_at > X`. If the policy is row-scoped on a column unrelated to `updated_at` / `deleted_at`, the columns are irrelevant to the policy — no conflict. If the policy uses one of these columns (unlikely), review case-by-case.

---

## 4. Catalog write-protection *(optional but recommended)*

Per D2, salespeople MUST NOT write to `products` or `product_variants`. The app enforces this in the 002 repositories, and the push adapter filters these tables out on the client side. A third layer on the server — an RLS policy denying `INSERT`/`UPDATE`/`DELETE` on `products` and `product_variants` for the `salesperson` role — is the belt-and-suspenders-and-parachute layer. **Recommended**, not required by this feature.

```sql
-- Example policy; adjust role name to match the admin's setup.
alter table public.products enable row level security;
create policy products_salesperson_readonly on public.products
  for all
  to salesperson
  using (true)
  with check (false);  -- reject any insert/update/delete
```

---

## 5. Verification checklist *(for the admin)*

Before declaring the prerequisite done, run:

```sql
-- All seven tables have both columns.
select table_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('salespeople','clients','products','product_variants','orders','order_items','payment_receipts')
  and column_name = 'updated_at'
having count(*) = 7;

select table_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('salespeople','clients','products','product_variants','orders','order_items','payment_receipts')
  and column_name = 'deleted_at'
having count(*) = 7;

-- All seven tables have the trigger.
select tgname, tgrelid::regclass::text
from pg_trigger
where tgname like '%_set_updated_at'
order by tgname;
-- Expected: 7 rows — one per table.

-- The server-clock RPC is installed and callable.
select public.sync_now_ms();
-- Expected: a single bigint row with the current server time in ms.
```

If any of these four returns fewer rows than expected, the corresponding table or function still needs the change.

---

## 6. What the app does NOT require

- **No change to primary keys.** The existing `id uuid` primary keys continue to be the server-side identity. The app's `server_id` column mirrors this `id`.
- **No change to foreign-key relationships.** Parent/child order in the push adapter already respects existing FK constraints.
- **No materialized views.** The pull query is a straight filtered select; no precomputation needed at MVP scale.
- **No new database roles.** RLS + the existing salesperson role are sufficient.

---

## 7. Rollback

If the feature is ever removed (unlikely), the schema additions are safe to keep — they do not break any other consumer. To remove them explicitly:

```sql
drop trigger if exists <table>_set_updated_at on public.<table>;
drop index if exists <table>_updated_at_idx;
drop index if exists <table>_deleted_at_idx;
alter table public.<table>
  drop column if exists deleted_at,
  drop column if exists updated_at;
-- Repeat per table.
drop function if exists public.set_updated_at();
```

The app would not call `pullChanges` / `pushChanges` if the feature is removed, so the schema becomes inert. Leaving it in place has no cost and preserves historical `updated_at` values for the admin's own queries.
