# Data Model — Mandatory Local Lock

**Feature**: 004-local-lock
**Date**: 2026-04-20
**Status**: No persistent schema changes. This feature introduces two **secure-store** entries and one **in-memory** state entity. WatermelonDB is untouched. 003's secure-store entries are untouched.

---

## Scope note

Same scope note as 003's data-model: the entities below are NOT WatermelonDB tables. They are:

- **Persistent lock state** — lives in `expo-secure-store` under the `lock.*` namespace, disjoint from 003's `auth.*` namespace.
- **Runtime lock state** — lives in memory, event-emitter-backed, gone when the process is killed.

These entities MUST NOT be added to [specs/002-local-data-layer/data-model.md](../002-local-data-layer/data-model.md) nor to [specs/003-online-auth/data-model.md](../003-online-auth/data-model.md).

---

## Persistent entities (secure store)

### 1. `lock.pinCredential` — the hashed PIN

**Storage**: `expo-secure-store`, key `lock.pinCredential`, accessibility `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.

**Payload** (JSON-encoded string):

```ts
type PinCredential = {
  algo: 'PBKDF2-HMAC-SHA256';
  iterations: 10000;
  saltHex: string;   // 32 hex chars (16 bytes) — per-device random salt from expo-crypto.getRandomBytesAsync(16)
  hashHex: string;   // 64 hex chars (32 bytes) — PBKDF2 derived-key output, dkLen = 32
  version: 1;        // schema version; lets future changes migrate without nuking existing devices
};
```

| Field        | Type                      | Notes |
|--------------|---------------------------|-------|
| `algo`       | `'PBKDF2-HMAC-SHA256'`    | String literal. Enforces one-algorithm-at-a-time; future versions bump the string AND the version number. |
| `iterations` | `10000`                   | Integer literal for version 1. Chosen for pure-JS UX budget (~2–3 s derivation); see research R2. Future migrations may raise this if native PBKDF2 lands. |
| `saltHex`    | `string` (32 hex chars)   | Base-16-encoded 16-byte random value; unique per device per PIN. |
| `hashHex`    | `string` (64 hex chars)   | Base-16-encoded 32-byte derived key. Never logged. |
| `version`    | `1`                       | Integer literal; used by `lockStorage.getPinCredential()` for forward-compatible parsing. |

**Lifecycle**:

| Event                                  | Action on this entry |
|----------------------------------------|----------------------|
| Fresh install                          | Not present. |
| Post-login first-run (FR-001)          | Not present until the salesperson completes PinSetupScreen — THEN this entry is created. |
| PIN setup success (FR-004)             | Created with a freshly generated salt + hash. |
| PIN verify success (unlock path)       | Unchanged. |
| PIN verify failure                     | Unchanged. Failed-attempt counter (in-memory) increments; see §3 below. |
| PIN recovery begin (FR-015, R8)        | **Deleted** before any network call, BUT only AFTER the offline check passes — if offline, stays in place and recovery UI shows "connect to internet". |
| PIN recovery complete (FR-015)         | Created fresh with a new salt and hash. |
| `authService.logout()` (any caller, 003 FR-011 + 004 FR-018) | **Deleted** as an atomic side-effect of logout; the auth feature imports `lockStorage.deletePinCredential()` and calls it as part of the logout side-effect chain (research R5). |
| App uninstall                          | Deleted by the OS as part of the secure-store wipe. |

**Invariants**:

- While present, all four string fields (`algo`, `saltHex`, `hashHex`, `version` parses to 1) are set; a failed parse returns `null` and is treated as "no PIN set" for FR-005 purposes.
- `saltHex.length === 32`; `hashHex.length === 64`. A payload that parses but fails these invariants returns `null` from the storage wrapper.
- There is never a partial payload (e.g., salt written but hash missing). `setItemAsync` writes the whole JSON string atomically.

---

### 2. `lock.inactivityTimeoutMinutes` — the preference

**Storage**: `expo-secure-store`, key `lock.inactivityTimeoutMinutes`, accessibility `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (co-located with the PIN credential so the lock feature has a single storage wrapper; it is NOT a secret).

**Payload** (JSON-encoded string):

```ts
type InactivityPreference = {
  minutes: number;   // integer, clamped to [1, 30]; default 5
  version: 1;
};
```

| Field      | Type               | Notes |
|------------|--------------------|-------|
| `minutes`  | `number` (integer) | Range [1, 30]. Values outside the range returned by the storage wrapper are clamped to the nearest valid value on read (defensive against manual tampering and future-range migrations). |
| `version`  | `1`                | Reserved for schema evolution. |

**Lifecycle**:

