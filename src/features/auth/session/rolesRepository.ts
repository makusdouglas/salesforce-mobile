import { supabase } from '@/data/supabase';

import { _internalSessionStore, type SessionRole } from './session';

const VALID_ROLES: readonly SessionRole[] = ['admin', 'seller'];

function isSessionRole(value: unknown): value is SessionRole {
  return typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value);
}

/**
 * Fetch the signed-in user's roles from Supabase and publish them to
 * the session store. Called post-login and post-refresh.
 *
 * Failures are swallowed: UI role-gates react to the current snapshot;
 * if roles cannot be fetched, the user simply sees no role-gated
 * surfaces until the next attempt succeeds.
 */
export async function fetchAndPublishRoles(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role');

    if (error || !data) {
      _internalSessionStore.setRoles([]);
      return;
    }

    const roles: SessionRole[] = [];
    for (const row of data) {
      const role = (row as { role: unknown }).role;
      if (isSessionRole(role)) {
        roles.push(role);
      }
    }
    _internalSessionStore.setRoles(roles);
  } catch {
    _internalSessionStore.setRoles([]);
  }
}
