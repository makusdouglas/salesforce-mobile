import { _internalSessionStore, sessionStore } from '../session/session';

describe('sessionStore state machine', () => {
  beforeEach(() => {
    _internalSessionStore.__resetForTests();
  });

  it('initial state is NotAuthenticated with null email', () => {
    const s = sessionStore.getSnapshot();
    expect(s.status).toBe('NotAuthenticated');
    expect(s.email).toBeNull();
  });

  it('login success transitions NotAuthenticated → Authenticated and emits once', () => {
    const listener = jest.fn();
    sessionStore.subscribe(listener);
    _internalSessionStore.setAuthenticated({
      email: 'maria@example.com',
      accessToken: 'at-1',
      accessTokenExpiresAtMs: Date.now() + 3600_000,
      clearQueuedSync: true,
    });
    const s = sessionStore.getSnapshot();
    expect(s.status).toBe('Authenticated');
    expect(s.email).toBe('maria@example.com');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('refresh success on Authenticated preserves _queuedSync when clearQueuedSync is false', () => {
    _internalSessionStore.setAuthenticated({
      email: 'm@x.com',
      accessToken: 'a',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    _internalSessionStore.setRequiresRelogin({ preserveEmail: 'm@x.com', queueSync: true });
    expect(_internalSessionStore.getInternal()._queuedSync).toBe(true);
    _internalSessionStore.setAuthenticated({
      email: 'm@x.com',
      accessToken: 'a2',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: false,
    });
    expect(_internalSessionStore.getInternal()._queuedSync).toBe(true);
  });

  it('refresh rejection transitions Authenticated → RequiresRelogin and preserves email', () => {
    _internalSessionStore.setAuthenticated({
      email: 'maria@example.com',
      accessToken: 'at',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    _internalSessionStore.setRequiresRelogin({ preserveEmail: 'maria@example.com', queueSync: true });
    const s = sessionStore.getSnapshot();
    expect(s.status).toBe('RequiresRelogin');
    expect(s.email).toBe('maria@example.com');
    expect(_internalSessionStore.getInternal().accessToken).toBeNull();
    expect(_internalSessionStore.getInternal()._queuedSync).toBe(true);
  });

  it('relogin success clears _queuedSync', () => {
    _internalSessionStore.setRequiresRelogin({ preserveEmail: 'm@x.com', queueSync: true });
    expect(_internalSessionStore.getInternal()._queuedSync).toBe(true);
    _internalSessionStore.setAuthenticated({
      email: 'm@x.com',
      accessToken: 'at',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    expect(_internalSessionStore.getInternal()._queuedSync).toBe(false);
  });

  it('logout from Authenticated transitions to NotAuthenticated with null email', () => {
    _internalSessionStore.setAuthenticated({
      email: 'm@x.com',
      accessToken: 'a',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    _internalSessionStore.setNotAuthenticated({ preserveEmail: null });
    expect(sessionStore.getSnapshot().status).toBe('NotAuthenticated');
    expect(sessionStore.getSnapshot().email).toBeNull();
  });

  it('logout from RequiresRelogin also clears state', () => {
    _internalSessionStore.setAuthenticated({
      email: 'm@x.com',
      accessToken: 'a',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    _internalSessionStore.setRequiresRelogin({ preserveEmail: 'm@x.com', queueSync: true });
    _internalSessionStore.setNotAuthenticated({ preserveEmail: null });
    const i = _internalSessionStore.getInternal();
    expect(i._queuedSync).toBe(false);
    expect(i.accessToken).toBeNull();
  });

  it('90-day TTL elapse at boot goes NotAuthenticated and may preserve email', () => {
    // Simulated: bootstrap sets NotAuthenticated with preserved email.
    _internalSessionStore.setNotAuthenticated({ preserveEmail: 'old@user.com' });
    expect(sessionStore.getSnapshot().status).toBe('NotAuthenticated');
    expect(sessionStore.getSnapshot().email).toBe('old@user.com');
  });

  it('reason="boot" does not queue sync on RequiresRelogin transition', () => {
    // The state machine itself is told queueSync explicitly by the caller.
    // authService.refresh() is the one that maps reason→queueSync. Here we
    // verify the store accepts queueSync=false cleanly.
    _internalSessionStore.setAuthenticated({
      email: 'm@x.com',
      accessToken: 'a',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    _internalSessionStore.setRequiresRelogin({ preserveEmail: 'm@x.com', queueSync: false });
    expect(_internalSessionStore.getInternal()._queuedSync).toBe(false);
  });

  it('setInternal does NOT emit to subscribers', () => {
    _internalSessionStore.setAuthenticated({
      email: 'm@x.com',
      accessToken: 'a',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    const listener = jest.fn();
    sessionStore.subscribe(listener);
    _internalSessionStore.setInternal({ _isRefreshing: true });
    _internalSessionStore.setInternal({ _isRefreshing: false });
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('getSnapshot returns stable reference per transition (snapshot identity)', () => {
    _internalSessionStore.setAuthenticated({
      email: 'm@x.com',
      accessToken: 'a',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    const a = sessionStore.getSnapshot();
    const b = sessionStore.getSnapshot();
    expect(a).toBe(b);
    _internalSessionStore.setNotAuthenticated({ preserveEmail: null });
    const c = sessionStore.getSnapshot();
    expect(c).not.toBe(a);
  });

  it('unsubscribe stops notifications', () => {
    const listener = jest.fn();
    const unsub = sessionStore.subscribe(listener);
    _internalSessionStore.setAuthenticated({
      email: 'm@x.com',
      accessToken: 'a',
      accessTokenExpiresAtMs: Date.now() + 1000,
      clearQueuedSync: true,
    });
    unsub();
    _internalSessionStore.setNotAuthenticated({ preserveEmail: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