| Event                                  | Action on this entry |
|----------------------------------------|----------------------|
| Fresh install                          | Not present. |
| First boot after fresh install, before the salesperson adjusts anything | Pre-persisted by `lockBootstrap()` with `{ minutes: 5, version: 1 }` so the in-memory value and the persisted value are always in sync (research R7). |
| Salesperson saves a new value from the settings control (FR-010) | Overwritten with the new `{ minutes, version }`. The in-memory tracker is notified synchronously and the next background-and-return cycle uses the new value. |
| `authService.logout()` | **Preserved.** The preference is a UX choice, not tied to a session. On the next login, the same preference applies. |
| PIN recovery | **Preserved.** Orthogonal to the PIN. |
| App uninstall | Deleted by the OS. |

**Invariants**:

- While present, `1 <= minutes <= 30`.
- `version === 1` for this spec; future migrations may bump.

---

## In-memory runtime entity

### 3. `Lock` — the live lock state

**Storage**: module-level singleton in `src/features/lock/state/lockStore.ts`. A tiny event emitter (same pattern as 003's `sessionStore`) notifies subscribers on every public transition. Wiped on process kill.

**Shape**:

```ts
type LockStatus = 'NotSet' | 'Locked' | 'Unlocked';

type LockSnapshot = {
  status: LockStatus;
};

// Internal state — NOT exposed via useLock() or the public snapshot.
type InternalLockState = {
  status: LockStatus;

  // When non-null, the wall-clock timestamp at which the app last transitioned to background.
  // Populated on 'active → background | inactive' AppState transitions; cleared on 'background | inactive → active'
  // *after* the elapsed-vs-timeout check has been evaluated.
  backgroundedAtMs: number | null;

  // Consecutive wrong PIN attempts in the current session. Resets on successful unlock and on cold launch.
  // Biometric failures do NOT count here.
  failedAttempts: number;

  // Cached copy of the inactivity preference. Re-read from storage on bootstrap and on settings updates.
  // Source of truth for the AppState handler's lock decision.
  inactivityTimeoutMinutes: number;
};
```

**State transitions** (public `status` only; internal flags evolve on every transition per the diagram below):

```text
                       ┌────────────────┐
      ┌───────────────►│    NotSet       │◄──────────────┐
      │                └────┬───────────┘                │
      │                     │                            │
      │     lockService.setupPin(pin)                    │
      │     (FR-001..004)                                │
      │                     │                            │
      │                     ▼                            │
      │                ┌────────────────┐                │
      │                │    Unlocked    │                │
      │                └───┬─────────┬──┘                │
      │                    │         │                   │
      │   inactivity       │         │   authService.logout({ preserveEmail?: boolean })
      │   .expired()       │         │   OR lockService.beginPinRecovery()
      │                    │         │
      │                    ▼         ▼
      │                ┌────────────────┐       (session flips to NotAuthenticated;
      │                │    Locked      │        RootNavigator unmounts LockGate)
      │                └───┬────────────┘                │
      │                    │                             │
      │   unlockWithBiometric()                          │
      │   OR verifyPin(correct)                          │
      │                    │                             │
      │                    ▼                             │
      │                Unlocked                          │
      │                                                  │
      └──────────────────────────────────────────────────┘
   (NotSet is re-entered after logout or PIN recovery completes, and leaves again
    via setupPin() into Unlocked.)
```

**Transitions reference**:

| Transition                       | Trigger                                                     | Internal side effects                                                                                        |
|----------------------------------|-------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| (boot)  → NotSet                 | `lockBootstrap()` finds no `lock.pinCredential`             | `backgroundedAtMs = null`; `failedAttempts = 0`; `inactivityTimeoutMinutes` hydrated from preference.        |
| (boot)  → Locked                 | `lockBootstrap()` finds a valid `lock.pinCredential`        | Same flags as above. The lock gate renders LockScreen immediately.                                           |
| NotSet → Unlocked                | `lockService.setupPin(pin)` resolves                        | Writes `lock.pinCredential`; flags unchanged.                                                                |
| Unlocked → Locked                | AppState-driven inactivity expiry (R4)                      | `backgroundedAtMs` is cleared AFTER the decision (see R4).                                                   |
| Locked → Unlocked                | `lockService.unlockWithBiometric()` resolves `'success'`    | `failedAttempts = 0`. Biometric does not touch the counter.                                                  |
| Locked → Unlocked                | `lockService.verifyPin(pin)` returns true                   | `failedAttempts = 0`.                                                                                         |
| Locked → Locked                  | `lockService.verifyPin(pin)` returns false                  | `failedAttempts++`. If the new value is 10, the UI routes to PinRecoveryConfirmScreen (FR-016).              |
| Unlocked → NotSet                | `authService.logout()` side-effect wipes `lock.pinCredential` | Triggered from the auth layer per R5.                                                                       |
| Locked → NotSet                  | `lockService.beginPinRecovery()` online-check passes and wipes `lock.pinCredential` | Followed immediately by a session invalidation that preserves `auth.lastEmail`; LockGate unmounts as session goes NotAuthenticated. |

**Invariants**:

- `status === 'NotSet'` ⇒ `lock.pinCredential` is absent in secure store (and vice versa).
- `status === 'Locked'` ⇒ `lock.pinCredential` is present.
- `status === 'Unlocked'` ⇒ `lock.pinCredential` is present. (The only path to `Unlocked` from `NotSet` passes through a setup that writes the credential.)
- `backgroundedAtMs !== null` only between a `→ background` AppState event and the next `→ active` event. Never persisted.
- `failedAttempts` is cleared on a successful unlock and on every cold launch; it is NEVER persisted.
- Public-snapshot `status` is the only property on which React consumers branch. Internal flags are invisible to `useLock()`.

---

## Password / PIN — what is NOT persisted

Per FR-004 (004 spec), the plaintext PIN:

- Lives only in the `PinSetupScreen` / `LockScreen` controlled input state (React `useState`).
- Is passed once to `lockService.setupPin(pin)` or `lockService.verifyPin(pin)`.
- Is `''`'d from the input on successful transition AND on navigation away.
- Is NEVER written to secure store, AsyncStorage, logs, analytics events, or telemetry.
- Is NEVER included in any error object that crosses the module boundary — `LockError` carries a code, not the PIN value.

**Audit trail**: SC-007 is the acceptance test — a filesystem and secure-store audit immediately after PIN setup finds the PIN present only in hashed form.

---

## Relationship diagram (ASCII)

```text
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                              process memory                                 │
  │                                                                             │
  │   ┌──────────────────┐   subscribes via   ┌───────────┐                     │
  │   │   Lock state     │◄──────────────────►│  useLock  │                     │
  │   │  (event emitter) │                    │    hook   │                     │
  │   └─────┬────────────┘                    └───────────┘                     │
  │         │                                                                   │
  │         │ reads/writes                                                      │
  │         ▼                                                                   │
  │   ┌──────────────────┐          calls            ┌─────────────────────┐    │
  │   │  lockService     ├──────────────────────────►│ biometricAdapter    │    │
  │   │                  │                           │ (expo-local-auth)   │    │
  │   │                  ├──────────────────────────►│ pinHash (@noble)    │    │
  │   │                  ├──────────────────────────►│ random (expo-crypto)│    │
  │   └─────┬────────────┘                           └─────────────────────┘    │
  │         │                                                                   │
  │         │ reads/writes ▼                                                    │
  │   ┌──────────────────┐                                                      │
  │   │  lockStorage.ts  │ (typed wrapper)                                      │
  │   └─────┬────────────┘                                                      │
  │         │                                                                   │
  │         │   integration with 003:                                           │
  │         │     authService.logout()                                          │
  │         │       calls lockStorage.deletePinCredential()                     │
  │         │       (directional dependency; see plan.md Structure Decision)    │
  └─────────┼──────────────────────────────────────────────────────────────────┘
            │ set/get/delete
            ▼
  ┌─────────────────────────────────────────────────┐
  │     OS secure enclave (Keychain /               │
  │     EncryptedSharedPreferences)                 │
  │                                                 │
  │   003's keys (unchanged):                       │
  │     auth.refreshCredential                      │
  │     auth.lastEmail                              │
  │                                                 │
  │   004's keys (NEW):                             │
  │     lock.pinCredential                          │
  │     lock.inactivityTimeoutMinutes               │
  └─────────────────────────────────────────────────┘
```

---

## Summary

- **2 persistent entries** in secure store under the `lock.*` namespace, with distinct lifecycles (PIN deleted on logout and recovery; preference preserved across both).
- **1 in-memory lock state** with a 3-status state machine plus three internal flags (`backgroundedAtMs`, `failedAttempts`, `inactivityTimeoutMinutes`).
- **1 ephemeral entity** (the plaintext PIN) that is forbidden from ever touching persistent storage.
- **0 WatermelonDB changes.** Block 002's schema is untouched.
- **0 new business entities.** Constitution R2's "exactly 7 entities" invariant holds.
- **0 changes to 003's persistent entities.** `auth.refreshCredential` and `auth.lastEmail` retain their existing lifecycles; the only touch is an optional `preserveEmail: true` parameter on `authService.logout()`, which is a behavior shift for a single caller — the lock feature's PIN-recovery path — and leaves the default behavior of 003 intact.
