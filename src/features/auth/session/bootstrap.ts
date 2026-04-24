import { fetchAndPublishRoles } from './rolesRepository';
import { _internalSessionStore } from './session';
import { secureStore } from '../storage/secureStore';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Hydrate the in-memory session from secure storage. Called once at app start
 * by SessionProvider. No network round-trip (FR-014).
 *
 * Post-condition: sessionStore's status reflects whichever of
 *   NotAuthenticated | Authenticated (optimistic)
 * matches the stored credential's presence and 90-day TTL.
 */
export async function authBootstrap(): Promise<void> {
  const [cred, lastEmail] = await Promise.all([
    secureStore.getRefreshCredential(),
    secureStore.getLastEmail(),
  ]);

  if (cred === null) {
    _internalSessionStore.setNotAuthenticated({ preserveEmail: lastEmail });
    return;
  }

  const age = Date.now() - cred.lastRefreshAtMs;
  if (age > NINETY_DAYS_MS) {
    await secureStore.deleteRefreshCredential();
    _internalSessionStore.setNotAuthenticated({ preserveEmail: lastEmail });
    return;
  }

  _internalSessionStore.setAuthenticated({
    email: lastEmail ?? '',
    accessToken: '',
    accessTokenExpiresAtMs: 0,
    clearQueuedSync: true,
  });
  // Re-hydrate roles so the Admin tab appears without requiring an
  // explicit login on app reopen. Fire-and-forget — the tab updates as
  // soon as the snapshot changes.
  void fetchAndPublishRoles();
}
