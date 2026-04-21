import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

import type { PinCredential } from '../storage/lockStorage';

import { generateSaltHex } from './random';

function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i] ?? 0;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Constant-time compare of two same-length hex strings. Returns true if equal,
 * false otherwise. Does NOT short-circuit on the first mismatch.
 */
function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const PBKDF2_ITERATIONS = 10_000;

export async function hashPin(
  pin: string,
  saltHex: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const pinBytes = utf8ToBytes(pin);
  const saltBytes = hexToBytes(saltHex);
  const derived = await pbkdf2Async(sha256, pinBytes, saltBytes, {
    c: iterations,
    dkLen: 32,
  });
  return bytesToHex(derived);
}

export async function verifyPinHash(
  pin: string,
  credential: PinCredential,
): Promise<boolean> {
  const recomputed = await hashPin(pin, credential.saltHex, credential.iterations);
  return constantTimeEqualHex(recomputed, credential.hashHex);
}

export async function createCredentialFromPin(pin: string): Promise<PinCredential> {
  const saltHex = await generateSaltHex(16);
  const hashHex = await hashPin(pin, saltHex, PBKDF2_ITERATIONS);
  return {
    algo: 'PBKDF2-HMAC-SHA256',
    iterations: PBKDF2_ITERATIONS,
    saltHex,
    hashHex,
    version: 1,
  };
}
