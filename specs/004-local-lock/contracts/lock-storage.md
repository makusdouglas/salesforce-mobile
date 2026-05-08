# Contract — Lock secure-storage wrapper

**Feature**: 004-local-lock
**Status**: Authoritative — the only module in the codebase that may call `expo-secure-store` with a `lock.*` key.
**Implementation path**: `src/features/lock/storage/lockStorage.ts`.

---

## Purpose

Give `lockService`, `lockBootstrap`, the settings control, and the 003 auth-logout integration point a typed, narrow API over `expo-secure-store` for two keys under the `lock.` namespace. Centralising the lock-feature secure-store calls in one file means:

- JSON encoding / decoding lives in exactly one place.
- The keychain accessibility options (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) are set once and cannot drift.
- 004 FR-004 compliance (only the salted hash reaches persistent storage; the plaintext PIN never does) is auditable in one file.
- 004 FR-018 compliance (PIN wipe on D5 logout) goes through a single exported `deletePinCredential()` function that `authService.logout()` imports.

---

## Keys

| Key name                           | Conceptual entity                  | Set by                                              | Deleted by                                                      |
|------------------------------------|------------------------------------|-----------------------------------------------------|-----------------------------------------------------------------|
| `'lock.pinCredential'`             | `PinCredential` JSON (see data-model) | `lockService.setupPin` (first-run or post-recovery) | `lockService.beginPinRecovery` (wipe before LoginScreen); `authService.logout()` via imported `deletePinCredential` |
| `'lock.inactivityTimeoutMinutes'`  | `{ minutes, version }` JSON        | `lockBootstrap()` (default pre-persist); `lockService.setInactivityTimeout()` | `lockService.setInactivityTimeout()` (never deleted outright — value is overwritten, not removed); app uninstall |

No other keys are used by this feature. If a future feature needs a new lock-adjacent key, it MUST either extend this wrapper (preferred if the key is semantically part of the lock state) or define its own feature-scoped storage wrapper with its own key prefix.

---

## Module shape

```ts
// src/features/lock/storage/lockStorage.ts

export type PinCredential = {
  algo: 'PBKDF2-HMAC-SHA256';
  iterations: 10000;
  saltHex: string;   // 32 hex chars (16 bytes)
  hashHex: string;   // 64 hex chars (32 bytes)
  version: 1;
};

export type InactivityPreference = {
  minutes: number;   // [1, 30]
  version: 1;
};

export const lockStorage: {
  /**
   * Read the PIN credential.
   * - Returns null if the key is absent.
   * - Returns null if the stored value fails JSON.parse, schema validation,
   *   field-length validation, or version === 1 check (defensive: a corrupted
   *   entry is treated as "no PIN set" rather than throwing — the salesperson
   *   will be routed to PinSetupScreen at next bootstrap).
   */
  getPinCredential(): Promise<PinCredential | null>;

  /**
   * Write the PIN credential. Overwrites any existing value.
   * Accessibility: WHEN_UNLOCKED_THIS_DEVICE_ONLY.
   */
  setPinCredential(credential: PinCredential): Promise<void>;

  /**
   * Read the inactivity preference.
   * - Returns null if the key is absent.
   * - Returns null if JSON.parse or validation fails (caller must fall back to default).
   * - `minutes` is clamped to [1, 30] on read; out-of-range stored values are
   *   repaired by returning the clamped value (NOT by rewriting — writes happen
   *   only via setInactivityPreference).
   */
  getInactivityPreference(): Promise<InactivityPreference | null>;

  /**
   * Write the inactivity preference. Overwrites any existing value.
   * Caller MUST clamp `minutes` to [1, 30] before calling (lockService does this).
   * Accessibility: WHEN_UNLOCKED_THIS_DEVICE_ONLY.
   */
  setInactivityPreference(preference: InactivityPreference): Promise<void>;
};

/**
 * Standalone export for the cross-feature auth → lock integration point (research R5).
 * Deletes the PIN credential. No-op if absent. Does NOT touch the inactivity preference.
 *
 * Imported by src/features/auth/service/authService.ts as part of logout side-effects.
 * This is the ONE legal cross-feature import from auth into the lock feature.
 */
export function deletePinCredential(): Promise<void>;
```

