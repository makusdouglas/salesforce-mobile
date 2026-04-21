# Contract — `lockService` API surface

**Feature**: 004-local-lock
**Status**: Authoritative — every caller of lock logic (screens, `LockProvider`, `LockGate`, tests, and the 003 integration point) consumes this surface.
**Import path**: `@/features/lock` (barrel); implementation at `src/features/lock/service/lockService.ts`.

---

## Import contract

```ts
import {
  lockService,
  useLock,
  LockProvider,
  LockGate,
  LockError,
  PinSetupScreen,
  LockScreen,
  PinRecoveryConfirmScreen,
  type LockStatus,
  type LockSnapshot,
  type LockErrorCode,
} from '@/features/lock';
```

Everything else inside `src/features/lock/` is internal — the lock store, lockStorage, pinHash, biometricAdapter, random, bootstrap, inactivity tracker, PinPad component are NOT re-exported from the barrel.

**Cross-feature import from auth → lock**: the 003 `authService.logout()` imports ONE narrow function from `@/features/lock/storage` (NOT from the public barrel) to perform the atomic PIN wipe:

```ts
// Only legal cross-feature import from auth to lock.
import { deletePinCredential } from '@/features/lock/storage/lockStorage';
```

This directional coupling is by design (plan.md Structure Decision, research R5). No other auth module may import anything from the lock feature.

---

## `lockService` shape

```ts
const lockService: {
  /**
   * First-run PIN setup. MUST be called only from PinSetupScreen's confirm step
   * (after two-step entry match has been verified locally).
   *
   * On success:
   *   - Generates a 16-byte random salt via expo-crypto.
   *   - Derives the PBKDF2-HMAC-SHA256 hash (10_000 iterations, dkLen=32).
   *   - Persists { algo, iterations, saltHex, hashHex, version: 1 } to lock.pinCredential.
   *   - Transitions lockStore NotSet → Unlocked.
   *
   * On rejection: throws LockError with code PIN_INVALID_LENGTH or (very rarely) secure-store write failure.
   * Lock state is NOT modified on rejection.
   *
   * The plaintext PIN is held in memory only for the duration of this call.
   */
  setupPin(pin: string): Promise<void>;

  /**
   * Verify a PIN against the stored hash. Called from LockScreen's PIN-pad submit handler.
   *
   * Returns true on match, false on mismatch.
   * Progressive delay (research R6) is enforced by LockScreen gating THIS method's invocation, not
   * by the service — the service has no notion of "wait before I can try again". It just hashes
   * and compares. The screen reads lockStore's failedAttempts after a false return and decides
   * whether to show a countdown, or to route to recovery when the count reaches 10.
   *
   * On true:
   *   - Resets failedAttempts to 0.
   *   - Transitions lockStore Locked → Unlocked.
   *
   * On false:
   *   - Increments failedAttempts.
   *   - Lock state stays Locked.
   *
   * Errors: throws LockError('PIN_INVALID_LENGTH') if the PIN is not 4–6 digits.
   * Throws LockError('TOO_MANY_ATTEMPTS') if called when failedAttempts is already >= 10 — the
   * screen MUST NOT call this in that case, but the service guards defensively.
   */
  verifyPin(pin: string): Promise<boolean>;

  /**
   * Attempt biometric unlock. Invoked by LockScreen on mount (when status === 'Locked' and
   * biometric is available/enrolled) and optionally on a "try biometric again" button tap.
   *
   * Returns one of:
   *   - 'success'      → lockStore transitions Locked → Unlocked; failedAttempts stays 0 (biometric does not touch counter).
   *   - 'failed'       → biometric attempted but rejected; caller (LockScreen) falls through to the PIN pad.
   *   - 'cancelled'    → user dismissed the OS prompt; caller falls through to the PIN pad.
   *   - 'unavailable'  → hardware absent, no enrollment, or OS-level biometric lockout; caller shows the PIN pad directly with no biometric retry.
   *
   * Never throws on the happy / expected-failure paths; only throws if the OS API itself
   * throws (wrapped as LockError('BIOMETRIC_UNAVAILABLE')).
   */
  unlockWithBiometric(): Promise<'success' | 'failed' | 'cancelled' | 'unavailable'>;

  /**
   * Begin the "Forgot PIN" recovery flow. Invoked from PinRecoveryConfirmScreen after the
   * online-check has succeeded (the UI blocks until NetInfo reports connectivity).
   *
   * Steps (in order, all failures halt the flow before any destructive action):
   *   1. Re-check connectivity one more time (defense in depth). If offline, throw LockError('RECOVERY_OFFLINE').
   *   2. lockStorage.deletePinCredential() — wipe the PIN.
   *   3. authService.logout({ preserveEmail: true }) — wipe refresh token, preserve lastEmail.
   *   4. The session state machine transitions to NotAuthenticated. RootNavigator observes
   *      this and unmounts LockGate; the user sees LoginScreen (003) with the email pre-filled.
   *
   * After the salesperson completes LoginScreen, the session transitions back to Authenticated,
   * LockGate is re-mounted, lockStore.status === 'NotSet' (because step 2 wiped the PIN), and
   * PinSetupScreen appears. A subsequent setupPin() completes the recovery.
   *
   * This function returns after step 3 completes; no promise awaits the eventual re-login +
   * re-setup. Those are navigation-driven events.
   */
  beginPinRecovery(): Promise<void>;

  /**
   * Update the inactivity timeout preference.
   *
   * - Clamps `minutes` to the allowed [1, 30] range before persisting.
   * - Writes lock.inactivityTimeoutMinutes.
   * - Updates the in-memory value used by the AppState handler on the next transition.
   *
   * Does not change the lock status.
   */
  setInactivityTimeout(minutes: number): Promise<void>;

  /**
   * Read the current inactivity timeout preference (in minutes).
   * Returns the in-memory value, which is always hydrated from storage at bootstrap and kept in sync.
   */
  getInactivityTimeout(): number;
};
```

