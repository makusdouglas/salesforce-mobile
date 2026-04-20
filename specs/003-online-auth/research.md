# Phase 0 — Research: Online-One-Time Authentication

**Feature**: 003-online-auth
**Date**: 2026-04-20
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [.specify/memory/constitution.md](/.specify/memory/constitution.md)

Each item below ends with a single decision — no `NEEDS CLARIFICATION` marker survives this phase.

---

## R1 — Supabase Auth SDK: which methods, which persistence mode

**Decision**: Use `@supabase/supabase-js` v2, configured with `autoRefreshToken: true`, `persistSession: false`, `detectSessionInUrl: false`. Own the persistence ourselves by passing a custom `storage` adapter that writes only the refresh token (+ a last-refresh timestamp) to `expo-secure-store`. Use these three SDK calls for the full flow: `signInWithPassword({ email, password })` for login, `setSession({ access_token, refresh_token })` on boot to seed the in-memory session from our stored refresh token, and `signOut()` for logout.

**Rationale**:

- `persistSession: true` combined with the SDK's default `storage` persists the **entire** Session object — including the access token. That violates FR-020 (access token is in-memory only). Using our custom adapter lets us persist only what we need.
- `autoRefreshToken: true` lets the SDK handle the short-lived-access-token renewal transparently whenever we have a valid refresh token in memory. Our responsibility is (a) seeding the session at boot and (b) reacting to auth-state-change events for persistence and for the refresh-failure path.
- `detectSessionInUrl: false` is correct for a mobile app (no deep-link auth is in scope in the MVP).

**Alternatives considered**:

- **`@supabase/ssr`** — server-side-rendering variant; irrelevant for RN. Rejected.
- **Roll our own auth against Supabase's REST endpoints** — possible but we'd reimplement token rotation, error classification, and retry backoff. Rejected by P3 and P4.
- **Persist the full session and reuse the access token at cold launch** — saves ~1 s of silent refresh on first online action but violates FR-020. Rejected.

---

## R2 — Custom storage adapter for Supabase

**Decision**: Implement a two-method adapter `{ getItem, setItem, removeItem }` at `src/features/auth/storage/supabaseStorageAdapter.ts`. Supabase's `storage` contract is the Web-Storage-like pair of get/set/remove returning values as strings. Our adapter serialises/deserialises a *subset* of the session — it persists **only** the refresh token (and our own last-refresh timestamp, not part of Supabase's shape) to the secure store, and the adapter returns a reconstructed partial session on `getItem` that Supabase's SDK will feed into its internal state. Because `persistSession: false` is set in R1, the SDK does not invoke the adapter at all; we call `setSession` / `signOut` manually and write directly to `expo-secure-store` via a thin typed wrapper.

**Rationale**: Keeping `persistSession: false` means the "custom storage adapter" is really just our own typed secure-store wrapper — no SDK-conformance-shim complexity, no risk of the SDK persisting fields we don't want persisted. The wrapper is trivial to test and audit for FR-004 compliance (password is never written).

**Alternatives considered**:

- **Give the SDK full responsibility** (`persistSession: true` + adapter) — works, but the adapter sees a full session object and we'd need to strip fields inside the adapter, which is brittle if the session schema changes across SDK versions. Rejected for maintainability.
- **Use Expo's Secure Store directly at every call site** — works but duplicates encoding/decoding and error handling. Rejected; centralize in one wrapper.

---

## R3 — `expo-secure-store` usage pattern

**Decision**: Store two keys:

| Key                          | Value shape (JSON-encoded)                        | Lifecycle |
|------------------------------|---------------------------------------------------|-----------|
| `auth.refreshCredential`     | `{ refreshToken: string, lastRefreshAtMs: number }` | Set on login and on every successful refresh. Deleted on logout. Deleted on refresh rejection (the refresh token is now useless). |
| `auth.lastEmail`             | `string` (the email, plain text in the secure enclave) | Set on successful login. **Preserved** on refresh rejection (needed for FR-018 re-login pre-fill). Deleted on logout. |

