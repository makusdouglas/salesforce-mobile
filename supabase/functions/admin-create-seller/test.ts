// Deno tests for admin-create-seller.
//
// These tests are designed to run against a LOCAL Supabase stack:
//
//   supabase start
//   supabase functions serve admin-create-seller
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=<local anon key>
//   export SUPABASE_ADMIN_JWT=<JWT for a seeded admin user>
//   export SUPABASE_SELLER_JWT=<JWT for a seeded seller user>
//   deno test --allow-net --allow-env supabase/functions/admin-create-seller/test.ts
//
// Each test hits the running function via HTTP so the happy/rollback
// paths are exercised end-to-end. The helpers tolerate missing env vars
// by skipping the relevant case — CI can enable them once secrets are
// wired.

// @ts-ignore — Deno std URL resolved at runtime.
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// @ts-ignore
const FUNCTION_URL = Deno.env.get('ADMIN_CREATE_SELLER_URL') ??
  'http://127.0.0.1:54321/functions/v1/admin-create-seller';
// @ts-ignore
const ADMIN_JWT = Deno.env.get('SUPABASE_ADMIN_JWT') ?? '';
// @ts-ignore
const SELLER_JWT = Deno.env.get('SUPABASE_SELLER_JWT') ?? '';

async function call(body: unknown, jwt: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  return await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

Deno.test('401 when no JWT is provided', async () => {
  const r = await call({ name: 'x', email: 'x@y.com', mode: 'invite' }, null);
  assertEquals(r.status, 401);
  const j = await r.json();
  assertEquals(j.error, 'unauthenticated');
});

Deno.test('422 when body shape is wrong', async () => {
  if (!ADMIN_JWT) {
    console.warn('skipping — SUPABASE_ADMIN_JWT missing');
    return;
  }
  const r = await call({ name: '', email: 'bad', mode: 'password' }, ADMIN_JWT);
  assertEquals(r.status, 422);
  const j = await r.json();
  assertEquals(j.error, 'validation_error');
});

Deno.test('403 when caller is a seller, not admin', async () => {
  if (!SELLER_JWT) {
    console.warn('skipping — SUPABASE_SELLER_JWT missing');
    return;
  }
  const r = await call(
    { name: 'Maria', email: `sel_${Date.now()}@t.com`, mode: 'invite' },
    SELLER_JWT,
  );
  assertEquals(r.status, 403);
  const j = await r.json();
  assertEquals(j.error, 'not_admin');
});

Deno.test('happy path — invite mode returns 200 + seller payload', async () => {
  if (!ADMIN_JWT) {
    console.warn('skipping — SUPABASE_ADMIN_JWT missing');
    return;
  }
  const email = `inv_${Date.now()}@t.com`;
  const r = await call({ name: 'Invited', email, mode: 'invite' }, ADMIN_JWT);
  assertEquals(r.status, 200);
  const j = await r.json();
  assert(j.seller !== undefined);
  assertEquals(j.seller.email, email);
  assertEquals(j.seller.active, true);
});

Deno.test('happy path — password mode returns 200 + seller payload', async () => {
  if (!ADMIN_JWT) {
    console.warn('skipping — SUPABASE_ADMIN_JWT missing');
    return;
  }
  const email = `pwd_${Date.now()}@t.com`;
  const r = await call(
    { name: 'Password Seller', email, mode: 'password', password: 'hunter2hunter2' },
    ADMIN_JWT,
  );
  assertEquals(r.status, 200);
  const j = await r.json();
  assertEquals(j.seller.email, email);
});

Deno.test('409 when email already exists', async () => {
  if (!ADMIN_JWT) {
    console.warn('skipping — SUPABASE_ADMIN_JWT missing');
    return;
  }
  const email = `dup_${Date.now()}@t.com`;
  // first create
  const a = await call({ name: 'Dup One', email, mode: 'invite' }, ADMIN_JWT);
  assertEquals(a.status, 200);
  // then retry — should collide
  const b = await call({ name: 'Dup Two', email, mode: 'invite' }, ADMIN_JWT);
  assertEquals(b.status, 409);
  const j = await b.json();
  assertEquals(j.error, 'email_in_use');
});
