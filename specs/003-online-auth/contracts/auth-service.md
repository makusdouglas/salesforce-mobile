# Contract — `authService` API surface

**Feature**: 003-online-auth
**Status**: Authoritative — every caller of authentication logic (screens, navigators, sync block, logout actions) consumes this surface.
**Import path**: `@/features/auth` (barrel); implementation at `src/features/auth/service/authService.ts`.

---

## Import contract

```ts
import {
  authService,
  useSession,
  requireSession,
  SessionProvider,
  AuthError,
  type SessionStatus,
  type SessionSnapshot,
} from '@/features/auth';
```

Everything else inside `src/features/auth/` is internal — the session singleton, the secure-store wrapper, the connectivity listener, the Supabase storage adapter are not re-exported from the barrel.

---

## `authService` shape

```ts
const authService: {
  /**
   * Initial online login. MUST be called only from LoginScreen.
   *
   * On success:
   *   - Transitions session NotAuthenticated → Authenticated.
   *   - Persists auth.refreshCredential and auth.lastEmail.
   *   - Caches accessToken + accessTokenExpiresAtMs in memory.
   *
   * On rejection: throws AuthError with code NETWORK | INVALID_CREDENTIALS | ACCOUNT_ISSUE.
   * Session state is NOT modified on rejection.
   *
   * Password is held in memory for the duration of this call only and discarded after resolution.
   */
  login(args: { email: string; password: string }): Promise<void>;

  /**
   * Silent refresh of the access token using the stored refresh token.
   * Safe to call from:
   *   - The connectivity listener on offline→online transitions (FR-006).
   *   - requireSession() when the cached access token is absent or expired.
   *   - The app bootstrap when a token exists at cold start (FR-014 / FR-006).
   *
   * On success:
   *   - Keeps session at Authenticated; updates in-memory tokens and bumps lastRefreshAtMs.
   *   - Rotates refreshToken in secure store if Supabase rotated it.
   *
   * On rejection with RELOGIN_REQUIRED:
   *   - Transitions session Authenticated → RequiresRelogin.
   *   - Deletes auth.refreshCredential; preserves auth.lastEmail.
   *   - Sets the internal _queuedSync flag if caller indicated a pending sync.
   *
   * On rejection with NETWORK: does NOT transition state. Caller decides whether to retry.
   *
   * The connectivity listener invokes this as fire-and-forget; requireSession awaits it.
   */
  refresh(opts?: { reason?: 'boot' | 'connectivity' | 'requireSession' }): Promise<void>;

  /**
   * User-initiated re-login from the ReloginScreen. Same credential flow as login(),
   * but transitions RequiresRelogin → Authenticated and clears _queuedSync. If
   * _queuedSync was true, the function returns and the caller (requireSession) then
   * re-invokes the deferred sync.
   */
  relogin(args: { email: string; password: string }): Promise<{ hadQueuedSync: boolean }>;

  /**
   * Full logout.
   *
   * Steps (in order, all synchronous to the caller's perspective):
   *   1. Delete auth.refreshCredential and auth.lastEmail from secure store.
   *   2. Clear in-memory session → NotAuthenticated.
   *   3. Best-effort: call supabase.auth.signOut(). Failure is logged and swallowed.
   *
   * NEVER wipes WatermelonDB. Constitution P5 + FR-013.
   *
   * Returns when steps 1 and 2 are complete. Step 3 may still be in flight.
   */
  logout(): Promise<void>;
};
```

---

## `requireSession()` — the only path that may surface the re-login prompt

```ts
/**
 * Awaited by every network-requiring code path (sync push, sync pull, any future
 * server-dependent action) before touching Supabase.
 *
 * Behavior (see research R6):
 *   1. status === 'NotAuthenticated'  → throw AuthError('NOT_AUTHENTICATED').
 *   2. status === 'RequiresRelogin'   → navigate to ReloginScreen, await user action,
 *                                       then recurse. If canceled, throw AuthError('RELOGIN_REQUIRED').
 *   3. status === 'Authenticated' and cached access token is valid → return it.
 *   4. status === 'Authenticated' and cached token is absent/expired → call
 *      authService.refresh({ reason: 'requireSession' }).
 *        • On success: return the new access token.
 *        • On RELOGIN_REQUIRED: recurse into step 2 (with _queuedSync now set).
 *        • On NETWORK: throw AuthError('NETWORK'). State unchanged.
 *
 * Signature:
 */
async function requireSession(): Promise<{ accessToken: string }>;
```

**Invariant**: `requireSession()` is the **only** function in the codebase that may cause the Relogin screen to appear. Any other module wanting to prompt must either:
(a) call `requireSession()` themselves (recommended, e.g. the sync block), or
(b) not prompt — they are not allowed to bypass this function.

---

## `AuthError`

```ts
class AuthError extends Error {
  readonly code:
    | 'NETWORK'              // connectivity / 5xx / fetch failure
    | 'INVALID_CREDENTIALS'  // 400 invalid_grant / 401 / Supabase 'invalid_credentials'
    | 'ACCOUNT_ISSUE'        // 403 user_banned / signup_disabled / other server-side denial
    | 'NOT_AUTHENTICATED'    // requireSession() called while status is NotAuthenticated
    | 'RELOGIN_REQUIRED';    // refresh rejected OR user canceled the Relogin screen

  constructor(code: AuthError['code'], message?: string);
}
```

- Never carries a password, never carries raw Supabase payloads, never carries a stack trace from the auth provider (FR-016).
- The `code` field is the only contract callers depend on; `message` is an English developer-facing hint (the salesperson-facing Portuguese copy is computed from `code` at the screen layer).

---

## Error-code → UX-copy mapping (for LoginScreen / ReloginScreen)

| `AuthError.code`      | Portuguese message on the screen                                                            |
|-----------------------|----------------------------------------------------------------------------------------------|
| `NETWORK`             | "Sem conexão com a internet. Tente novamente quando estiver online."                         |
| `INVALID_CREDENTIALS` | "E-mail ou senha incorretos. Verifique e tente novamente."                                   |
| `ACCOUNT_ISSUE`       | "Não foi possível entrar com essa conta. Fale com o administrador."                          |
| `NOT_AUTHENTICATED`   | *(developer-only; should not reach the UI — indicates a caller bug)*                         |
| `RELOGIN_REQUIRED`    | *(developer-only; surfaced by requireSession(), never shown raw — Relogin screen appears instead)* |

The screen module owns the exact strings; this table is the behavior contract.

---

## What `authService` MUST NOT do

- **Must not** read or write WatermelonDB (`@/data` business repositories).
- **Must not** persist the access token to any store (FR-020).
- **Must not** persist the password anywhere (FR-004).
- **Must not** surface any UI directly — it is a pure logic module. UI reactions happen via `useSession()` in the screen layer.
- **Must not** be constructed. It is a module-level object; there is no `new AuthService()` and no DI.
