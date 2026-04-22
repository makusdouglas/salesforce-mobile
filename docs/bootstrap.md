# Bootstrap — Project & Database Setup

**Audience**: developer setting up a fresh dev environment, or admin configuring a new Supabase project (dev or prod).
**Stack**: Expo SDK 55 managed workflow, TypeScript strict, WatermelonDB (local), Supabase (remote DB + Auth + Storage), pnpm, EAS Build.
**Status**: covers features 001 (foundation) → 006 (catalog). Update this file whenever a later feature introduces a new server-side prerequisite.

Run the SQL blocks top-to-bottom in a single SQL Editor session against a fresh Supabase project — everything is `CREATE ... IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so re-running is safe.

---

## 1. Prerequisites

Install once on the dev machine:

| Tool | Version | Install |
|---|---|---|
| Node | ≥ 20 LTS | `brew install node` (macOS) or [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 9.15 | `npm install -g pnpm` |
| Expo CLI | bundled | — (comes with the project's `expo` dep) |
| EAS CLI | latest | `npm install -g eas-cli` |
| Xcode | 15+ | Mac App Store |
| Android Studio | Hedgehog+ | [developer.android.com/studio](https://developer.android.com/studio) |
| Supabase account | — | [supabase.com](https://supabase.com) |
| GitHub CLI (optional) | latest | `brew install gh` |

---

## 2. Clone + install

```sh
git clone git@github.com:makusdouglas/salesforce-mobile.git
cd salesforce-mobile
pnpm install
```

---

## 3. Environment variables

Copy the template and fill in the two values from Supabase:

```sh
cp .env.example .env
```

```sh
# .env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Find both values in **Supabase Dashboard → Project Settings → API**:
- `EXPO_PUBLIC_SUPABASE_URL` = "Project URL"
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = "Project API keys → anon public"

The `EXPO_PUBLIC_` prefix exposes them to the app's JS bundle at build time (standard Expo pattern). **Never** put the `service_role` key here — it bypasses RLS and must stay server-side.

---

## 4. Supabase project setup

Create a new Supabase project (one per environment: `dev`, `prod`). Choose the closest region. Wait ~2 min for provisioning.

Then open **SQL Editor → New query** and run the four sections below in order.

### 4.1. Core tables (7 entities from constitution R2)

Creates the seven business tables with UUID primary keys, foreign keys, indexes, and the **sync-readiness columns** (`updated_at`, `deleted_at`) + **product catalog's `category` column** already included. Brand-new projects get the full schema in one shot.

