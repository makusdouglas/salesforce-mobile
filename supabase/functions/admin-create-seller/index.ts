// admin-create-seller
// Feature 015 — atomic seller provisioning.
//
// Flow:
//   1. Validate body.
//   2. Verify the caller's JWT carries role='admin' (via anon client using
//      the caller's access token — never service_role here).
//   3. Using a separate service-role client, check email uniqueness.
//   4. Create the auth user (password OR invite mode).
//   5. Insert public.salespeople (name, email, auth_user_id, active=true).
//   6. Insert public.user_roles (user_id, 'seller').
//   7. On failure of 5 or 6, roll back: delete salespeople row AND delete
//      the auth user so the system ends up in its pre-call state.
//
// Response / error shapes follow contracts/edge-function.md.

// @ts-ignore — Deno std URL resolved at runtime.
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
// @ts-ignore — Supabase JS resolved at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Mode = 'password' | 'invite';

type RequestBody = {
  name?: unknown;
  email?: unknown;
  mode?: unknown;
  password?: unknown;
};

type ErrorCode =
  | 'unauthenticated'
  | 'not_admin'
  | 'email_in_use'
  | 'validation_error'
  | 'provisioning_failed'
  | 'rollback_failed';

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
    },
  });
}

function fail(code: ErrorCode, status: number, details?: string): Response {
  if (status >= 500) console.error(`[admin-create-seller] FAIL ${code} ${details ?? ''}`);
  return json(details !== undefined ? { error: code, details } : { error: code }, status);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req: Request): Promise<Response> => {
  try {
    return await handle(req);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('[admin-create-seller] UNCAUGHT', msg);
    return json({ error: 'provisioning_failed', details: `uncaught:${msg.slice(0, 200)}` }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return fail('validation_error', 405, 'method_not_allowed');
  }

  // 1. Validate body --------------------------------------------------
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail('validation_error', 422, 'invalid_json');
  }

  if (!isNonEmptyString(body.name)) return fail('validation_error', 422, 'name');
  if (!isNonEmptyString(body.email) || !EMAIL_RE.test(body.email as string)) {
    return fail('validation_error', 422, 'email');
  }
  if (body.mode !== 'password' && body.mode !== 'invite') {
    return fail('validation_error', 422, 'mode');
  }
  const mode = body.mode as Mode;
  if (mode === 'password') {
    if (!isNonEmptyString(body.password) || (body.password as string).length < 8) {
      return fail('validation_error', 422, 'password');
    }
  }
  const name = (body.name as string).trim();
  const email = (body.email as string).trim().toLowerCase();
  const password = mode === 'password' ? (body.password as string) : undefined;

  // 2. Verify caller is an admin --------------------------------------
  // @ts-ignore — Deno global resolved at runtime.
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  // @ts-ignore
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // @ts-ignore
  const ANON = Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) {
    return fail('provisioning_failed', 500, 'env_misconfigured');
  }

  const auth = req.headers.get('authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return fail('unauthenticated', 401);
  }

  const callerClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) {
    return fail('unauthenticated', 401);
  }
  const callerId = userData.user.id;

  const { data: roleRow, error: roleErr } = await callerClient
    .from('user_roles')
    .select('role')
    .eq('user_id', callerId)
    .eq('role', 'admin')
    .maybeSingle();
  if (roleErr) return fail('provisioning_failed', 500, 'role_check');
  if (!roleRow) return fail('not_admin', 403);

  // 3. Check email uniqueness -----------------------------------------
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  {
    // Use the email_exists_in_auth() RPC (security-definer SQL helper
    // installed by migration 0017) — O(1) on auth.users.email and
    // doesn't depend on the Admin API's pagination/scope behaviour.
    const { data, error } = await admin.rpc('email_exists_in_auth', { p_email: email });
    if (error) {
      return fail('provisioning_failed', 500, `email_check:${error.message}`);
    }
    if (data === true) {
      return fail('email_in_use', 409);
    }
  }

  // 4. Create auth user -----------------------------------------------
  let authUserId: string;
  if (mode === 'password') {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: password as string,
      email_confirm: true,
      user_metadata: { created_by: callerId, display_name: name },
    });
    if (error || !data.user) {
      return fail('provisioning_failed', 500, `auth_create:${error?.message ?? 'no_user'}`);
    }
    authUserId = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { created_by: callerId, display_name: name },
    });
    if (error || !data.user) {
      return fail('provisioning_failed', 500, `auth_invite:${error?.message ?? 'no_user'}`);
    }
    authUserId = data.user.id;
  }

  // 5. Insert salespeople row -----------------------------------------
  let salespeopleId: string;
  {
    const { data, error } = await admin
      .from('salespeople')
      .insert({ name, email, auth_user_id: authUserId, active: true })
      .select('id')
      .single();
    if (error || !data) {
      // rollback: delete the auth user we just created.
      const del = await admin.auth.admin.deleteUser(authUserId);
      if (del.error) return fail('rollback_failed', 500, 'salespeople_insert_rollback_failed');
      return fail('provisioning_failed', 500, 'salespeople_insert');
    }
    salespeopleId = data.id as string;
  }

  // 6. Insert user_roles row ------------------------------------------
  {
    const { error } = await admin
      .from('user_roles')
      .insert({ user_id: authUserId, role: 'seller' });
    if (error) {
      // rollback: delete salespeople row AND auth user.
      const delRow = await admin.from('salespeople').delete().eq('id', salespeopleId);
      const delUser = await admin.auth.admin.deleteUser(authUserId);
      if (delRow.error || delUser.error) {
        return fail('rollback_failed', 500, 'user_roles_insert_rollback_failed');
      }
      return fail('provisioning_failed', 500, 'user_roles_insert');
    }
  }

  // 7. Success --------------------------------------------------------
  return json(
    {
      seller: {
        auth_user_id: authUserId,
        salespeople_id: salespeopleId,
        name,
        email,
        active: true,
      },
    },
    200,
  );
}
