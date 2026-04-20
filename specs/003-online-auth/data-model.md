# Data Model — Online-One-Time Authentication

**Feature**: 003-online-auth
**Date**: 2026-04-20
**Status**: No persistent schema changes. This feature introduces two **secure-store** entries and one **in-memory** state entity. WatermelonDB is untouched.

---

## Scope note

This is an *authentication* feature, not a *data* feature in the WatermelonDB sense. The entities below are NOT WatermelonDB tables and MUST NOT be added to [specs/002-local-data-layer/data-model.md](../002-local-data-layer/data-model.md). They are:

- **Persistent auth state** — lives in `expo-secure-store` (Keychain / EncryptedSharedPreferences), outside the application database.
- **Runtime session state** — lives in memory, event-emitter-backed, gone when the process is killed.

---

## Persistent entities (secure store)

### 1. `auth.refreshCredential` — the long-lived credential

**Storage**: `expo-secure-store`, key `auth.refreshCredential`, accessibility `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.

**Payload** (JSON-encoded string):

```ts
type RefreshCredential = {
  refreshToken: string;       // the Supabase refresh token
  lastRefreshAtMs: number;    // unix ms timestamp of the last successful auth (login or refresh)
};
```

| Field             | Type   | Notes |
|-------------------|--------|-------|
| `refreshToken`    | string | Opaque string from Supabase. Never logged, never telemetered. |
| `lastRefreshAtMs` | number | `Date.now()` at login time, updated on every successful silent refresh. Used for the client-side 90-day TTL check (research R11). |

**Lifecycle**:

| Event                                  | Action on this entry |
|----------------------------------------|----------------------|
| Fresh install                          | Not present. |
| Login success (`FR-002`)               | Created with Supabase's refresh token + `Date.now()`. |
| Silent refresh success (`FR-006`)      | `refreshToken` replaced with rotated token (if Supabase rotated it); `lastRefreshAtMs` bumped. |
| Silent refresh rejected (`FR-008`)     | **Deleted.** The token is useless. |
| 90-day TTL elapsed, detected at boot (`FR-009`, research R11) | **Deleted.** |
| Logout (`FR-011`)                      | **Deleted.** |

**Invariants**:

- While present, `refreshToken` is a non-empty string.
- While present, `now - lastRefreshAtMs <= 90 days`; otherwise the boot initializer deletes it (research R11).

---

### 2. `auth.lastEmail` — the pre-fill convenience

**Storage**: `expo-secure-store`, key `auth.lastEmail`, accessibility `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (co-located with the credential for one-call "wipe all auth state", not because the email is a secret).

**Payload** (plain string, not JSON-encoded):

```ts
type LastEmail = string;   // e.g. "salesperson@example.com"
```

**Lifecycle**:

| Event                                  | Action on this entry |
|----------------------------------------|----------------------|
| Fresh install                          | Not present. |
| Login success                          | Written (replaces any previous value). |
| Silent refresh success                 | Unchanged. |
| Silent refresh rejected                | **Preserved** (used by FR-018 to pre-fill the Relogin screen). |
| 90-day TTL elapsed                     | **Preserved** (pre-fill convenience for the Login screen — `FR-017`). |
| Logout                                 | **Deleted** (per implicit spec intent — once the user signals "I'm done on this device", the next Login is clean). |

**Note on privacy**: The email address is technically not a secret but is co-located with the refresh credential because secure-store access is already brokered by the OS-level enclave. There is no observable user-facing difference between storing it here vs. in AsyncStorage; the single-key-family wipe on logout is what makes this worthwhile.

---

## In-memory runtime entity

### 3. `Session` — the live session state

**Storage**: module-level singleton in `src/features/auth/session/session.ts`. A tiny event emitter notifies subscribers on every change. Wiped on process kill.

**Shape**:

```ts
type SessionStatus = 'NotAuthenticated' | 'Authenticated' | 'RequiresRelogin';

type Session = {
  status: SessionStatus;

  // Populated when status === 'Authenticated' (and sometimes 'RequiresRelogin', because we keep
  // the email for the re-login prompt).
  email: string | null;

  // In-memory only — lost on cold start, recovered by silent refresh. Never written to disk (FR-020).
  accessToken: string | null;
  accessTokenExpiresAtMs: number | null;

  // Internal flags — used by state machine logic, not exposed on the `useSession()` hook result.
  _isRefreshing: boolean;    // a silent refresh is in flight; next requireSession() should await it
  _queuedSync: boolean;      // a refresh-rejection occurred while a sync was pending (FR-008b);
                             // re-login success (FR-010) MUST clear this and re-trigger the sync.
};
```

**State transitions**:

