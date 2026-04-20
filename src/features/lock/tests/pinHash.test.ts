/* eslint-disable import/first */
// jest.mock must hoist above the imports it affects.
// @noble/hashes v2 ships as ESM-only, which jest's default CJS runner cannot
// parse without extra transform config. Mock with a deterministic stub that
// satisfies the wrapper-logic tests below (different inputs → different outputs,
// identical inputs → identical outputs). The actual PBKDF2 correctness is
// covered by @noble/hashes' own test suite; here we only verify our wrapper.
jest.mock('@noble/hashes/pbkdf2.js', () => ({
  pbkdf2Async: jest.fn(
    async (
      _hashFn: unknown,
      pass: Uint8Array,
      salt: Uint8Array,
      opts: { c: number; dkLen: number },
    ): Promise<Uint8Array> => {
      const out = new Uint8Array(opts.dkLen);
      for (let i = 0; i < opts.dkLen; i += 1) {
        const p = pass[i % Math.max(1, pass.length)] ?? 0;
        const s = salt[i % Math.max(1, salt.length)] ?? 0;
        out[i] = (p ^ s ^ (opts.c & 0xff) ^ i) & 0xff;
      }
      return out;
    },
  ),
}));

jest.mock('@noble/hashes/sha2.js', () => ({
  sha256: {},
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (byteLength: number) => {
    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i += 1) bytes[i] = (i * 7 + 3) % 256;
    return bytes;
  }),
}));

import {
  createCredentialFromPin,
  hashPin,
  verifyPinHash,
} from '../crypto/pinHash';

describe('pinHash (wrapper logic; @noble/hashes mocked)', () => {
  test('hashPin is deterministic for identical inputs', async () => {
    const a = await hashPin('1234', 'aa'.repeat(16), 1000);
    const b = await hashPin('1234', 'aa'.repeat(16), 1000);
    expect(a).toBe(b);
  });

  test('different PINs produce different hashes with the same salt', async () => {
    const a = await hashPin('1234', 'bb'.repeat(16), 1000);
    const b = await hashPin('5678', 'bb'.repeat(16), 1000);
    expect(a).not.toBe(b);
  });

  test('different salts produce different hashes for the same PIN', async () => {
    const a = await hashPin('1234', 'aa'.repeat(16), 1000);
    const b = await hashPin('1234', 'bb'.repeat(16), 1000);
    expect(a).not.toBe(b);
  });

  test('verifyPinHash accepts the correct PIN and rejects wrong PINs', async () => {
    const credential = await createCredentialFromPin('123456');
    expect(await verifyPinHash('123456', credential)).toBe(true);
    expect(await verifyPinHash('654321', credential)).toBe(false);
    expect(await verifyPinHash('12345', credential)).toBe(false);
  });

  test('verifyPinHash stays false when hashHex is tampered at the last byte', async () => {
    const credential = await createCredentialFromPin('1234');
    const tampered = {
      ...credential,
      hashHex:
        credential.hashHex.slice(0, -2) +
        (credential.hashHex.slice(-2) === 'ff' ? '00' : 'ff'),
    } as typeof credential;
    expect(await verifyPinHash('1234', tampered)).toBe(false);
  });

  test('createCredentialFromPin returns a well-formed payload', async () => {
    const credential = await createCredentialFromPin('4321');
    expect(credential.algo).toBe('PBKDF2-HMAC-SHA256');
    expect(credential.iterations).toBe(100_000);
    expect(credential.version).toBe(1);
    expect(credential.saltHex).toMatch(/^[0-9a-f]{32}$/);
    expect(credential.hashHex).toMatch(/^[0-9a-f]{64}$/);
  });
});
