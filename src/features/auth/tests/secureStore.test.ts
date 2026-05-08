/* eslint-disable import/first -- jest.mock must appear before the imports it mocks */
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (key: string) => {
      return store.has(key) ? store.get(key)! : null;
    }),
    setItemAsync: jest.fn(async (key: string, value: string, _options?: unknown) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

import * as SecureStore from 'expo-secure-store';

import { secureStore, type RefreshCredential } from '../storage/secureStore';

const mockStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  mockStore.clear();
  (SecureStore.setItemAsync as jest.Mock).mockClear();
  (SecureStore.deleteItemAsync as jest.Mock).mockClear();
});

describe('secureStore — RefreshCredential', () => {
  it('round-trips a credential', async () => {
    const cred: RefreshCredential = { refreshToken: 'rt-abc', lastRefreshAtMs: 1700000000000 };
    await secureStore.setRefreshCredential(cred);
    const read = await secureStore.getRefreshCredential();
    expect(read).toEqual(cred);
  });

  it('returns null when absent', async () => {
    const read = await secureStore.getRefreshCredential();
    expect(read).toBeNull();
  });

  it('returns null on non-JSON entry', async () => {
    mockStore.set('auth.refreshCredential', 'not-json-{broken');
    const read = await secureStore.getRefreshCredential();
    expect(read).toBeNull();
  });

  it('returns null on wrong-shape entry (missing refreshToken)', async () => {
    mockStore.set('auth.refreshCredential', JSON.stringify({ lastRefreshAtMs: 1 }));
    expect(await secureStore.getRefreshCredential()).toBeNull();
  });

  it('returns null on wrong-shape entry (lastRefreshAtMs not a number)', async () => {
    mockStore.set(
      'auth.refreshCredential',
      JSON.stringify({ refreshToken: 'x', lastRefreshAtMs: 'not-a-number' }),
    );
    expect(await secureStore.getRefreshCredential()).toBeNull();
  });

  it('returns null on wrong-shape entry (empty refreshToken)', async () => {
    mockStore.set(
      'auth.refreshCredential',
      JSON.stringify({ refreshToken: '', lastRefreshAtMs: 1 }),
    );
    expect(await secureStore.getRefreshCredential()).toBeNull();
  });

  it('delete is idempotent', async () => {
    await expect(secureStore.deleteRefreshCredential()).resolves.toBeUndefined();
    await expect(secureStore.deleteRefreshCredential()).resolves.toBeUndefined();
  });

  it('setRefreshCredential passes WHEN_UNLOCKED_THIS_DEVICE_ONLY', async () => {
    await secureStore.setRefreshCredential({ refreshToken: 'x', lastRefreshAtMs: 1 });
    const call = (SecureStore.setItemAsync as jest.Mock).mock.calls[0];
    expect(call[2]).toEqual({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' });
  });
});

describe('secureStore — lastEmail', () => {
  it('round-trips an email', async () => {
    await secureStore.setLastEmail('maria@example.com');
    expect(await secureStore.getLastEmail()).toBe('maria@example.com');
  });

  it('returns null when absent', async () => {
    expect(await secureStore.getLastEmail()).toBeNull();
  });

  it('returns null for empty string', async () => {
    mockStore.set('auth.lastEmail', '');
    expect(await secureStore.getLastEmail()).toBeNull();
  });

  it('setLastEmail passes WHEN_UNLOCKED_THIS_DEVICE_ONLY', async () => {
    await secureStore.setLastEmail('foo@bar.com');
    const call = (SecureStore.setItemAsync as jest.Mock).mock.calls[0];
    expect(call[2]).toEqual({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' });
  });

  it('deleteLastEmail is idempotent', async () => {
    await expect(secureStore.deleteLastEmail()).resolves.toBeUndefined();
    await expect(secureStore.deleteLastEmail()).resolves.toBeUndefined();
  });
});
