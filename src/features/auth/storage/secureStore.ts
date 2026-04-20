import * as SecureStore from 'expo-secure-store';

const KEY_REFRESH_CREDENTIAL = 'auth.refreshCredential';
const KEY_LAST_EMAIL = 'auth.lastEmail';

const WRITE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type RefreshCredential = {
  refreshToken: string;
  lastRefreshAtMs: number;
};

function isRefreshCredential(value: unknown): value is RefreshCredential {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.refreshToken === 'string' &&
    v.refreshToken.length > 0 &&
    typeof v.lastRefreshAtMs === 'number' &&
    Number.isFinite(v.lastRefreshAtMs)
  );
}

async function safeGetString(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export const secureStore = {
  async getRefreshCredential(): Promise<RefreshCredential | null> {
    const raw = await safeGetString(KEY_REFRESH_CREDENTIAL);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isRefreshCredential(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async setRefreshCredential(credential: RefreshCredential): Promise<void> {
    await SecureStore.setItemAsync(
      KEY_REFRESH_CREDENTIAL,
      JSON.stringify(credential),
      WRITE_OPTIONS,
    );
  },

  async deleteRefreshCredential(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY_REFRESH_CREDENTIAL);
    } catch {
      // idempotent — missing entry is acceptable
    }
  },

  async getLastEmail(): Promise<string | null> {
    const raw = await safeGetString(KEY_LAST_EMAIL);
    if (raw === null || raw.length === 0) return null;
    return raw;
  },

  async setLastEmail(email: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_LAST_EMAIL, email, WRITE_OPTIONS);
  },

  async deleteLastEmail(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY_LAST_EMAIL);
    } catch {
      // idempotent
    }
  },
};