Use `SecureStore.setItemAsync(key, value, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY })` so the value is not backed up to iCloud / Google Drive and is unreadable while the device is locked. Android's `EncryptedSharedPreferences` is transparently used by `expo-secure-store` on that platform; no extra options needed.

**Rationale**:

- Separating the credential from the email means refresh rejection deletes the former without affecting the latter — exactly the FR-008 / FR-018 behavior the spec demands.
- `WHEN_UNLOCKED_THIS_DEVICE_ONLY` prevents a lost-device attacker from extracting the refresh token via a backup restore to another device. Backed-up refresh tokens are a real class of attack.
- Storing the email in secure store (rather than AsyncStorage) saves a dependency and makes "wipe all auth state" a single operation over two keys.

**Alternatives considered**:

- **Put both entries in one combined blob** — forces a read-modify-write cycle every time either field changes; also couples their lifecycles when the spec keeps them distinct (FR-018 preserves email through a refresh rejection). Rejected.
- **`AFTER_FIRST_UNLOCK` / default accessibility** — allows background tasks to read the token, but the MVP has no auth-dependent background tasks; `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is stricter and sufficient. Rejected.
- **AsyncStorage for `lastEmail`** — adds a dependency; rejected.

---

## R4 — Connectivity detection library

**Decision**: Use `@react-native-community/netinfo`. Listen with `NetInfo.addEventListener` for transitions from `isConnected: false` (or `isInternetReachable: false`) to `isConnected: true && isInternetReachable: true`. Debounce bursts with a trailing 500 ms guard so a single Wi-Fi hand-off doesn't trigger multiple silent refreshes.

**Rationale**: `netinfo` is the community-standard connectivity listener for RN; works in Expo managed workflow without extra native config once we have the dev client (present since block 002). The `isInternetReachable` flag filters out "connected to Wi-Fi but no internet" — the refresh would fail pointlessly in that case, and the 500 ms debounce keeps us from hitting the auth endpoint repeatedly on a flaky network.

**Alternatives considered**:

- **`expo-network`** — Expo's own module; currently does **not** expose an event listener for connectivity changes, only a one-shot `getNetworkStateAsync`. We'd have to poll. Rejected.
- **Native platform APIs** (no library) — out of scope for a dev-client managed workflow. Rejected.
- **Skip listening; only refresh on user-initiated sync** — violates FR-006 ("When the device regains connectivity, the app MUST silently refresh"). Rejected.

---

## R5 — Session state machine

**Decision**: Four states, one store.

```text
  ┌──────────────────┐  boot (no token / wiped)    ┌────────────────────┐
  │  NotAuthenticated├────────────────────────────►│ Login screen shown │
  └────────┬─────────┘                              └────────────────────┘
           │ login success
           ▼
  ┌──────────────────┐
  │  Authenticated   ├──── refreshed (silent) ──── stays Authenticated
  └──┬────────────┬──┘
     │            │
     │            │ server rejects refresh
     │            ▼
     │  ┌─────────────────┐  next network-requiring action  ┌─────────────────────┐
     │  │ RequiresRelogin ├─────────────────────────────────►│ Relogin screen shown │
     │  └────────┬────────┘                                  └──────────┬──────────┘
     │           │ re-login success                                     │
     │           ▼                                                      │
     │  ┌──────────────────┐ ◄────────────────────────────────────────┘
     │  │  Authenticated   │
     │  └──────────────────┘
     │
     │ user triggers logout
     ▼
  ┌──────────────────┐
  │ NotAuthenticated │
  └──────────────────┘
