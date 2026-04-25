# Contract — Client-side service module

**File**: `src/features/admin/sellers/service/sellersApi.ts`

## Public shape

```ts
export type SellerRow = {
  auth_user_id: string;
  salespeople_id: string;
  name: string;
  email: string;
  active: boolean;
};

export type ListSellersFilter = 'all' | 'active' | 'inactive';

export async function listSellers(filter: ListSellersFilter): Promise<SellerRow[]>;

export async function updateSellerName(
  salespeople_id: string,
  name: string,
): Promise<void>;

export async function deactivateSeller(auth_user_id: string): Promise<void>;

export async function reactivateSeller(auth_user_id: string): Promise<void>;

export async function resendInvite(email: string): Promise<void>;
```

All five functions use the already-authenticated Supabase client from `src/lib/supabase.ts`. None of them talks to WatermelonDB.

## Implementation notes

- `listSellers` — SELECT joined between `salespeople` and the caller's admin-visible view. Returns zero rows for non-admins (RLS handles that silently; we still defend by checking `session_state.roles.includes('admin')` on the hook that calls this).
- `updateSellerName` — straight `UPDATE salespeople SET name = ... WHERE id = ...`.
- `deactivateSeller` / `reactivateSeller` — call the stored functions `public.deactivate_seller` / `public.reactivate_seller` via `supabase.rpc(...)`. Maps the Postgres `cannot_deactivate_self` exception to a user-readable error.
- `resendInvite` — calls `supabase.auth.admin.generateLink({ type: 'invite', email })` *from inside a lightweight secondary Edge Function* (`admin-resend-invite`), same pattern as `admin-create-seller` for `service_role` safety. **Out of MVP scope for this feature; listed here for completeness — tasks.md marks it as P3 polish.**

## Errors

Every function throws a typed error the UI layer can branch on:

```ts
export type SellerApiError =
  | { code: 'unauthenticated' }
  | { code: 'not_admin' }
  | { code: 'email_in_use' }
  | { code: 'validation_error'; field: 'name' | 'email' | 'password' }
  | { code: 'cannot_deactivate_self' }
  | { code: 'network_error' }
  | { code: 'unknown'; message: string };
```

The screens render error codes via a small `useFriendlyError` helper (one copy block per code, Portuguese). No raw Supabase errors hit the UI.

## Wrapper for the Edge Function

`src/features/admin/sellers/service/adminCreateSeller.ts`:

```ts
export type CreateSellerInput =
  | { name: string; email: string; mode: 'password'; password: string }
  | { name: string; email: string; mode: 'invite' };

export async function adminCreateSeller(
  input: CreateSellerInput,
): Promise<SellerRow>;
```

Maps the Edge Function response to `SellerRow` (or throws a `SellerApiError`).
