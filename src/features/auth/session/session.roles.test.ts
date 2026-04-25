import { _internalSessionStore, sessionStore } from './session';

describe('sessionStore — roles', () => {
  beforeEach(() => {
    _internalSessionStore.__resetForTests();
  });

  it('initial snapshot has an empty roles array', () => {
    expect(sessionStore.getSnapshot().roles).toEqual([]);
  });

  it('setRoles publishes the normalized role list', () => {
    const listener = jest.fn();
    sessionStore.subscribe(listener);
    _internalSessionStore.setRoles(['seller', 'admin', 'seller']);
    expect(sessionStore.getSnapshot().roles).toEqual(['admin', 'seller']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setRoles is idempotent — same roles do not emit', () => {
    _internalSessionStore.setRoles(['admin']);
    const listener = jest.fn();
    sessionStore.subscribe(listener);
    _internalSessionStore.setRoles(['admin']);
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('setNotAuthenticated clears roles', () => {
    _internalSessionStore.setRoles(['admin', 'seller']);
    _internalSessionStore.setNotAuthenticated({ preserveEmail: null });
    expect(sessionStore.getSnapshot().roles).toEqual([]);
  });

  // 015-admin-sellers: admin-only users keep their session; only an empty
  // role set should feel like "Conta desativada" at the UX layer.
  it('admin-only users remain authenticated with admin role', () => {
    _internalSessionStore.setAuthenticated({
      email: 'admin@empresa.com',
      accessToken: 't',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    _internalSessionStore.setRoles(['admin']);
    const snap = sessionStore.getSnapshot();
    expect(snap.status).toBe('Authenticated');
    expect(snap.roles).toEqual(['admin']);
  });

  it('losing the seller role preserves admin role for dual-role user', () => {
    _internalSessionStore.setRoles(['admin', 'seller']);
    expect(sessionStore.getSnapshot().roles).toEqual(['admin', 'seller']);
    _internalSessionStore.setRoles(['admin']); // simulate post-deactivation re-fetch
    expect(sessionStore.getSnapshot().roles).toEqual(['admin']);
  });

  it('losing every role leaves the session with an empty role set', () => {
    _internalSessionStore.setRoles(['seller']);
    _internalSessionStore.setRoles([]); // deactivation of a seller-only user
    expect(sessionStore.getSnapshot().roles).toEqual([]);
  });
});
