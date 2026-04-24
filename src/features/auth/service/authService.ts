import { supabase } from '@/data';
import { deletePinCredential } from '@/features/lock/storage/lockStorage';

import { fetchAndPublishRoles } from '../session/rolesRepository';
import { _internalSessionStore } from '../session/session';
import { secureStore } from '../storage/secureStore';

import { AuthError, mapToAuthErrorCode } from './errors';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

type RefreshOptions = { reason?: 'boot' | 'connectivity' | 'requireSession' };

async function _completeLoginExchange(
  email: string,
  password: string,
  clearQueuedSync: boolean,
): Promise<{ hadQueuedSync: boolean }> {
  const hadQueuedSync = _internalSessionStore.getInternal()._queuedSync;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new AuthError(mapToAuthErrorCode(error));
  }
  if (!data.session) {
    throw new AuthError('ACCOUNT_ISSUE');
  }
  const accessToken = data.session.access_token;
  const refreshToken = data.session.refresh_token;
  const expiresAtSeconds = data.session.expires_at ?? 0;
  const accessTokenExpiresAtMs = expiresAtSeconds * 1000;

  await Promise.all([
    secureStore.setRefreshCredential({ refreshToken, lastRefreshAtMs: Date.now() }),
    secureStore.setLastEmail(email),
  ]);
  _internalSessionStore.setAuthenticated({
    email,
    accessToken,
    accessTokenExpiresAtMs,
    clearQueuedSync,
  });
  // Fire-and-forget role fetch; role-gated UI waits on the session snapshot.
  void fetchAndPublishRoles();
  return { hadQueuedSync };
}

export const authService = {
  /** FR-001, FR-002, FR-003, FR-004: initial online login. */
  async login(args: { email: string; password: string }): Promise<void> {
    await _completeLoginExchange(args.email, args.password, true);
  },

  /**
   * FR-006 / FR-008 / FR-009 / FR-020: silent refresh of the access token.
   * Called by the connectivity listener, requireSession(), and boot.
   */
  async refresh(opts?: RefreshOptions): Promise<void> {
    const cred = await secureStore.getRefreshCredential();
    if (cred === null) {
      const lastEmail = await secureStore.getLastEmail();
      _internalSessionStore.setNotAuthenticated({ preserveEmail: lastEmail });
      throw new AuthError('RELOGIN_REQUIRED');
    }

    if (Date.now() - cred.lastRefreshAtMs > NINETY_DAYS_MS) {
      await secureStore.deleteRefreshCredential();
      const lastEmail = await secureStore.getLastEmail();
      _internalSessionStore.setNotAuthenticated({ preserveEmail: lastEmail });
      throw new AuthError('RELOGIN_REQUIRED');
    }

    _internalSessionStore.setInternal({ _isRefreshing: true });
    let result: Awaited<ReturnType<typeof supabase.auth.refreshSession>>;
    try {
      result = await supabase.auth.refreshSession({ refresh_token: cred.refreshToken });
    } catch (thrown) {
      _internalSessionStore.setInternal({ _isRefreshing: false });
      if (mapToAuthErrorCode(thrown) === 'NETWORK') {
        throw new AuthError('NETWORK');
      }
      throw new AuthError('ACCOUNT_ISSUE');
    }
    _internalSessionStore.setInternal({ _isRefreshing: false });

    const { data, error } = result;
    if (error) {
      const code = mapToAuthErrorCode(error);
      if (code === 'NETWORK') {
        throw new AuthError('NETWORK');
      }
      await secureStore.deleteRefreshCredential();
      const preserveEmail = (await secureStore.getLastEmail()) ?? '';
      _internalSessionStore.setRequiresRelogin({
        preserveEmail,
        queueSync: opts?.reason !== 'boot',
      });
      throw new AuthError('RELOGIN_REQUIRED');
    }

    if (!data.session) {
      throw new AuthError('ACCOUNT_ISSUE');
    }
    const newAccessToken = data.session.access_token;
    const newRefreshToken = data.session.refresh_token;
    const expiresAtSeconds = data.session.expires_at ?? 0;
    const accessTokenExpiresAtMs = expiresAtSeconds * 1000;

    await secureStore.setRefreshCredential({
      refreshToken: newRefreshToken,
      lastRefreshAtMs: Date.now(),
    });
    const email = (await secureStore.getLastEmail()) ?? '';
    _internalSessionStore.setAuthenticated({
      email,
      accessToken: newAccessToken,
      accessTokenExpiresAtMs,
      clearQueuedSync: false,
    });
    // Refresh roles on session refresh so newly granted/revoked roles
    // take effect without an app restart (FR-023).
    void fetchAndPublishRoles();

    // Sync-block handoff (FR-007): when @/features/sync ships, fire-and-forget
    // sync.runPullThenPush() here. Until then, this is a no-op.
    // TODO(sync-block): call sync.runPullThenPush() here when the feature ships.
  },

  /** FR-010: user-initiated re-login from the Relogin screen. */
  async relogin(args: { email: string; password: string }): Promise<{ hadQueuedSync: boolean }> {
    return _completeLoginExchange(args.email, args.password, true);
  },

  /**
   * FR-011, FR-013 (003) + FR-018 (004): logout. Local wipe first; server
   * revocation best-effort. When options.preserveEmail is true, auth.lastEmail
   * is kept in secure store — used ONLY by the PIN-recovery path (004 FR-014)
   * to feed the LoginScreen's pre-fill after a forced sign-out.
   *
   * This method also wipes the lock feature's PIN credential (004 FR-018),
   * ensuring session and PIN are cleared atomically. Idempotent on the PIN
   * side — no-op if no PIN was ever set.
   */
  async logout(options?: { preserveEmail?: boolean }): Promise<void> {
    const wipes: Promise<void>[] = [secureStore.deleteRefreshCredential()];
    if (options?.preserveEmail !== true) {
      wipes.push(secureStore.deleteLastEmail());
    }
    await Promise.all(wipes);
    await deletePinCredential();
    _internalSessionStore.setNotAuthenticated({
      preserveEmail: options?.preserveEmail === true
        ? await secureStore.getLastEmail()
        : null,
    });
    // Fire-and-forget server revocation.
    void supabase.auth.signOut().catch(() => {
      // Swallow — local wipe already succeeded (FR-011).
    });
  },
};
