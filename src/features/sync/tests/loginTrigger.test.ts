/* eslint-disable import/first */

jest.mock('../service/syncService', () => ({
  syncService: {
    runSync: jest.fn().mockResolvedValue({ outcome: 'skipped', reason: 'offline' }),
    onOrderSent: jest.fn(),
    __resetForTests: jest.fn(),
  },
}));

import { _internalSessionStore } from '@/features/auth/session/session';

import { syncService } from '../service/syncService';
import { startLoginTrigger } from '../triggers/loginTrigger';

const mockedRunSync = syncService.runSync as jest.MockedFunction<typeof syncService.runSync>;

beforeEach(() => {
  mockedRunSync.mockClear();
  _internalSessionStore.__resetForTests();
});

function loginOnce(): void {
  _internalSessionStore.setAuthenticated({
    email: 'a@b.co',
    accessToken: 'tok',
    accessTokenExpiresAtMs: Date.now() + 60_000,
    clearQueuedSync: true,
  });
}

describe('loginTrigger', () => {
  test('NotAuthenticated → Authenticated fires exactly one pass', () => {
    const stop = startLoginTrigger();
    loginOnce();
    expect(mockedRunSync).toHaveBeenCalledTimes(1);
    expect(mockedRunSync).toHaveBeenCalledWith({ trigger: 'login' });
    stop();
  });

  test('Authenticated → Authenticated with email/token changes alone does NOT fire', () => {
    loginOnce();
    const stop = startLoginTrigger();
    // Re-assert Authenticated with changed internals — should not trigger.
    _internalSessionStore.setAuthenticated({
      email: 'a@b.co',
      accessToken: 'different-token',
      accessTokenExpiresAtMs: Date.now() + 120_000,
      clearQueuedSync: false,
    });
    expect(mockedRunSync).not.toHaveBeenCalled();
    stop();
  });

  test('queuedSync true→false while already Authenticated fires a pass', () => {
    // Set up: Authenticated + _queuedSync === true. We can reach that by
    // going RequiresRelogin({ queueSync: true }) then refreshing back.
    loginOnce();
    const stop = startLoginTrigger();

    // Transition to RequiresRelogin with queuedSync — trigger MUST NOT fire
    _internalSessionStore.setRequiresRelogin({
      preserveEmail: 'a@b.co',
      queueSync: true,
    });
    expect(mockedRunSync).not.toHaveBeenCalled();

    // Now simulate silent refresh succeeding: setAuthenticated({ clearQueuedSync: true }).
    // That re-enters Authenticated AND goes through transitionedIntoAuthenticated,
    // so it fires via path (1).
    _internalSessionStore.setAuthenticated({
      email: 'a@b.co',
      accessToken: 'tok2',
      accessTokenExpiresAtMs: Date.now() + 60_000,
      clearQueuedSync: true,
    });
    expect(mockedRunSync).toHaveBeenCalledTimes(1);

    stop();
  });

  test('Authenticated → RequiresRelogin does NOT fire', () => {
    loginOnce();
    const stop = startLoginTrigger();
    _internalSessionStore.setRequiresRelogin({ preserveEmail: 'a@b.co', queueSync: false });
    expect(mockedRunSync).not.toHaveBeenCalled();
    stop();
  });

  test('teardown stops further emissions', () => {
    const stop = startLoginTrigger();
    stop();
    loginOnce();
    expect(mockedRunSync).not.toHaveBeenCalled();
  });
});