---

## `useLock()` — the React hook

```ts
function useLock(): {
  status: LockStatus;  // 'NotSet' | 'Locked' | 'Unlocked'
};
```

Backed by `useSyncExternalStore` with `lockStore.subscribe` + `lockStore.getSnapshot`. Concurrent-mode-safe. Returns a stable reference per emitted snapshot. Internal flags (`backgroundedAtMs`, `failedAttempts`, `inactivityTimeoutMinutes`) are NOT exposed on the hook result; screens that need `failedAttempts` for the progressive-delay display read it through a separate `useLockFailedAttempts()` hook (NOT exported from the barrel — it is an internal hook consumed only by `LockScreen`).

---

## `LockProvider`

```tsx
<SessionProvider>
  <LockProvider>
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  </LockProvider>
</SessionProvider>
```

`LockProvider`:

- Runs `lockBootstrap()` exactly once on mount.
- Starts the `AppState` subscription via `startInactivityListener()`.
- Gates its children render on a `bootstrapped` flag; returns `null` until bootstrap completes (same pattern as 003's `SessionProvider`).
- Tears down the `AppState` subscription on unmount (normally never — wraps the tree).

It does NOT inject a React Context. `useLock()` reads directly from `lockStore`. The Provider exists for lifecycle scoping only.

---

## `LockGate` — the render gate

```tsx
<LockGate>
  <HomeStack />
</LockGate>
```

`LockGate`:

- Reads `lockStore.status` via `useLock()`.
- If `'NotSet'` → renders `<PinSetupScreen />`.
- If `'Locked'` → renders `<LockScreen />`.
- If `'Unlocked'` → renders `children`.

It is placed by `RootNavigator` inside the conditional that branches on the session status:

```tsx
{authenticated ? (
  <Stack.Screen name="Home">
    {() => (
      <LockGate>
        <HomeStack />
      </LockGate>
    )}
  </Stack.Screen>
) : (
  <Stack.Screen name="Auth" component={AuthStack} />
)}
```

The `Relogin` modal stays at the root stack level, unchanged from 003.

---

## `LockError`

```ts
class LockError extends Error {
  readonly code:
    | 'PIN_INVALID_LENGTH'      // PIN passed to setupPin/verifyPin is not 4–6 digits
    | 'PIN_MISMATCH'            // internal helper — used by PinSetupScreen when confirm step doesn't match
    | 'BIOMETRIC_UNAVAILABLE'   // hardware absent, no enrollment, OR OS-level biometric lockout
    | 'BIOMETRIC_FAILED'        // OS reported a biometric verification failure (not cancellation)
    | 'RECOVERY_OFFLINE'        // beginPinRecovery() called while offline
    | 'TOO_MANY_ATTEMPTS'       // verifyPin() called when failedAttempts >= 10
    | 'STORAGE_UNAVAILABLE';    // expo-secure-store threw (rare)

  constructor(code: LockError['code'], message?: string);
}
```

- Never carries the plaintext PIN.
- Never carries raw OS-level error payloads.
- The `code` field is the only contract callers depend on; `message` is a developer-facing hint.

---

## Error-code → UX-copy mapping (for PinSetupScreen / LockScreen / PinRecoveryConfirmScreen)

| `LockError.code`         | Portuguese message on screen                                                       | Where |
|--------------------------|-------------------------------------------------------------------------------------|-------|
| `PIN_INVALID_LENGTH`     | "PIN deve ter de 4 a 6 dígitos."                                                    | PinSetupScreen |
| `PIN_MISMATCH`           | "Os PINs não coincidem. Tente novamente."                                           | PinSetupScreen confirm step |
| `BIOMETRIC_UNAVAILABLE`  | *(silent — LockScreen goes directly to PIN pad with no message)*                    | LockScreen |
| `BIOMETRIC_FAILED`       | *(silent — LockScreen falls through to PIN pad; the salesperson saw the OS prompt fail)* | LockScreen |
| `RECOVERY_OFFLINE`       | "Conecte-se à internet para redefinir seu PIN."                                     | PinRecoveryConfirmScreen |
| `TOO_MANY_ATTEMPTS`      | *(shown as "Muitas tentativas. Redefinir PIN pelo login." with auto-routing)*       | LockScreen |
| `STORAGE_UNAVAILABLE`    | "Erro no armazenamento seguro. Reinstale o app se o erro persistir."                | Any |

The screen module owns the exact strings; this table is the behavior contract.

---

## Invariants enforced by `lockService`

1. **Plaintext PIN never leaves the service boundary.** `setupPin` and `verifyPin` accept a plaintext string; no other method does. The string is never returned, never included in errors, never logged, never persisted.
2. **The lockStore is the only state source** that screens read. `lockService` methods update the store as part of their implementation; screens do not mutate the store directly.
3. **`beginPinRecovery()` is the only path that calls `authService.logout({ preserveEmail: true })`.** No other code in the codebase may pass `preserveEmail: true` — the flag exists solely for this flow, and review should reject any new caller.

---

## What `lockService` MUST NOT do

- **Must not** read or write WatermelonDB business repositories.
- **Must not** persist the plaintext PIN to any store.
- **Must not** persist `failedAttempts` or `backgroundedAtMs` to disk.
- **Must not** surface any UI directly — it is a pure logic module. UI reactions happen via `useLock()` in the screen layer.
- **Must not** be constructed — it is a module-level object; there is no `new LockService()` and no DI.
- **Must not** call the Supabase client directly. All network concerns route through `authService` per R8.
- **Must not** import from `@/features/auth`'s non-barrel internals. Only `authService.logout` is imported (from the barrel) and only by `beginPinRecovery()`.