```

An internal boolean `isRefreshing` augments `Authenticated` for the moment when a silent refresh is in flight; it does NOT promote to a visible state. An internal `queuedSync: boolean` flag (set during the transition to `RequiresRelogin`) records that a sync was interrupted so re-login success can re-trigger it (FR-010).

**Rationale**: Four states are enough to cover every spec scenario. Adding a `Tentative` intermediate state (e.g., "token exists but server hasn't yet confirmed") was considered but rejected: on boot we start in `Authenticated` optimistically (FR-014), and the silent refresh that fires on connectivity-return either keeps us there or demotes us to `RequiresRelogin` — no user-visible tentative phase is needed.

**Alternatives considered**:

- **Only two states (`Authenticated` / `NotAuthenticated`)** — collapses `RequiresRelogin` into `NotAuthenticated`, which would force immediate login screen on refresh rejection, violating FR-008(c). Rejected.
- **A generic state machine library (XState)** — four states and handful of transitions do not justify a library. Rejected by P3.

---

## R6 — `requireSession()` — the gatekeeper

**Decision**: A single function, exported from `src/features/auth`, that every network-requiring action awaits before proceeding. Signature:

```ts
async function requireSession(): Promise<{ accessToken: string }>
```

Behavior:

1. If state is `NotAuthenticated`: throw `AuthError('NOT_AUTHENTICATED')`. (Callers should route through `Login` from the nav stack instead of invoking this function in the first place.)
2. If state is `RequiresRelogin`: navigate to `ReloginScreen` (via a navigation-ref singleton the auth barrel exposes), wait for resolution, then recurse. If the re-login is canceled, throw `AuthError('RELOGIN_REQUIRED')`.
3. If state is `Authenticated` with a valid in-memory access token: return it.
4. If state is `Authenticated` without a cached access token OR its `expires_at` is past: call `authService.refresh()`. On success, return the new access token. On rejection (`RELOGIN_REQUIRED`), transition to `RequiresRelogin`, set `queuedSync=true`, and recurse into step 2. On transient failure (no network / 5xx), throw `AuthError('NETWORK')` — the caller surfaces a "try again" message.

The re-login prompt is **only** surfaced from inside this function. No other module in the codebase may call the navigation ref to show it. This concentration is the architectural lever behind FR-008(c) and FR-005.

**Rationale**: Centralising the prompt path makes the "prompt only on next network-requiring action" invariant auditable in a single file. An ESLint rule is overkill here — code review + one obvious call site is enough for the MVP, and the rule would fail silently if the nav-ref were ever imported from a new location.

**Alternatives considered**:

- **Let each feature handle its own re-auth** — violates the invariant by design; would also leak the auth nav into feature code. Rejected.
- **Validate the token proactively every N minutes** — violates FR-005 ("no validate-token per action" in spirit; a background validate is still a validate). The silent refresh is sufficient and only runs on connectivity-restoration, not on a timer.

---

## R7 — Root navigator integration

**Decision**: `RootNavigator` reads the session state via `useSession()` and picks one of:

- `AuthStack` (just the Login screen) — when state is `NotAuthenticated`.
- `HomeStack` (the existing home + any feature stacks) — when state is `Authenticated` or `RequiresRelogin`. The `Relogin` screen is **not** inside the auth stack; it is a modal route reachable via `rootNavigationRef.navigate('Relogin')` from `requireSession()`.

While `NotAuthenticated`, only the Login screen mounts; the home tree is unmounted, ensuring no business feature can accidentally run before login.

**Rationale**: Mounting Home while `RequiresRelogin` is what keeps offline business operations working after a refresh rejection (FR-008a). The Relogin modal sitting on top of Home is the mechanism by which the salesperson is prompted at the moment of a network-requiring action, not before.

**Alternatives considered**:

- **Always mount Home; route through nav guards** — adds complexity to every screen. Rejected.
- **Two entirely separate navigators** — complicates modal presentation of Relogin over Home. Rejected.

---

## R8 — Logout mechanics

**Decision**: `authService.logout()` does the three steps in order:

1. **Local wipe first** — delete `auth.refreshCredential` and `auth.lastEmail` from secure store; clear in-memory access token; transition state to `NotAuthenticated`. This is synchronous on the device; no network call is required. **This step MUST complete even if step 2 fails** (FR-011).
2. **Server revocation** — call `supabase.auth.signOut()` **best-effort**. If the call fails (no network, server error), we log the failure but do not surface it to the user. The server-side short-lived access token will expire naturally within minutes; the refresh token is invalidated at the server at the next opportunity (network-reconnect on the device → server gets a replay attempt that it already invalidated client-side, or the server's own TTL reclaims it).
3. **Navigate** — navigate RootNavigator to `Auth / Login`.

For FR-012 (offer final sync on logout when unsynced changes exist and network is available): the logout action (exposed from Home) first asks the sync block "are there unsynced changes?". If yes AND net is reachable: present a modal with three options (Sync then log out / Log out anyway / Cancel). If sync completes, proceed to step 1 above. If the salesperson picks "Log out anyway", skip the sync and proceed. If they cancel, do nothing. The modal UI lives with the home feature; `authService` just exposes `logout()` and the sync-block's "pending changes" count is a separate piece of info.

**Rationale**: Local-wipe-first is the guarantee against "user taps logout on a lost/stolen device without internet" — the token is gone from this device immediately, even if the server doesn't know yet. Server revocation is nice-to-have for the case where a still-valid-server-side refresh token is extracted from a backup after logout; the 90-day TTL and RLS catch the rest.

**Alternatives considered**:

- **Server-revoke first, then wipe** — if server-revoke fails, do we wipe anyway? Spec says yes (FR-011), so ordering it after the wipe is simpler and more robust. Rejected.
- **Wipe only, skip server revocation** — leaves the server-side refresh token alive until its natural TTL. Violates the spec's explicit "revokes the refresh token server-side". Rejected.

---

## R9 — Error mapping (Supabase → UX copy)

**Decision**: A single module `src/features/auth/service/errors.ts` classifies Supabase errors into a three-class taxonomy:

| Class              | Supabase indicators                                                                | UX message (Portuguese)                                                           |
|--------------------|------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| `NETWORK`          | `fetch` failure, network error, status 0, status 502/503/504                       | "Sem conexão com a internet. Tente novamente quando estiver online."              |
| `INVALID_CREDENTIALS` | `error.code === 'invalid_credentials'`, HTTP 400 with `invalid_grant`, HTTP 401  | "E-mail ou senha incorretos. Verifique e tente novamente."                        |
| `ACCOUNT_ISSUE`    | HTTP 403 with `user_banned` / `user_already_exists` / `signup_disabled`            | "Não foi possível entrar com essa conta. Fale com o administrador."               |

Any error not matching the first two classes defaults to `ACCOUNT_ISSUE` so the salesperson doesn't see a generic "server error — try later" that confuses them at the moment of a potentially-invalid credential (FR-016).

**Rationale**: Avoids leaking raw server payloads (FR-016) and gives the salesperson an actionable next step. Portuguese copy lives in Portuguese, not in this document — strings are owned by the screen implementation; this taxonomy is the behavior contract.

**Alternatives considered**:

- **Show the raw error message** — violates FR-016 and can include debugging payloads. Rejected.
- **One generic "try again" for everything** — a salesperson who mistyped their password would keep mistyping without knowing why. Rejected.

---

## R10 — Environment variables and secret hygiene

**Decision**: Read `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `process.env` at app build time. Ship a `.env.example` file with placeholder values and commit it; the real `.env` stays gitignored. For the dev client, Expo injects `EXPO_PUBLIC_*` variables into `process.env` automatically.