```sql
-- Salespeople: one row per user of the app.
create table if not exists public.salespeople (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null unique,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz null
);
create index if not exists salespeople_updated_at_idx on public.salespeople (updated_at);
create index if not exists salespeople_deleted_at_idx on public.salespeople (deleted_at) where deleted_at is not null;

-- Clients: retailers the salesperson visits.
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  salesperson_id  uuid not null references public.salespeople(id) on delete restrict,
  name            text not null,
  tax_id          text null,
  phone           text null,
  email           text null,
  address_line    text null,
  notes           text null,
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz null
);
create index if not exists clients_salesperson_id_idx on public.clients (salesperson_id);
create index if not exists clients_updated_at_idx on public.clients (updated_at);
create index if not exists clients_deleted_at_idx on public.clients (deleted_at) where deleted_at is not null;

-- Products: catalog, read-only in the app (D2).
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text null,
  image_url     text null,
  unit          text null,
  category      text null,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz null
);
create index if not exists products_updated_at_idx on public.products (updated_at);
create index if not exists products_deleted_at_idx on public.products (deleted_at) where deleted_at is not null;
create index if not exists products_category_idx on public.products (category) where category is not null;

comment on column public.products.category is
  'Admin-assigned category used as the primary tap filter in the salesperson app. Null for uncategorized products; the app hides the filter chip row when every product is null.';

-- Product variants: concrete SKUs with prices.
create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  label       text not null,
  price       numeric(12, 2) not null default 0,
  barcode     text null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz null
);
create index if not exists product_variants_product_id_idx on public.product_variants (product_id);
create index if not exists product_variants_updated_at_idx on public.product_variants (updated_at);
create index if not exists product_variants_deleted_at_idx on public.product_variants (deleted_at) where deleted_at is not null;

-- Orders: intent-orders assembled in the field.
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete restrict,
  salesperson_id    uuid not null references public.salespeople(id) on delete restrict,
  status            text not null default 'draft' check (status in ('draft', 'sent', 'canceled')),
  discount_amount   numeric(12, 2) not null default 0 check (discount_amount >= 0),
  notes             text null,
  created_at_ms     bigint not null,
  sent_at_ms        bigint null,
  pdf_uri           text null,
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz null
);
create index if not exists orders_client_id_idx on public.orders (client_id);
create index if not exists orders_salesperson_id_idx on public.orders (salesperson_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_updated_at_idx on public.orders (updated_at);
create index if not exists orders_deleted_at_idx on public.orders (deleted_at) where deleted_at is not null;

-- Order items: single lines on an order.
create table if not exists public.order_items (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders(id) on delete cascade,
  product_variant_id   uuid not null references public.product_variants(id) on delete restrict,
  quantity             numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price           numeric(12, 2) not null default 0 check (unit_price >= 0),
  discount_amount      numeric(12, 2) not null default 0 check (discount_amount >= 0),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz null
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_variant_id_idx on public.order_items (product_variant_id);
create index if not exists order_items_updated_at_idx on public.order_items (updated_at);
create index if not exists order_items_deleted_at_idx on public.order_items (deleted_at) where deleted_at is not null;

-- Payment receipts: append-only payment records.
create table if not exists public.payment_receipts (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  amount            numeric(12, 2) not null check (amount > 0),
  method            text not null check (method in ('cash', 'pix', 'transfer', 'card', 'other')),
  received_at_ms    bigint not null,
  image_url         text null,
  notes             text null,
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz null
);
create index if not exists payment_receipts_order_id_idx on public.payment_receipts (order_id);
create index if not exists payment_receipts_updated_at_idx on public.payment_receipts (updated_at);
create index if not exists payment_receipts_deleted_at_idx on public.payment_receipts (deleted_at) where deleted_at is not null;
```

**Notes**:
- Primary keys are **UUIDs generated server-side** (`gen_random_uuid()`) — but the app **generates its own UUIDs client-side** via `expo-crypto.randomUUID()` and pushes them into the `id` column on insert (sync protocol requires `local.id === server.id`). The `default` only triggers if the client sends `NULL`.
- Prices are `numeric(12, 2)` (2-decimal precision, up to R$ 9,999,999,999.99). Integer-based storage was considered and rejected per 002's data-model note.
- `ON DELETE CASCADE` on `order_items → orders` and `payment_receipts → orders` because child records don't make sense without their parent order. `ON DELETE RESTRICT` on parent refs (clients, salespeople, product_variants) to prevent accidental FK breakage of historical orders.
- Every table has `updated_at` + `deleted_at` — the sync-protocol contract from 005.

### 4.2. Sync infrastructure

The sync engine (feature 005) requires a trigger to auto-update `updated_at` on every row write, and a server-clock RPC for the pull cursor.

```sql
-- Trigger function: bumps updated_at on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Install the trigger on all seven tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'salespeople',
    'clients',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'payment_receipts'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- Server-clock RPC used by the sync engine's pull phase.
create or replace function public.sync_now_ms()
returns bigint
language sql
stable
as $$
  select (extract(epoch from now()) * 1000)::bigint;
$$;

grant execute on function public.sync_now_ms() to authenticated;
```

### 4.3. Row Level Security (dev — permissive)

For a dev project, enable RLS on every table with a permissive policy so authenticated users can read/write freely. **Prod needs tighter per-salesperson scoping** — see §9 Hardening for prod.

