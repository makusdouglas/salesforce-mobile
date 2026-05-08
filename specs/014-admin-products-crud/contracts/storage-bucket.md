# Contract — Supabase Storage bucket

## Bucket

- **Name**: `product-images`
- **Public read**: yes (seller app reads image URLs anonymously while
  loading the catalogue from its cache).
- **Path convention**: `products/<product_id>/<uuid>.jpg`. Each save
  uploads a new object — previous images are NOT pruned in MVP (cost is
  negligible at this scale; cleanup can happen in a future cron).

## Policies

- `insert/update/delete` restricted to admins via:
  ```sql
  CREATE POLICY storage_product_images_admin_write
    ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'product-images' AND public.is_admin())
    WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
  ```
- `select` is allowed via the public-read flag on the bucket.

## Client pipeline

1. `ImagePicker.launchImageLibraryAsync({ mediaTypes: Images, allowsEditing: false })`.
2. `ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], { compress: 0.8, format: JPEG })`.
3. Read the result as an `ArrayBuffer` / base64 and upload via
   `supabase.storage.from('product-images').upload(path, body, { contentType: 'image/jpeg' })`.
4. `supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl`.
5. Persist the URL on `products.image_url`.

## Contract tests

| # | Intent | Expected |
|---|--------|----------|
| 1 | Seller JWT upload to `product-images` | Fail (policy) |
| 2 | Admin JWT upload with valid path | Success, public URL works |
| 3 | Anonymous HTTP GET on a known public URL | Success |
