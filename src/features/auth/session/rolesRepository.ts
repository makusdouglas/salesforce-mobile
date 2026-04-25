import { supabase } from '@/data/supabase';

import { _internalSessionStore, sessionStore, type SessionRole } from './session';

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
 *
 * 015-admin-sellers: if the role set transitions from non-empty to empty
 * WHILE the session is Authenticated, it means the user was deactivated
 * server-side (FR-012). We route to RequiresRelogin so the next action
 * surfaces a friendly re-login screen instead of silently failing RLS.
 */
export async function fetchAndPublishRoles(): Promise<void> {
  const snap = sessionStore.getSnapshot();
  const hadRoles = snap.roles.length > 0;
  const wasAuthenticated = snap.status === 'Authenticated';

  try {
    const { data, error } = await supabase.from('user_roles').select('role');

    if (error || !data) {
      // Network/permission issue — do not flip the session; just keep the
      // current roles so the UI remains stable until the next attempt.
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

    if (wasAuthenticated && hadRoles && roles.length === 0 && snap.email !== null) {
      _internalSessionStore.setRequiresRelogin({
        preserveEmail: snap.email,
        queueSync: false,
      });
    }
  } catch {
    // Swallow on purpose: next refresh will retry.
  }
}
