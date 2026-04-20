/* eslint-disable import/first */
// jest.mock must hoist above the imports it affects.
const secureStoreMock = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
};

jest.mock('expo-secure-store', () => secureStoreMock);

import {
  deletePinCredential,
  lockStorage,
  type PinCredential,
} from '../storage/lockStorage';

const VALID_CREDENTIAL: PinCredential = {
  algo: 'PBKDF2-HMAC-SHA256',
  iterations: 100000,
  saltHex: 'a'.repeat(32),
  hashHex: 'b'.repeat(64),
  version: 1,
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('lockStorage pinCredential', () => {
  test('round-trip set → get', async () => {
    secureStoreMock.setItemAsync.mockResolvedValueOnce(undefined);
    await lockStorage.setPinCredential(VALID_CREDENTIAL);
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith(
      'lock.pinCredential',
      JSON.stringify(VALID_CREDENTIAL),
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
    );
    secureStoreMock.getItemAsync.mockResolvedValueOnce(JSON.stringify(VALID_CREDENTIAL));
    expect(await lockStorage.getPinCredential()).toEqual(VALID_CREDENTIAL);
  });

  test('getPinCredential returns null on missing key', async () => {
    secureStoreMock.getItemAsync.mockResolvedValueOnce(null);
    expect(await lockStorage.getPinCredential()).toBeNull();
  });

  test('getPinCredential returns null on non-JSON string', async () => {
    secureStoreMock.getItemAsync.mockResolvedValueOnce('{not json');
    expect(await lockStorage.getPinCredential()).toBeNull();
  });

  test('getPinCredential rejects invalid saltHex length', async () => {
    const bad = { ...VALID_CREDENTIAL, saltHex: 'aa' };
    secureStoreMock.getItemAsync.mockResolvedValueOnce(JSON.stringify(bad));
    expect(await lockStorage.getPinCredential()).toBeNull();
  });

  test('getPinCredential rejects invalid hashHex length', async () => {
    const bad = { ...VALID_CREDENTIAL, hashHex: 'bb' };
    secureStoreMock.getItemAsync.mockResolvedValueOnce(JSON.stringify(bad));
    expect(await lockStorage.getPinCredential()).toBeNull();
  });

  test('getPinCredential rejects unknown version', async () => {
    const bad = { ...VALID_CREDENTIAL, version: 2 };
    secureStoreMock.getItemAsync.mockResolvedValueOnce(JSON.stringify(bad));
    expect(await lockStorage.getPinCredential()).toBeNull();
  });

  test('deletePinCredential is idempotent', async () => {
    secureStoreMock.deleteItemAsync.mockResolvedValueOnce(undefined);
    await deletePinCredential();
    secureStoreMock.deleteItemAsync.mockRejectedValueOnce(new Error('missing'));
    await expect(deletePinCredential()).resolves.toBeUndefined();
  });
});

describe('lockStorage inactivityPreference', () => {
  test('round-trip set → get', async () => {
    secureStoreMock.setItemAsync.mockResolvedValueOnce(undefined);
    await lockStorage.setInactivityPreference({ minutes: 5, version: 1 });
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith(
      'lock.inactivityTimeoutMinutes',
      JSON.stringify({ minutes: 5, version: 1 }),
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
    );
    secureStoreMock.getItemAsync.mockResolvedValueOnce(
      JSON.stringify({ minutes: 5, version: 1 }),
    );
    expect(await lockStorage.getInactivityPreference()).toEqual({
      minutes: 5,
      version: 1,
    });
  });

  test('out-of-range minutes are clamped on read (low)', async () => {
    secureStoreMock.getItemAsync.mockResolvedValueOnce(
      JSON.stringify({ minutes: 0, version: 1 }),
    );
    expect(await lockStorage.getInactivityPreference()).toEqual({
      minutes: 1,
      version: 1,
    });
  });

  test('out-of-range minutes are clamped on read (high)', async () => {
    secureStoreMock.getItemAsync.mockResolvedValueOnce(
      JSON.stringify({ minutes: 100, version: 1 }),
    );
    expect(await lockStorage.getInactivityPreference()).toEqual({
      minutes: 30,
      version: 1,
    });
  });

  test('returns null on missing key', async () => {
    secureStoreMock.getItemAsync.mockResolvedValueOnce(null);
    expect(await lockStorage.getInactivityPreference()).toBeNull();
  });
});
