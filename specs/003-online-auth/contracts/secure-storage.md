# Contract — Secure storage wrapper

**Feature**: 003-online-auth
**Status**: Authoritative — the only module in the codebase that may call `expo-secure-store`.
**Implementation path**: `src/features/auth/storage/secureStore.ts`.

---

## Purpose

Give `authService` and the boot initializer a typed, narrow API over `expo-secure-store`. Centralising the secure-store calls in one file means:

- JSON encoding / decoding lives in exactly one place.
- The keychain accessibility options (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) are set once and cannot drift.
- FR-003 and FR-004 compliance (only the refresh token + email reach persistent storage; the password never does) can be audited by reading this single file.

---

## Keys

| Key name                       | Conceptual entity              | Set by                 | Deleted by                                        |
|--------------------------------|--------------------------------|------------------------|---------------------------------------------------|
| `'auth.refreshCredential'`     | `{ refreshToken, lastRefreshAtMs }` JSON | `authService.login`, `authService.refresh` | `authService.refresh` on rejection, `authService.logout`, bootstrap on 90-day TTL elapse |
| `'auth.lastEmail'`             | plain email string             | `authService.login`    | `authService.logout` only                         |

No other keys are used by this feature. Future auth-adjacent features (e.g., the §7 D6 local PIN) will add their own keys in their own storage wrapper and must not reuse these.

---

## Module shape

```ts
// src/features/auth/storage/secureStore.ts

export type RefreshCredential = {
  refreshToken: string;
  lastRefreshAtMs: number;
};

export const secureStore: {
  /**
   * Read the refresh credential.
   * - Returns null if the key is absent.
   * - Returns null if the stored value fails JSON.parse or schema validation
   *   (defensive: a corrupted entry is treated as "no credential" rather than
   *   throwing — the user will be prompted to re-login on the next network action).
   */
  getRefreshCredential(): Promise<RefreshCredential | null>;

  /**
   * Write the refresh credential. Overwrites any existing value.
   * Accessibility: WHEN_UNLOCKED_THIS_DEVICE_ONLY.
   */
  setRefreshCredential(credential: RefreshCredential): Promise<void>;

  /**
   * Delete the refresh credential. No-op if absent.
   */
  deleteRefreshCredential(): Promise<void>;

  /**
   * Read the last logged-in email. null if absent or corrupted.
   */
  getLastEmail(): Promise<string | null>;

  /**
   * Write the last logged-in email.
   */
  setLastEmail(email: string): Promise<void>;

  /**
   * Delete the last logged-in email. No-op if absent.
   */
  deleteLastEmail(): Promise<void>;
};
```

---

## Encoding rules

- `RefreshCredential` is JSON-encoded (`JSON.stringify`) before `setItemAsync`, and JSON-decoded on read.
- After `JSON.parse`, the wrapper validates:
  - `typeof parsed === 'object' && parsed !== null`
  - `typeof parsed.refreshToken === 'string' && parsed.refreshToken.length > 0`
  - `typeof parsed.lastRefreshAtMs === 'number' && Number.isFinite(parsed.lastRefreshAtMs)`
- Any validation failure yields `null` (not an exception). Rationale: a corrupted entry is indistinguishable from "no credential" for the purposes of deciding whether to show the Login screen; throwing would just crash the app at boot.

- `lastEmail` is stored as a plain string (not JSON-encoded) to keep the secure-store entry trivially inspectable during manual audits.

---

## Accessibility configuration

Every `setItemAsync` call passes:

```ts
{
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
}
```

Effect:

- **iOS**: Keychain entry is readable only while the device is unlocked, and is **not** backed up to iCloud. A restore of the iCloud backup to a new device will NOT carry the token across.
- **Android**: `expo-secure-store` routes through `EncryptedSharedPreferences`; the `this-device-only` semantics are the platform default for encrypted prefs when backup rules exclude the file.

---

## What the wrapper MUST NOT do

- **Must not** accept a `password` parameter on any method. There is no "store password" path by construction.
- **Must not** expose a generic `getItem(key: string)` / `setItem(key: string, value: string)` surface. The two-key, two-entity API is the entire surface.
- **Must not** write to `AsyncStorage`, `MMKV`, the WatermelonDB database, or any other store.
- **Must not** log the refresh-token value to the console, even in `__DEV__`. A warning that "a credential exists" is acceptable; the value itself is not.
- **Must not** be consumed from outside `src/features/auth/` — the Supabase client in `src/data/supabase.ts` uses this wrapper via the auth barrel, not directly.

---

## Error-handling contract

- `expo-secure-store` throws if the keychain is inaccessible (e.g., during a simulator reset). Those errors propagate out of `setRefreshCredential` / `setLastEmail` so `authService.login` can surface them as `AuthError('ACCOUNT_ISSUE')` to the user. The wrapper does NOT retry — one write attempt, one outcome.
- Read operations never throw to the caller: a platform error on read is treated as "entry absent" and the method returns `null`. The alternative (throwing) would deadlock the bootstrap initializer on broken devices.
