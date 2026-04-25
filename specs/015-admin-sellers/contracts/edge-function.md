# Contract — Edge Function `admin-create-seller`

**Location**: `supabase/functions/admin-create-seller/index.ts`
**Runtime**: Deno (Supabase Edge Functions)
**Secrets required**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, never shipped to the client).

## Invocation

```ts
const { data, error } = await supabase.functions.invoke('admin-create-seller', {
  body: { name, email, mode, password? },
});
```

- The Supabase JS client automatically attaches the caller's `access_token` in the `Authorization: Bearer <jwt>` header. The function uses this JWT — NOT the service role — to verify the caller is an admin.

## Request body

```ts
type RequestBody = {
  name: string;            // trimmed, non-empty
  email: string;           // RFC-5322 valid, lowercased server-side
  mode: 'password' | 'invite';
  password?: string;       // required iff mode === 'password'; min 8 chars
};
```

Client-side form validation happens in `useSellerForm`; the function re-validates because D7 — client can lie.

## Response

### Success (HTTP 200)

```ts
type SuccessResponse = {
  seller: {
    auth_user_id: string;      // uuid
    salespeople_id: string;    // uuid
    name: string;
    email: string;
    active: true;
  };
};
```

### Failure

| HTTP | `error` code | Triggered by |
|------|--------------|--------------|
| 401  | `unauthenticated` | JWT missing or invalid |
| 403  | `not_admin` | JWT valid but the caller's `user_roles` does not contain `admin` |
| 409  | `email_in_use` | Any existing `auth.users.email` matches |
| 422  | `validation_error` | Empty name / bad email / missing password when `mode='password'` / password too short |
| 500  | `provisioning_failed` | Rollback path ran successfully; no partial records left. `details` field carries the offending step (`auth`, `salespeople`, `user_roles`). |
| 500  | `rollback_failed` | Rare — partial records may exist. Logged for manual cleanup; client surfaces a "contate o administrador do sistema" message. |

Response body shape on failure: `{ error: '<code>', details?: string }`.

## Handler algorithm

```
1. Parse + validate body. On invalid → 422.
2. Verify caller JWT:
     a. Read Authorization header; reject 401 if absent.
     b. Create a Supabase client using the JWT (anon key + user token).
     c. Query user_roles for role='admin' under auth.uid(). Reject 403 if none.
3. Create a service-role Supabase client (separate instance, never mixed with the caller client).
4. Call supabase.auth.admin.listUsers({ email }) to detect collisions → 409 on hit.
5. Branch on mode:
     - 'password': supabase.auth.admin.createUser({ email, password, email_confirm: true })
     - 'invite':   supabase.auth.admin.inviteUserByEmail(email)
   Capture the returned user's id. On error → 500 provisioning_failed (no rollback needed yet).
6. Insert salespeople row (name, auth_user_id, active=true). On error → delete the auth user, return 500.
7. Insert user_roles row (user_id, role='seller'). On error → delete salespeople row (admin-gated) AND delete auth user, return 500.
8. Return 200 with the composite seller object.
```

## Idempotency

The function is **not** idempotent. Callers must not retry a 5xx blindly — the client shows the error with a retry button that the admin taps intentionally, because a retry after `rollback_failed` could create a second Auth user. This is acceptable because the admin is a human who can inspect the sellers list first.

## Tests

- `supabase/functions/admin-create-seller/test.ts`: Deno unit tests covering
  1. success — password mode
  2. success — invite mode
  3. 401 — no JWT
  4. 403 — JWT for a `seller`-only user
  5. 409 — existing email
  6. 422 — bad body shape
  7. rollback — simulate `user_roles` insert failure and assert the auth user + salespeople row are gone afterwards.
