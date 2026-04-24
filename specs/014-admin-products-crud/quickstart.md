# Quickstart — 014 Admin role + products/variants CRUD

## Prereqs

- `pnpm install` already run at repo root.
- Supabase CLI authenticated against the project.
- One existing auth user to bootstrap as admin. Grab its UUID via the
  Supabase dashboard or `select id from auth.users where email = '…'`.

## 1. Apply the migration + seed the first admin

Apply the migration (no UUID editing needed — seeds live in a separate file):

```sh
supabase db push
```

Then seed the first admin. Grab the bootstrap user's UUID from the
Supabase dashboard (Authentication → Users), then run the templated seed
after substituting `<replace-me>`:

```sh
export ADMIN_UUID=...  # paste the real UUID
sed "s/<replace-me>/${ADMIN_UUID}/" supabase/seeds/0014_first_admin.sql \
  | supabase db execute
```

Or via psql:

```sh
psql "$SUPABASE_DB_URL" -c "INSERT INTO public.user_roles (user_id, role) VALUES ('${ADMIN_UUID}', 'admin') ON CONFLICT DO NOTHING;"
```

Verify:

```sql
select user_id, role from public.user_roles;
select policyname from pg_policies where tablename in ('products', 'product_variants', 'user_roles');
select indexname from pg_indexes where indexname = 'products_barcode_live_idx';
select id, name, base_price from public.products order by updated_at desc limit 5; -- confirm backfill
```

Run the barcode-uniqueness smoke (T070):

```sh
psql "$SUPABASE_DB_URL" -f supabase/tests/0014_barcode_unique.sql
```

## 2. Create the Storage bucket

In the Supabase dashboard (Storage → Create bucket):

- Name: `product-images`
- Public: ON
- File size limit: leave default

Then apply the `storage.objects` policy from
`contracts/storage-bucket.md`.

## 3. Run the app

```sh
pnpm expo start --dev-client
```

Log in as the bootstrap admin. The Admin tab should appear in the bottom
tab bar. A seller-only user should NOT see it.

## 4. Smoke-test the manual path

1. Tap the Admin tab → "Novo" → "Cadastro manual".
2. Fill name, description, category, base price; leave barcode empty.
3. Tap the image drop zone → pick an image → save.
4. Confirm a new row lands in `products` with `image_url`, and a `0` on
   `base_price` if no value is given (should not happen; Save blocks
   empty price).
5. Open the row: add two variants with distinct labels + prices; save.

## 5. Smoke-test the barcode path

1. Seed one product with a known barcode (e.g. `7891234567890`) via the
   form.
2. Tap "Novo" → "Escanear código de barras" → type the seeded code in
   the manual-entry fallback → "Verificar código".
3. You should land on the Barcode Match screen, NOT on the form. Tap
   "Editar este produto" and confirm the form opens on the matched row.
4. Re-run the scan with a new code (e.g. `7899999999999`). The form
   should open with the `barcode` field pre-filled.

## 6. Verify the RLS gates

From a seller-only JWT (e.g. via the Supabase REST explorer):

```sh
curl -X POST "$SUPABASE_URL/rest/v1/products" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $SELLER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"pwn"}'
# Expect 403 / RLS denial
```

From the admin JWT the same call should succeed.

## 7. Verify seller propagation

With the admin app open, save any change. Then open the seller app and
pull-to-refresh (or wait for the next sync). The change should appear in
the seller catalogue.

## Gotchas

- **Offline state**: admin writes and barcode lookups are online-required
  (P6). Testing offline should surface a Portuguese error banner, not a
  crash.
- **Soft-deleted barcodes**: if a product is soft-deleted, its barcode is
  freed for reuse. The partial unique index is what allows this — do not
  promote it to a plain unique constraint.
- **Image pruning**: previous image objects are not deleted when a
  product's image is replaced. Cleanup is a future cron job.