---

## Encoding rules

- `PinCredential` is JSON-encoded (`JSON.stringify`) before `setItemAsync`, and JSON-decoded on read.
- After `JSON.parse`, the wrapper validates:
  - `typeof parsed === 'object' && parsed !== null`
  - `parsed.algo === 'PBKDF2-HMAC-SHA256'`
  - `parsed.iterations === 10000`
  - `typeof parsed.saltHex === 'string' && /^[0-9a-f]{32}$/.test(parsed.saltHex)`
  - `typeof parsed.hashHex === 'string' && /^[0-9a-f]{64}$/.test(parsed.hashHex)`
  - `parsed.version === 1`
- Any validation failure yields `null`. Rationale: a corrupted entry is indistinguishable from "no PIN set" for the purposes of deciding whether to show PinSetupScreen; throwing would crash the app at boot.

- `InactivityPreference` is JSON-encoded. After parse, the wrapper validates:
  - `typeof parsed === 'object' && parsed !== null`
  - `typeof parsed.minutes === 'number' && Number.isFinite(parsed.minutes)`
  - `parsed.version === 1`
- `minutes` is clamped to `[1, 30]` on read: if stored value is outside the range, the method returns `{ minutes: clampedValue, version: 1 }` WITHOUT rewriting the store. Defensive against manual tampering and range migrations.
- Any non-object or missing-field failure yields `null`; caller falls back to the default.

---

## Accessibility configuration

Every `setItemAsync` call passes:

```ts
{
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
}
```

Effect:

- **iOS**: Keychain entry readable only while device is unlocked; NOT backed up to iCloud. An iCloud restore to a new device will NOT carry the PIN credential across.
- **Android**: `expo-secure-store` routes through `EncryptedSharedPreferences`; `this-device-only` semantics are the platform default for encrypted prefs with backup rules excluded.

This matches 003's choice for auth keys and keeps the enclave policy uniform across the feature family.

---

## What the wrapper MUST NOT do

- **Must not** accept a plaintext `pin` parameter on any method. There is no "store plaintext PIN" path by construction.
- **Must not** expose a generic `getItem(key: string)` / `setItem(key: string, value: string)` surface. The four-method + one-standalone-export API is the entire surface.
- **Must not** write to `AsyncStorage`, `MMKV`, the WatermelonDB database, or any other store.
- **Must not** log the `hashHex` or the `saltHex` to the console, even in `__DEV__`. A boolean "a PIN credential exists" is acceptable; the hash bytes themselves are not.
- **Must not** be consumed from outside `src/features/lock/` EXCEPT via the standalone `deletePinCredential()` export, which is imported only by `src/features/auth/service/authService.ts`. No other external import is legal.
- **Must not** touch `auth.*` keys — those belong to 003's `secureStore.ts` wrapper.

---

## Error-handling contract

- `expo-secure-store` throws if the keychain is inaccessible (e.g., a broken simulator). Those errors propagate out of `setPinCredential` / `setInactivityPreference` / `deletePinCredential` so `lockService.setupPin` (or its caller) can surface them as `LockError('STORAGE_UNAVAILABLE')` to the user. The wrapper does NOT retry — one write attempt, one outcome.
- Read operations never throw to the caller: a platform error on read is treated as "entry absent" and the method returns `null`. The alternative (throwing) would deadlock the bootstrap initializer on broken devices.
- `deletePinCredential()` is idempotent: calling it with no entry present succeeds silently. This matters for the auth-logout call site, which doesn't know whether a PIN was ever set.

---

## Summary

Two keys, five methods on the `lockStorage` object, one standalone `deletePinCredential` export for the cross-feature auth integration. All JSON-encoded, all `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, all defensively parsed into `null` on corruption. The wrapper is small enough (approximately 80–100 lines including the regexes) that a manual audit for FR-004 compliance is a one-minute read.
