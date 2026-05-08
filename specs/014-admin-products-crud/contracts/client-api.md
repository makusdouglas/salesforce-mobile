# Contract — Client API (admin products service)

All calls below go through `@supabase/supabase-js` with the authenticated
client. No WatermelonDB, no push queue. Failures surface Portuguese
error messages to the UI.

## `productsApi.ts`

```ts
type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  barcode: string | null;
  image_url: string | null;
  updated_at: string;
  deleted_at: string | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  label: string;
  price: number;
  barcode: string | null;
  updated_at: string;
  deleted_at: string | null;
};

type SaveInput = {
  id?: string;                        // undefined for create
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  barcode: string | null;
  image_url: string | null;
  variants: Array<{
    id?: string;
    label: string;
    price: number;
    _delete?: boolean;
  }>;
};

listProducts(): Promise<Array<ProductRow & { variants: VariantRow[] }>>
saveProduct(input: SaveInput): Promise<ProductRow & { variants: VariantRow[] }>
softDeleteProduct(id: string): Promise<void>
```

- `saveProduct` issues one `upsert` on `products`, then applies the
  variant diff (`upsert` for kept/new; `update ... SET deleted_at =
  now()` for the ones marked `_delete`). Atomicity strategy and the
  soft-rollback rule for failed creates are documented in
  `research.md` §R-003b.
- On success, `saveProduct` calls `adminWriteTrigger()` before returning.

## `barcodeLookup.ts`

```ts
type BarcodeLookupResult =
  | { status: 'match'; product: ProductRow & { variants: VariantRow[] } }
  | { status: 'no_match' }
  | { status: 'offline' }
  | { status: 'error'; message: string };

lookupBarcode(code: string): Promise<BarcodeLookupResult>
```

- Normalizes `code` (trims whitespace, strips non-digits for EAN/UPC
  formats). Returns `no_match` for an empty code after normalization.
- Queries `products.select('*, variants:product_variants(*)').eq('barcode', code).is('deleted_at', null).maybeSingle()`.
- Maps a network error to `{ status: 'offline' }` when `navigator.onLine`
  is false or the Supabase client surfaces a fetch failure.

## `imageUpload.ts`

```ts
type ImageUploadResult =
  | { status: 'ok'; url: string }
  | { status: 'offline' }
  | { status: 'error'; message: string };

pickAndUploadImage(productId: string): Promise<ImageUploadResult>
```

- Handles permission prompts, picker cancellation (returns `{ status: 'error', message: 'cancelled' }`), manipulator, upload and `getPublicUrl`.

## `adminWriteTrigger.ts`

```ts
triggerSyncAfterAdminWrite(): Promise<void>
```

- Thin wrapper around `pullToRefreshTrigger()` from
  `src/features/sync/triggers/pullToRefreshTrigger.ts`. Swallows errors
  (the seller cache will refresh on its next scheduled pull anyway).
  Logs via the existing telemetry helper.

## Session contract

```ts
type SessionSnapshot = {
  status: 'NotAuthenticated' | 'Authenticated' | 'RequiresRelogin';
  email: string | null;
  roles: ReadonlyArray<'admin' | 'seller'>;
};

useRoles(): ReadonlyArray<'admin' | 'seller'>;
useHasRole(role: 'admin' | 'seller'): boolean;
```

- `roles` is populated in `bootstrap()` after login/refresh. Writes into
  `session.ts` go through a new internal setter and reuse the existing
  subscribe / emit plumbing so all subscribers see role changes
  synchronously.