```sql
-- Enable RLS.
alter table public.salespeople      enable row level security;
alter table public.clients          enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.payment_receipts enable row level security;

-- Permissive dev policies: authenticated users can do anything.
do $$
declare
  t text;
begin
  foreach t in array array[
    'salespeople',
    'clients',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'payment_receipts'
  ]
  loop
    execute format('drop policy if exists %I_dev_all on public.%I', t, t);
    execute format(
      'create policy %I_dev_all on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;
```

### 4.4. Storage bucket for product images (feature 006)

**Dashboard step (UI, not SQL)**:

1. **Storage → New bucket**
2. Name: `product-images`
3. Public bucket: **enabled**
4. File size limit: `5 MB`
5. Allowed MIME types: `image/jpeg, image/png, image/webp`

Then back in **SQL Editor**, install the four Storage policies:

```sql
-- Public read access (salesperson app downloads images anonymously).
drop policy if exists "Public read access to product images" on storage.objects;
create policy "Public read access to product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Authenticated admin writes (upload + update + delete via dashboard).
drop policy if exists "Admin can write product images" on storage.objects;
create policy "Admin can write product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Admin can update product images" on storage.objects;
create policy "Admin can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Admin can delete product images" on storage.objects;
create policy "Admin can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
```

Rationale for public-read: product images are not secrets; every salesperson sees the same catalog. Public-read simplifies the client (no bearer token on image URLs, no signed-URL expiry to refresh). See 006's [research R10](../specs/006-product-catalog/research.md) for the full justification.

---

## 5. Verification

Run these queries to confirm §4 worked end-to-end:

```sql
-- All seven tables present with sync columns.
select count(*) as tables_with_updated_at
  from information_schema.columns
 where table_schema = 'public'
   and column_name = 'updated_at'
   and table_name in ('salespeople','clients','products','product_variants','orders','order_items','payment_receipts');
-- Expected: 7

select count(*) as tables_with_deleted_at
  from information_schema.columns
 where table_schema = 'public'
   and column_name = 'deleted_at'
   and table_name in ('salespeople','clients','products','product_variants','orders','order_items','payment_receipts');
-- Expected: 7

-- Product catalog category column.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'products' and column_name = 'category';
-- Expected: 1 row, text, YES

-- All seven triggers installed.
select count(*) as trigger_count
  from pg_trigger
 where tgname like '%_set_updated_at';
-- Expected: 7

-- Server-clock RPC callable.
select public.sync_now_ms();
-- Expected: a bigint (ms since epoch)

-- Storage bucket exists and is public.
select id, name, public
  from storage.buckets
 where id = 'product-images';
-- Expected: 1 row, public = true
```

If any check fails, re-run the corresponding sub-section of §4.

---

## 6. Seed data (optional — for simulator demos)

After `pnpm ios` / `pnpm android` logs in with a salesperson account (§7), seed a demo catalog. Upload 6 sample product images to the `product-images` bucket (Storage UI) and copy their public URLs, then:

> **The `https://<project>.supabase.co/...` URLs below are placeholders, not runnable as-is.** Replace each `image_url` with the actual public URL the dashboard gives you — do **not** type it by hand. The safe flow:
>
> 1. **Storage → `product-images` → Upload file** (one JPEG/PNG/WEBP per product).
> 2. Right-click the uploaded file → **Copy URL** (or **Get URL → Copy**). The dashboard returns the full URL with your project ref and the exact path.
> 3. Paste that URL into the corresponding `image_url` cell in the INSERT below.
>
> If you run the INSERT as-is, the rows land but every image resolves as `missing` (DNS error) — the app correctly falls back to the neutral placeholder (FR-012), but you won't see product photos on the simulator.

