# Contract — Biometric adapter

**Feature**: 004-local-lock
**Status**: Authoritative — the only module in the codebase that may call `expo-local-authentication`.
**Implementation path**: `src/features/lock/biometric/biometricAdapter.ts`.

---

## Purpose

Wrap `expo-local-authentication` in a minimal, testable surface. The adapter hides every native-API detail behind a two-method contract so `lockService.unlockWithBiometric()` and `LockScreen` are reasoning about a discriminated union, not a platform SDK.

The adapter is the ONE place that may `import * from 'expo-local-authentication'`. Every other file that needs biometrics imports `biometricAdapter`.

---

## Module shape

```ts
// src/features/lock/biometric/biometricAdapter.ts

export type BiometricResult = 'success' | 'failed' | 'cancelled' | 'unavailable';

export const biometricAdapter: {
  /**
   * Returns true when the device has biometric hardware AND the user has enrolled at least one
   * biometric credential in the OS. Used by LockScreen on mount to decide whether to invoke the
   * prompt at all (FR-006).
   *
   * Implementation: await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync().
   * Cached for the duration of the session — the OS API is synchronous enough that we can call on mount
   * without caching, but LockScreen may be remounted many times in a session, so a module-level
   * memoized boolean is a reasonable cheap win.
   *
   * Cache invalidation: none. If the salesperson enrolls biometrics while the app is running, the
   * next cold launch will pick it up. In-app enrollment detection is out of MVP scope.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Invoke the OS biometric prompt with a Portuguese label.
   *
   * Returns:
   *   - 'success'      → the OS verified the biometric against an enrolled credential.
   *   - 'failed'       → the OS rejected the verification (wrong finger, partial match, sensor didn't read).
   *   - 'cancelled'    → the user dismissed the prompt (tapped "use PIN", tapped "Cancel", or iOS fallback-to-pw was shown and dismissed).
   *   - 'unavailable'  → hardware/enrollment missing (checked before or at prompt time), OS-level biometric lockout (too many failed attempts at the OS level), or any other non-cancellation failure the OS reports.
   *
   * Never throws on the happy / expected-failure paths. Wraps unexpected throws from the OS API
   * (which are rare in practice) into `'unavailable'`.
   */
  authenticate(options: {
    promptMessage: string;   // e.g. "Desbloqueie para acessar o catálogo"
    cancelLabel: string;     // e.g. "Usar PIN"
  }): Promise<BiometricResult>;
};
```

---

## Configuration passed to `LocalAuthentication.authenticateAsync`

```ts
await LocalAuthentication.authenticateAsync({
  promptMessage: options.promptMessage,
  cancelLabel: options.cancelLabel,
  disableDeviceFallback: true,       // research R1 — the OS PIN is NOT a valid fallback, our app PIN is.
  fallbackLabel: undefined,          // no device-PIN fallback → no fallback label.
  requireConfirmation: false,        // iOS only; Face ID should unlock on a look, not require an explicit tap.
});
```

**Why `disableDeviceFallback: true`**: constitution §7 D6 explicitly states that biometrics is the preferred path and an *app-specific* PIN is the mandatory fallback. If we left device fallback enabled, a lost device with a known OS PIN would unlock the app with the OS PIN — bypassing our PIN entirely. That is not what D6 mandates.

**Why `requireConfirmation: false`**: matches the UX spec's "under 3 seconds on cold launch with biometrics enrolled" success criterion (SC-002). Requiring a confirmation tap on Face ID would add ~1 second per unlock.

---

## Result mapping from `expo-local-authentication` → `BiometricResult`

`expo-local-authentication`'s `authenticateAsync` resolves with `{ success: boolean, error?: string, warning?: string }`.

| Upstream result                                                                 | `BiometricResult` |
|---------------------------------------------------------------------------------|-------------------|
| `{ success: true }`                                                             | `'success'`       |
| `{ success: false, error: 'user_cancel' }`                                      | `'cancelled'`     |
| `{ success: false, error: 'system_cancel' }`                                    | `'cancelled'`     |
| `{ success: false, error: 'app_cancel' }`                                       | `'cancelled'`     |
| `{ success: false, error: 'user_fallback' }`                                    | `'cancelled'`     |
| `{ success: false, error: 'authentication_failed' }`                            | `'failed'`        |
| `{ success: false, error: 'lockout' }`                                          | `'unavailable'`   |
| `{ success: false, error: 'not_available' }`                                    | `'unavailable'`   |
| `{ success: false, error: 'not_enrolled' }`                                     | `'unavailable'`   |
| `{ success: false, error: 'passcode_not_set' }`                                 | `'unavailable'`   |
| `{ success: false, error: 'no_space' }` / any other unrecognised code           | `'unavailable'`   |
| Thrown exception                                                                 | `'unavailable'`   |

**Rationale for `user_fallback` → `cancelled`**: when `disableDeviceFallback: true`, `user_fallback` is rare, but if it surfaces it means the user explicitly chose the fallback path — which is our PIN screen. Treating it as cancellation routes them there.

---

## What the adapter MUST NOT do

- **Must not** read or write secure store. It is purely an OS-API wrapper.
- **Must not** read or write the lockStore. State transitions happen in `lockService` based on the adapter's return value.
- **Must not** call `expo-local-authentication.supportedAuthenticationTypesAsync()` — we don't branch on "is it Face ID vs Touch ID"; one prompt UI covers both.
- **Must not** prompt for a non-Portuguese label. The screen passes the Portuguese string via `options.promptMessage`; the adapter does not inject copy.
- **Must not** retry on transient failures. One call, one result. The LockScreen decides whether and how to offer a retry.

---

## Testing note

Per research R10, `biometricAdapter` is NOT unit-tested. Its entire purpose is to abstract the OS API behind a discriminated union; a unit test would either mock `expo-local-authentication` (zero signal — we'd be asserting our own mock) or require a real device (out of scope for the MVP test harness). Manual verification against the acceptance scenarios in [spec.md](../spec.md) (US1 scenarios 3–5, US2 scenario 1, and the edge cases around biometric unavailability / OS-level lockout) is the test.