**Rationale**: Supabase's anon key **is** public — it is designed to ship in client bundles and is gated by Row-Level Security server-side. Calling it a "secret" would be misleading. The `.env` pattern keeps the project-specific values out of the repo while letting the onboarding developer fill them in once.

**Alternatives considered**:

- **Hardcode the URL/anon-key in the repo** — forks or open-source clones of the repo would inherit them. Rejected; .env is one-time setup.
- **Read from `expo-constants` / `app.config.ts`** — works but adds an indirection; `EXPO_PUBLIC_*` is the documented path. Rejected.

---

## R11 — Proactive 90-day TTL check

**Decision**: At boot, read `auth.refreshCredential.lastRefreshAtMs` from the secure store. Compute `now - lastRefreshAtMs`. If greater than 90 days (90 × 24 × 60 × 60 × 1000 ms), delete the credential, transition to `NotAuthenticated` (not to `RequiresRelogin` — this is effectively "no session, go to login screen fresh", but we preserve `auth.lastEmail` for pre-fill, matching FR-017's "auto-fill from last login"). The server-side TTL is the real authority; the client check is a pre-emptive cut to avoid a useless round-trip on a device that has been offline for three months.

**Rationale**: FR-009 explicitly permits this: *"The client MAY also proactively treat any refresh older than 90 days as invalid to save a round-trip."*. Matches the server's 90-day window to the millisecond, so a token within 89 days 23 hours will still attempt a refresh and the server is the final say.

**Alternatives considered**:

- **Always attempt the refresh** — wastes a round-trip (and a failure, in the rare "we have a 200-day-old token" case). Rejected.
- **Shorter client-side window (say, 85 days)** — over-conservative; turns some valid sessions into forced re-logins that the server would otherwise have renewed. Rejected.

---

## R12 — Test surface (business-logic first)

**Decision**: Ship a single test file covering the two pieces of logic that are genuinely stateful:

- `session.ts` — state transitions (10 cases covering login success/failure, refresh success/rejection, logout, 90-day TTL expiry, connectivity recovery).
- `secureStore.ts` — encoding/decoding round-trip, missing-key returns `null`, partial-data returns `null` (defensive).

Use plain `vitest` or `jest` — the project does not yet have a runner; this feature installs `jest` + `@types/jest` + `ts-jest` only if a test file is authored (otherwise skip). The `authService`, the connectivity listener, and the screens are not unit-tested — they are integration points. The screen UX is verified by manually exercising the acceptance scenarios in [spec.md](./spec.md).

**Rationale**: Constitution §9 puts test investment on business logic. The session state machine is the one place where a logic bug would silently cause a re-login loop or data loss; the secure-store wrapper is the one place where an encoding mistake could leak or lose the refresh token. Everything else is thin glue.

**Alternatives considered**:

- **No tests at all** — acceptable per §9 for pure plumbing, but the state machine is not plumbing — it has branches. Rejected.
- **Full coverage including screens and connectivity** — premature for the MVP. Rejected.

---

## Summary of decisions → plan updates

- Supabase JS v2, `persistSession: false`, custom manual persistence → a thin `secureStore` wrapper, not a Supabase `storage` adapter.
- Two secure-store keys: `auth.refreshCredential` and `auth.lastEmail`, distinct lifecycles (FR-018).
- `@react-native-community/netinfo` with a 500 ms debounce.
- Four-state session machine with an internal `queuedSync` flag.
- `requireSession()` is the sole gate for the re-login prompt.
- RootNavigator branches `NotAuthenticated` vs. anything else; Relogin is a modal route on top of Home.
- Logout: local-wipe-first, best-effort server revocation, then navigate.
- Error taxonomy: NETWORK / INVALID_CREDENTIALS / ACCOUNT_ISSUE.
- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`; `.env.example` committed, `.env` gitignored.
- 90-day TTL is enforced pre-emptively client-side AND server-side; client is the optimization, server is authoritative.
- Tests: session state machine + secure-store wrapper. Nothing else in this block.

No unresolved `NEEDS CLARIFICATION` remains.