```sql
-- Seed products.
insert into public.products (name, description, image_url, category, updated_at) values
  ('Refri Cola', 'Refrigerante sabor cola, três formatos.',
   'https://<project>.supabase.co/storage/v1/object/public/product-images/refri-cola.jpg',
   'Bebidas', now()),
  ('Salgadinho Queijo', null,
   'https://<project>.supabase.co/storage/v1/object/public/product-images/salgadinho.jpg',
   'Snacks', now()),
  ('Sabonete Hidratante', null,
   'https://<project>.supabase.co/storage/v1/object/public/product-images/sabonete.jpg',
   'Higiene', now()),
  ('Amaciante 500ml', null,
   'https://<project>.supabase.co/storage/v1/object/public/product-images/amaciante.jpg',
   'Limpeza', now()),
  ('Café Torrado 500g', null,
   'https://<project>.supabase.co/storage/v1/object/public/product-images/cafe.jpg',
   'Bebidas', now()),
  ('Biscoito Recheado', null,
   null,           -- no image, exercises the placeholder
   null, now());   -- no category, exercises the chip-row degradation

-- Seed one variant per product (extend as needed).
insert into public.product_variants (product_id, label, price, updated_at)
select p.id, 'Garrafa 2L', 8.90, now() from public.products p where p.name = 'Refri Cola'
union all
select p.id, 'Lata 350ml', 3.50, now() from public.products p where p.name = 'Refri Cola'
union all
select p.id, 'Pet 600ml', 4.90, now() from public.products p where p.name = 'Refri Cola'
union all
select p.id, 'Unidade', 4.50, now() from public.products p where p.name = 'Salgadinho Queijo'
union all
select p.id, 'Barra 90g', 2.30, now() from public.products p where p.name = 'Sabonete Hidratante'
union all
select p.id, 'Frasco 500ml', 6.80, now() from public.products p where p.name = 'Amaciante 500ml'
union all
select p.id, 'Pacote 500g', 14.90, now() from public.products p where p.name = 'Café Torrado 500g'
union all
select p.id, 'Pacote 130g', 3.20, now() from public.products p where p.name = 'Biscoito Recheado';
```

Quickstart walkthrough: [specs/006-product-catalog/quickstart.md §a–g](../specs/006-product-catalog/quickstart.md).

---

## 7. Create the first salesperson user

**Dashboard step**: **Authentication → Users → Add user**. Create with email + password. The account auto-populates the `auth.users` table.

Then link it to a `public.salespeople` row (the app expects this row to exist for any logged-in user):

```sql
-- Replace <auth_user_id> with the id from auth.users.
insert into public.salespeople (id, name, email, updated_at)
values (
  '<auth_user_id>',
  'Seu Nome',
  'you@example.com',
  now()
);
```

**Tip**: grab the auth user id from **Authentication → Users → (click user) → ID**.

---

## 8. Running the app

```sh
pnpm start              # Metro bundler
pnpm ios                # opens iOS simulator
pnpm android            # opens Android emulator

pnpm typecheck          # TypeScript strict
pnpm lint               # ESLint
pnpm format:check       # Prettier
pnpm test               # Jest (unit tests — 146+ cases across features 001–006)
```

### Dev-client rebuild

The project uses a **dev client** (not Expo Go) because of native modules — `expo-secure-store` (004 PIN) and `expo-local-authentication` (004 biometrics). Rebuild the dev client whenever:

- You add a new native dependency.
- `app.json`'s `plugins` array changes.
- You switch SDK versions.

```sh
pnpm build:dev          # EAS build (cloud; ~15–30 min, consumes EAS credits)
```

For `expo-file-system` (added by 006), a rebuild is **usually not required** on SDK 55 — it's a first-party library already bundled into the dev client for SDK 55. Run `pnpm ios` / `pnpm android` first; only rebuild if the native bridge complains.

### Build profiles

```sh
pnpm build:dev          # internal dev client
pnpm build:preview      # internal preview (feature-complete, unsigned)
pnpm build:prod         # store-ready production build
```

Configuration lives in `eas.json`.

---

## 9. Hardening for prod (checklist)

The permissive dev RLS policies from §4.3 **must** be replaced before prod. A minimal prod-grade setup:

- **Per-salesperson scoping on `clients`, `orders`, `order_items`, `payment_receipts`** — rows visible only when `salesperson_id = auth.uid()` (or the equivalent join through `orders`).
- **Read-only for salespeople on `products`, `product_variants`** (per D2):
  ```sql
  drop policy if exists products_dev_all on public.products;
  create policy products_salesperson_read on public.products
    for select to authenticated using (true);
  -- No INSERT/UPDATE/DELETE policy for authenticated → admin-only via service_role.

  drop policy if exists product_variants_dev_all on public.product_variants;
  create policy product_variants_salesperson_read on public.product_variants
    for select to authenticated using (true);
  ```
- **Salespeople row self-service** — `id = auth.uid()` on SELECT/UPDATE; INSERT via admin trigger from `auth.users` sign-up.
- **Storage bucket write policy** scoped to a specific admin role, not all `authenticated` users.
- **Rotate the anon key** if it was ever shared (it's in the app bundle, so any user with the app has it — rotation is a release step, not an ad-hoc fix).

Prod hardening is explicitly scoped out of the current MVP — document as a release-readiness gate when the salesperson app leaves the "solo dev + 1–2 field testers" stage.

---

## 10. Troubleshooting

### `Missing EXPO_PUBLIC_SUPABASE_URL` on app boot

`.env` not loaded. Expo reads `.env` only at `pnpm start` / `pnpm ios` time — restart Metro after editing `.env`.

### WatermelonDB error: `column products.category not found`

Local SQLite is on schema v1; the v2 migration hasn't run. Uninstall + reinstall the app on the simulator to wipe local storage (migrations run on first open of the new build).

### Sync indicator stuck on `Sem internet` despite Wi-Fi

`NetInfo` bridge confused. Toggle airplane mode on/off once, or restart the app. If persistent, check that `@react-native-community/netinfo` is resolving on the dev client (may need a rebuild).

### Image URLs 404 after bucket upload

Public URL uses the **project ref** in the hostname: `https://<project-ref>.supabase.co/storage/v1/object/public/product-images/<filename>`. Right-click the file in Storage → Copy public URL; paste into `products.image_url`.

### `pnpm test` hangs or fails to resolve `better-sqlite3`

Test files must not transitively import WatermelonDB model/adapter code. Pure logic lives in `src/features/<feature>/types.ts` or `*/logic.ts` — import from those in tests, not from the hooks. This is the pattern 005 and 006 follow.

### EAS build fails with `expo-file-system` missing native module

Dev client predates the `expo-file-system` install. Run `pnpm build:dev` to pick up the new dep, then reinstall the app from the new build.

---

## 11. Feature-level references

For deep dives, each feature's `contracts/` folder contains the authoritative details:

| Area | Contract |
|---|---|
| Local DB schema (WatermelonDB) | [specs/002-local-data-layer/data-model.md](../specs/002-local-data-layer/data-model.md) |
| Repositories public API | [specs/002-local-data-layer/contracts/repository.md](../specs/002-local-data-layer/contracts/repository.md) |
| Auth (online login + refresh) | [specs/003-online-auth/plan.md](../specs/003-online-auth/plan.md) |
| Local lock (PIN + biometrics) | [specs/004-local-lock/plan.md](../specs/004-local-lock/plan.md) |
| Sync engine (pull/push) | [specs/005-sync-engine/contracts/](../specs/005-sync-engine/contracts/) |
| Sync server-side schema changes | [specs/005-sync-engine/contracts/supabase-schema.md](../specs/005-sync-engine/contracts/supabase-schema.md) |
| Product catalog | [specs/006-product-catalog/](../specs/006-product-catalog/) |
| Catalog server-side changes | [specs/006-product-catalog/contracts/supabase-schema.md](../specs/006-product-catalog/contracts/supabase-schema.md) |
| Constitution (inviolable principles) | [.specify/memory/constitution.md](../.specify/memory/constitution.md) |

---

## 12. Keeping this doc current

This file is the **single source of truth for setting up a fresh environment**. Each new feature that introduces a server-side prerequisite MUST update §4 (or add a new sub-section) in the same PR as the feature's implementation. Treat it like any other contract — drift between this file and the per-feature `contracts/supabase-schema.md` is a defect.

Last updated: through feature 006 (product catalog).
