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
});
