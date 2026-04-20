import * as SecureStore from 'expo-secure-store';

const KEY_PIN_CREDENTIAL = 'lock.pinCredential';
const KEY_INACTIVITY = 'lock.inactivityTimeoutMinutes';

const WRITE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type PinCredential = {
  algo: 'PBKDF2-HMAC-SHA256';
  iterations: 100000;
  saltHex: string;
  hashHex: string;
  version: 1;
};

export type InactivityPreference = {
  minutes: number;
  version: 1;
};

const SALT_REGEX = /^[0-9a-f]{32}$/;
const HASH_REGEX = /^[0-9a-f]{64}$/;
const MIN_MINUTES = 1;
const MAX_MINUTES = 30;

function isPinCredential(value: unknown): value is PinCredential {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.algo === 'PBKDF2-HMAC-SHA256' &&
    v.iterations === 100000 &&
    typeof v.saltHex === 'string' &&
    SALT_REGEX.test(v.saltHex) &&
    typeof v.hashHex === 'string' &&
    HASH_REGEX.test(v.hashHex) &&
    v.version === 1
  );
}

function isInactivityPreference(value: unknown): value is InactivityPreference {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.minutes === 'number' && Number.isFinite(v.minutes) && v.version === 1
  );
}

function clampMinutes(n: number): number {
  const rounded = Math.round(n);
  return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, rounded));
}

async function safeGetString(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export const lockStorage = {
  async getPinCredential(): Promise<PinCredential | null> {
    const raw = await safeGetString(KEY_PIN_CREDENTIAL);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isPinCredential(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async setPinCredential(credential: PinCredential): Promise<void> {
    await SecureStore.setItemAsync(
      KEY_PIN_CREDENTIAL,
      JSON.stringify(credential),
      WRITE_OPTIONS,
    );
  },

  async getInactivityPreference(): Promise<InactivityPreference | null> {
    const raw = await safeGetString(KEY_INACTIVITY);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isInactivityPreference(parsed)) return null;
      return { minutes: clampMinutes(parsed.minutes), version: 1 };
    } catch {
      return null;
    }
  },

  async setInactivityPreference(preference: InactivityPreference): Promise<void> {
    await SecureStore.setItemAsync(
      KEY_INACTIVITY,
      JSON.stringify(preference),
      WRITE_OPTIONS,
    );
  },
};

export async function deletePinCredential(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_PIN_CREDENTIAL);
  } catch {
    // idempotent — missing entry is acceptable
  }
}
