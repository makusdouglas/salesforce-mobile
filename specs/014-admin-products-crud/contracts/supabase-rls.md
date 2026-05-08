# Contract — Supabase RLS

Migration: `supabase/migrations/0014_user_roles_and_admin_rls.sql`.

## Helper

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
```

## Policies

### `public.user_roles`

- `CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());`
- No INSERT / UPDATE / DELETE policy → authenticated users cannot write.

### `public.products`

- `CREATE POLICY products_select_authed ON public.products FOR SELECT TO authenticated USING (true);` (preserves seller read access)
- `CREATE POLICY products_admin_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());`
- `CREATE POLICY products_admin_update ON public.products FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());`
- `CREATE POLICY products_admin_delete ON public.products FOR DELETE TO authenticated USING (public.is_admin());`

### `public.product_variants`

- `CREATE POLICY product_variants_select_authed ON public.product_variants FOR SELECT TO authenticated USING (true);`
- `CREATE POLICY product_variants_admin_insert ON public.product_variants FOR INSERT TO authenticated WITH CHECK (public.is_admin());`
- `CREATE POLICY product_variants_admin_update ON public.product_variants FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());`
- `CREATE POLICY product_variants_admin_delete ON public.product_variants FOR DELETE TO authenticated USING (public.is_admin());`

## Unique barcode

```sql
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_live_idx
  ON public.products (barcode)
  WHERE deleted_at IS NULL AND barcode IS NOT NULL;
```

## First-admin seed

Not in the migration. The seed lives at
`supabase/seeds/0014_first_admin.sql` and is applied manually (see
`quickstart.md` §1) so each environment injects its own UUID instead of a
placeholder checked into git.

## Contract tests

| # | Intent | Expected |
|---|--------|----------|
| 1 | Seller JWT INSERT into `products` | Fail (RLS) |
| 2 | Admin JWT INSERT into `products` | Success |
| 3 | Anonymous SELECT on `products` | Fail |
| 4 | Seller SELECT on `products` | Success |
| 5 | Two admins INSERT same barcode concurrently (both `deleted_at IS NULL`) | Second fails on unique index |
| 6 | Admin INSERT barcode that exists on a soft-deleted row | Success |
| 7 | Authenticated user SELECT on `user_roles` for another user's row | Returns 0 rows |
