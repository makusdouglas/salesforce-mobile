jest.mock('../storage/lockStorage', () => ({
  lockStorage: {
    getPinCredential: jest.fn(),
    setPinCredential: jest.fn(),
    getInactivityPreference: jest.fn(),
    setInactivityPreference: jest.fn(),
  },
  deletePinCredential: jest.fn(),
}));

import { lockBootstrap } from '../state/bootstrap';
import {
  _internalLockStore,
  getProgressiveDelayMs,
  lockStore,
  type LockStatus,
} from '../state/lockStore';
import { lockStorage } from '../storage/lockStorage';

const mockedStorage = lockStorage as jest.Mocked<typeof lockStorage>;

beforeEach(() => {
  _internalLockStore.__resetForTests();
  jest.resetAllMocks();
});

describe('lockStore state machine', () => {
  test('boot → NotSet when no credential stored', async () => {
    mockedStorage.getPinCredential.mockResolvedValueOnce(null);
    mockedStorage.getInactivityPreference.mockResolvedValueOnce(null);
    mockedStorage.setInactivityPreference.mockResolvedValueOnce(undefined);

    await lockBootstrap();
    expect(lockStore.getSnapshot().status).toBe('NotSet');
    expect(_internalLockStore.getInactivityTimeoutMinutes()).toBe(5);
  });

  test('boot → Locked when credential stored', async () => {
    mockedStorage.getPinCredential.mockResolvedValueOnce({
      algo: 'PBKDF2-HMAC-SHA256',
      iterations: 100000,
      saltHex: 'aa'.repeat(16),
      hashHex: 'bb'.repeat(32),
      version: 1,
    });
    mockedStorage.getInactivityPreference.mockResolvedValueOnce({
      minutes: 10,
      version: 1,
    });

    await lockBootstrap();
    expect(lockStore.getSnapshot().status).toBe('Locked');
    expect(_internalLockStore.getInactivityTimeoutMinutes()).toBe(10);
  });

  test('NotSet → Unlocked is allowed', () => {
    _internalLockStore.setStatus('NotSet');
    _internalLockStore.setStatus('Unlocked');
    expect(lockStore.getSnapshot().status).toBe('Unlocked');
  });

  test('Unlocked → Locked is allowed', () => {
    _internalLockStore.setStatus('NotSet');
    _internalLockStore.setStatus('Unlocked');
    _internalLockStore.setStatus('Locked');
    expect(lockStore.getSnapshot().status).toBe('Locked');
  });

  test('Locked → Unlocked is allowed', () => {
    _internalLockStore.setStatus('NotSet');
    _internalLockStore.setStatus('Unlocked');
    _internalLockStore.setStatus('Locked');
    _internalLockStore.setStatus('Unlocked');
    expect(lockStore.getSnapshot().status).toBe('Unlocked');
  });

  test('same-status setStatus is a silent no-op', () => {
    _internalLockStore.setStatus('NotSet');
    const listener = jest.fn();
    const unsub = lockStore.subscribe(listener);
    _internalLockStore.setStatus('NotSet');
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  test('subscribers receive exactly one notification per transition', () => {
    const listener = jest.fn();
    const unsub = lockStore.subscribe(listener);
    _internalLockStore.setStatus('NotSet');
    _internalLockStore.setStatus('Unlocked');
    _internalLockStore.setStatus('Locked');
    _internalLockStore.setStatus('Unlocked');
    // Initial status was NotSet so first setStatus('NotSet') is no-op.
    expect(listener).toHaveBeenCalledTimes(3);
    unsub();
  });

  test('illegal transition NotSet → Locked throws in __DEV__', () => {
    const prev = (global as unknown as { __DEV__: boolean }).__DEV__;
    (global as unknown as { __DEV__: boolean }).__DEV__ = true;
    try {
      _internalLockStore.setStatus('NotSet');
      expect(() => _internalLockStore.setStatus('Locked' as LockStatus)).toThrow(
        /illegal transition/,
      );
    } finally {
      (global as unknown as { __DEV__: boolean }).__DEV__ = prev;
    }
  });

  test('getSnapshot returns a frozen object in __DEV__', () => {
    const prev = (global as unknown as { __DEV__: boolean }).__DEV__;
    (global as unknown as { __DEV__: boolean }).__DEV__ = true;
    try {
      _internalLockStore.setStatus('NotSet');
      _internalLockStore.setStatus('Unlocked');
      const snap = lockStore.getSnapshot();
      expect(Object.isFrozen(snap)).toBe(true);
    } finally {
      (global as unknown as { __DEV__: boolean }).__DEV__ = prev;
    }
  });

  test('failedAttempts counter increments, resets, and emits on its channel', () => {
    const listener = jest.fn();
    const unsub = lockStore.subscribeFailedAttempts(listener);
    _internalLockStore.incrementFailedAttempts();
    _internalLockStore.incrementFailedAttempts();
    expect(_internalLockStore.getFailedAttempts()).toBe(2);
    _internalLockStore.resetFailedAttempts();
    expect(_internalLockStore.getFailedAttempts()).toBe(0);
    // 2 increments + 1 reset = 3 emissions.
    expect(listener).toHaveBeenCalledTimes(3);
    unsub();
  });

  test('resetFailedAttempts when already 0 does not emit', () => {
    const listener = jest.fn();
    const unsub = lockStore.subscribeFailedAttempts(listener);
    _internalLockStore.resetFailedAttempts();
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});

describe('getProgressiveDelayMs', () => {
  test('0 delay for attempts 0–3', () => {
    for (let n = 0; n <= 3; n += 1) expect(getProgressiveDelayMs(n)).toBe(0);
  });

  test('progressive delays 4–9', () => {
    expect(getProgressiveDelayMs(4)).toBe(1000);
    expect(getProgressiveDelayMs(5)).toBe(2000);
    expect(getProgressiveDelayMs(6)).toBe(5000);
    expect(getProgressiveDelayMs(7)).toBe(10000);
    expect(getProgressiveDelayMs(8)).toBe(20000);
    expect(getProgressiveDelayMs(9)).toBe(30000);
  });

  test('Infinity at 10 (forced recovery)', () => {
    expect(getProgressiveDelayMs(10)).toBe(Infinity);
    expect(getProgressiveDelayMs(50)).toBe(Infinity);
  });
});
