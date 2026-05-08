import { rootNavigationRef } from '@/app/navigation/navigationRef';

import { authService } from '../service/authService';
import { AuthError } from '../service/errors';

import { _internalSessionStore, sessionStore } from './session';

const ACCESS_TOKEN_SAFETY_MARGIN_MS = 5000;

/**
 * The sole gate that may cause the Relogin modal to appear.
 *
 * Awaited by every network-requiring code path before touching Supabase
 * (sync push, sync pull, anything that uses the access token).
 *
 * Contract: contracts/auth-service.md §requireSession.
 */
export async function requireSession(): Promise<{ accessToken: string }> {
  const snapshot = sessionStore.getSnapshot();

  if (snapshot.status === 'NotAuthenticated') {
    throw new AuthError('NOT_AUTHENTICATED');
  }

  if (snapshot.status === 'RequiresRelogin') {
    await new Promise<void>((resolve, reject) => {
      if (!rootNavigationRef.isReady()) {
        reject(new AuthError('RELOGIN_REQUIRED'));
        return;
      }
      rootNavigationRef.navigate('Relogin', {
        resolve,
        reject: () => reject(new AuthError('RELOGIN_REQUIRED')),
      });
    });
    return requireSession();
  }

  const internal = _internalSessionStore.getInternal();
  if (
    internal.accessToken !== null &&
    internal.accessToken.length > 0 &&
    internal.accessTokenExpiresAtMs !== null &&
    Date.now() < internal.accessTokenExpiresAtMs - ACCESS_TOKEN_SAFETY_MARGIN_MS
  ) {
    return { accessToken: internal.accessToken };
  }

  try {
    await authService.refresh({ reason: 'requireSession' });
  } catch (err) {
    if (err instanceof AuthError && err.code === 'RELOGIN_REQUIRED') {
      return requireSession();
    }
    throw err;
  }
  return requireSession();
}