```text
               ┌───────────────────────────────┐
               │        NotAuthenticated       │
               │  (email is null OR preserved) │
               └──────┬───────────────┬────────┘
                      │               ▲
  loginSuccess(email, accessToken,    │  logout() / no-token-at-boot / 90-day-ttl-elapsed
  accessTokenExpiresAtMs)             │
                      ▼               │
               ┌───────────────────────────────┐
               │         Authenticated         │
               │  email, accessToken, exp set  │
               └─┬────────────────┬────────────┘
                 │                │
  silentRefreshSuccess            │ silentRefreshRejected OR
  (rotates accessToken / exp)     │ requireSession() called and refresh rejected
                 │                ▼
                 │     ┌───────────────────────────────┐
                 │     │        RequiresRelogin         │
                 │     │  email preserved, tokens null  │
                 │     │  _queuedSync = true            │
                 │     └──────┬────────────────┬───────┘
                 │            │                │
                 │   reloginSuccess(email,     │   user cancels Relogin screen
                 │   accessToken, exp)         ▼
                 │            │         ┌───────────────────────────────┐
                 │            │         │   RequiresRelogin (stays)    │
                 │            │         │   _queuedSync stays true     │
                 │            ▼         └───────────────────────────────┘
                 │     ┌───────────────────────────────┐
                 │     │ Authenticated, _queuedSync    │
                 └────►│  = false, sync re-triggered   │
                       └───────────────────────────────┘
```

**Transitions reference**:

| Transition                         | Trigger                                  | Guards / notes |
|------------------------------------|------------------------------------------|----------------|
| `NotAuthenticated → Authenticated` | `authService.login(email, password)` resolves | Persists `auth.refreshCredential` and `auth.lastEmail`. |
| `Authenticated → Authenticated`    | `authService.refresh()` resolves         | Updates `accessToken`, `accessTokenExpiresAtMs`, persists rotated refresh token + bumped `lastRefreshAtMs`. |
| `Authenticated → RequiresRelogin`  | `authService.refresh()` rejects with `RELOGIN_REQUIRED` | Deletes `auth.refreshCredential`, preserves `auth.lastEmail`, sets `_queuedSync = true` if the refresh was invoked from a sync path. |
| `RequiresRelogin → Authenticated`  | `authService.login(email, password)` resolves on the Relogin screen | Same as initial login + clears `_queuedSync` + triggers the deferred sync. |
| `Authenticated → NotAuthenticated` | `authService.logout()` resolves locally  | Deletes both secure-store keys; attempts server revocation best-effort. |
| `NotAuthenticated → NotAuthenticated` | 90-day TTL elapsed at boot            | Deletes `auth.refreshCredential`, preserves `auth.lastEmail`. Net observable is "user sees Login screen with email pre-filled". |

**Invariants**:

- `status === 'Authenticated'` ⇒ `email !== null`.
- `accessToken !== null` ⇒ `accessTokenExpiresAtMs !== null` and in the future at write time.
- `_queuedSync === true` is only observable during `RequiresRelogin`. It is cleared on the next `Authenticated` transition.
- The session never transitions directly from `NotAuthenticated` to `RequiresRelogin` — `RequiresRelogin` is reachable only from `Authenticated`.

---

## Password — the entity that is NOT persisted

Per `FR-004`, the password:

- Lives only in the `LoginScreen`'s controlled input state (React `useState`).
- Is passed once to `authService.login({ email, password })`.
- Is `null`'d from the input on successful navigation away from the screen.
- Is NEVER written to secure store, AsyncStorage, logs, analytics events, or telemetry.
- Is NEVER included in any error object that crosses the module boundary (`AuthError` carries a class code, not a payload).

**Audit trail**: SC-005 is the acceptance test — a filesystem and secure-storage audit immediately after a login finds no entry containing the password or a hash/transform of it.

---

## Relationship diagram (ASCII)

```text
  ┌─────────────────────────────────────────────────────────────┐
  │                       process memory                        │
  │                                                             │
  │   ┌──────────────────┐    subscribes via    ┌───────────┐   │
  │   │  Session state   │◄────────────────────►│ useSession│   │
  │   │  (event emitter) │                      │   hook    │   │
  │   └─────┬────────────┘                      └───────────┘   │
  │         │                                                   │
  │         │ reads/writes                                      │
  │         ▼                                                   │
  │   ┌──────────────────┐         calls         ┌───────────┐  │
  │   │  authService     ├──────────────────────►│ Supabase  │  │
  │   │                  │                       │   Auth    │  │
  │   └─────┬────────────┘                       └───────────┘  │
  │         │                                                   │
  │         │ reads/writes                                      │
  │         ▼                                                   │
  │   ┌──────────────────┐                                      │
  │   │  secureStore.ts  │ (typed wrapper)                      │
  │   └─────┬────────────┘                                      │
  └─────────┼──────────────────────────────────────────────────┘
            │ set/get/delete
            ▼
  ┌────────────────────────────────────────┐
  │     OS secure enclave (Keychain /       │
  │     EncryptedSharedPreferences)         │
  │                                         │
  │   auth.refreshCredential                │
  │   auth.lastEmail                        │
  └────────────────────────────────────────┘
```

---

## Summary

- **2 persistent entries** in secure store, with distinct lifecycles (credential deleted on rejection/logout; email preserved across rejection).
- **1 in-memory session** with a 3-status state machine plus two internal flags (`_isRefreshing`, `_queuedSync`).
- **1 ephemeral entity** (the password) that is forbidden from ever touching persistent storage.
- **0 WatermelonDB changes**. Block 002's schema is untouched.
- **0 new business entities**. Constitution R2's "exactly 7 entities" invariant holds.
