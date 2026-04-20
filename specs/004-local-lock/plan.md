# Implementation Plan: Mandatory Local Lock

**Branch**: `004-local-lock` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-local-lock/spec.md`

## Summary

Install the constitution §7 D6 device-level lock as a self-contained feature that sits between the 003 online-auth session and every HomeStack screen. On first run after a successful D5 login, the app forces the salesperson to set a 4–6 digit PIN; the PIN is persisted as a salted PBKDF2 hash in `expo-secure-store`, never in plaintext. On every cold launch, and again whenever the app returns to foreground after an inactivity window (default 5 min, salesperson-configurable), the app presents a lock screen that prefers biometric unlock via `expo-local-authentication` and falls through instantly to a PIN pad on any failure, dismissal, or absence of biometric enrollment. Unlock is fully offline — the only network-crossing surface in this feature is the "Forgot PIN" recovery path, which reuses the 003 LoginScreen after forcing a session invalidation that **preserves the last-known email** so the LoginScreen can still pre-fill it. The lock state is intentionally orthogonal to the D5 session state (FR-017): refresh-token rejection does not affect the lock; unlock events do not affect the session.

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001/002/003).
**Primary Dependencies**: `expo-local-authentication` (biometric prompt), `expo-crypto` (CSPRNG for per-device PIN salt), `@noble/hashes` (audited pure-JS PBKDF2 — see research R2), `react-native-privacy-snapshot` (OS task-switcher snapshot masking — see research R12). Inherits from 003: `@supabase/supabase-js`, `expo-secure-store`, `@react-native-community/netinfo`, `@react-navigation/*`. Dev: existing Jest + ts-jest; no new dev tooling.
**Storage**:
- **PIN credential** (`{ hash, salt, iterations, algo }`) — `expo-secure-store`, key `lock.pinCredential`, accessibility `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. New key space, disjoint from 003's `auth.*` keys.
- **Inactivity timeout preference** (`{ minutes: number }`) — `expo-secure-store`, key `lock.inactivityTimeoutMinutes`. Co-located with the PIN credential only so the lock feature has a single typed wrapper; it is not a secret.
- **Runtime lock state** (`status: 'NotSet' | 'Locked' | 'Unlocked'`, backgroundedAtMs, failedAttempts) — **in-memory only**. Lost on process kill; cold-launch always re-evaluates to `NotSet` or `Locked` via bootstrap.
- **Salesperson business data** — WatermelonDB (block 002). Untouched. Preserved on PIN recovery per FR-015 and constitution P5.
**Testing**: Constitution §9 — business-logic coverage first. Ship unit tests for: (a) PIN hashing round-trip (`hash(pin, salt) === hash(pin, salt)`, wrong PIN verifies false, different salts produce different hashes), (b) lock state machine transitions, (c) inactivity expiry math given a configurable timeout, (d) lock-storage wrapper (read/write/delete, corrupted-payload returns null). Biometric prompt, AppState listener, and the screens themselves are integration points — verified manually against the acceptance scenarios in [spec.md](./spec.md).
**Target Platform**: iOS 13+ and Android 7+ (inherited from 002/003). `expo-local-authentication` supports both; no additional platform minimums needed.
**Project Type**: Mobile app, feature module addition on top of the 003 auth-and-navigation scaffold.
**Performance Goals**: First-run PIN setup under 30 s end-to-end (SC-001). Cold launch with biometrics enrolled → interactive home in under 3 s (SC-002). Cold launch with PIN-only → interactive home in under 5 s after a correct PIN (SC-003). Zero network calls in a 5-min offline unlock session (SC-004). End-to-end "Forgot PIN" recovery under 90 s on broadband (SC-009).
**Constraints**: Offline-first (P1) is the non-negotiable property — unlock MUST be fully offline. No validate-token on unlock, no "check device is online" on unlock. Business data preserved across every PIN state transition except ones that the constitution explicitly authorizes to wipe (and only the PIN, never business data — P5). Unlock latency budget: the biometric prompt is OS-owned; PIN verification MUST be under 200 ms on a mid-range Android device to keep the total unlock under SC-003.
**Scale/Scope**: ~14–18 new source files under `src/features/lock/` (one typed secure-store wrapper, one PBKDF2 adapter, one biometric adapter, one lock state store + event emitter, one AppState-driven inactivity tracker, one `lockService`, one `useLock` hook, one `LockProvider`, three screens — PinSetup, Lock, PinRecoveryConfirm — one barrel, plus tests). Two **existing** 003 files receive minor, backwards-compatible extensions: `authService.logout({ preserveEmail?: boolean })` gains the optional flag, and the root navigator wraps the Home branch in a `<LockGate>` guard. A third cross-cutting touch wraps the whole tree with a privacy-snapshot component in `AppProviders.tsx` (one import, one JSX wrapper — ~3 LOC). One configuration touch: `app.json` lists `expo-local-authentication` under `plugins` for clarity; `.env.example` is not modified (no new env vars — the lock feature is fully device-local).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | Unlock (biometric + PIN) crosses zero bytes of network on the happy path (FR-008, SC-004). The only online path is PIN recovery, which is explicitly a rare, network-conditional flow (FR-014). |
| P2 Local DB is source of truth | ✅ | Pass | The lock feature does not read or write business tables. Business data is preserved across PIN setup, inactivity lock, unlock, and PIN recovery (FR-015, SC-010). |
| P3 MVP simplicity | ✅ | Pass | One state store (3 statuses + 2 flags), one typed secure-store wrapper, one biometric adapter, one AppState listener — all pure JS/TS. No state library, no crypto native module, no custom native code. |
| P4 Reuse free tools | ✅ | Pass | `expo-local-authentication` replaces a custom biometric bridge; `expo-secure-store` reuses the enclave already provisioned by 003; `@noble/hashes` replaces a hand-rolled PBKDF2. No third-party auth SaaS, no custom backend. |
| P5 Salesperson data is sacred | ✅ | Pass | Every lock transition preserves WatermelonDB. PIN recovery (FR-014/015) explicitly preserves local data (SC-010 audit). Logout-path extension (`preserveEmail`) is about the email, not about business data — business data is never wiped by this feature. |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | Inherits the dev client from 002. `expo-local-authentication` and `expo-crypto` are official Expo packages — no native-module friction. `@noble/hashes` is pure JS, no linking. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | Not touched. No repository is imported by any lock-feature file. |
| §3 Mandatory — Supabase | ✅ | Pass | The lock feature does not import the Supabase client directly. PIN recovery routes through `authService.login()` on the existing LoginScreen, which owns the Supabase call. |
| §3 Mandatory — `expo-secure-store` | ✅ | Pass | Reused for the PIN credential and the inactivity preference. Lock-feature keys are disjoint from 003 auth keys (R3 of research). |
| §3 Mandatory — `expo-local-authentication` | ✅ | Pass | This is the feature where it ships, exactly per constitution §3's "added in 0.2.0 for §7 D6". |
| §3 Forbidden — custom backend / Firebase / Redux/MobX / heavy UI | ✅ | Pass | None introduced. Lock state uses the same event-emitter + Context + hook pattern 003 introduced. |
| R1 WatermelonDB is the single client data layer | ✅ | Pass | Lock feature never reads business data. It reads only its own secure-store entries. |
| R2 Seven entities | ✅ | Pass | No entity change — the feature is a device-gate, not a business concept. |
| R3 Images in Storage | N/A | — | Not touched. |
| R4 PDF local, email via share sheet | N/A | — | Not touched. |
| R5 Discounts on order, not catalog | N/A | — | Not touched. |
| §5 UX1 Tap, not type | ⚠️ Justified | Pass | PIN entry requires typing digits by the nature of a PIN pad. The mitigating design: (a) biometric is the *preferred* primary path (FR-006) so typing is skipped on enrolled devices; (b) the PIN pad uses the platform's numeric keyboard so "typing" is tapping 4–6 keys. Once-every-5-minutes typing on a numeric pad is well below the UX1 threshold the constitution targets (in-store long text entry during a sale). |
| §5 UX2 Repeat previous order | N/A | — | Not touched. |
| §5 UX3 Useful empty states | ✅ | Pass | The lock screen is intentionally empty of business data (FR-020). The PinSetup screen guides the salesperson explicitly in Portuguese — the empty state IS the setup flow. |
| §5 UX4 Discreet sync feedback | ✅ | Pass | Lock activity is not a sync event and does not compete with the sync indicator. |
| §5 UX5 Phone AND tablet layouts | ✅ | Pass | Phone + tablet frames shipped under [specs/004-local-lock/design/](./design/screens.md) — 3 screens × 2 viewports = 6 frames generated via the Pencil MCP. Tablet variant uses 460 pt centered card; phone uses full-width with 24 pt horizontal padding. Acceptance at implementation time: each screen component MUST render correctly on iPhone (390×844) and iPad (820×1180) simulators before task closure — covered by [tasks.md T040](./tasks.md#phase-6-polish--cross-cutting-concerns). |
| §6 D1 Pull then push | N/A | — | Not touched by this feature. (PIN recovery triggers a re-login; any sync that follows is 003's responsibility.) |
| §6 D2–D4 | N/A | — | Not touched. |
| §7 D5 Online-one-time + offline-persistent | ✅ | Pass | Independence of layers is encoded as FR-017 in this spec. This feature extends the 003 `authService.logout()` signature with a backwards-compatible `preserveEmail` option (see research R5). No other 003 contract is modified. |
| §7 D6 Mandatory local lock | ✅ | Pass | This feature **is** the implementation of D6. Every requirement in the spec traces to a D6 clause. |
| §9 English identifiers | ✅ | Pass | All code identifiers, service names, hook names, file names, and secure-store keys in English. Portuguese only in UI strings — owned by the screen implementation. |

**Gate status (pre-research)**: PASS with one justified deviation.

1. **UX1 typing** — PIN entry is typing; mitigated by biometric-first and by minimal-digit count. Weaker deviation than 003's once-per-90-days credential typing.

## Project Structure

### Documentation (this feature)

```text
specs/004-local-lock/
├── plan.md                 # This file
├── research.md             # Phase 0 — crypto, biometrics, state machine, recovery flow rationale
├── data-model.md           # Phase 1 — secure-store entries + in-memory lock state machine
├── quickstart.md           # Phase 1 — "how a new feature consumes the lock"
├── contracts/
│   ├── lock-service.md     # Public API of lockService + useLock + requireUnlocked
│   ├── lock-storage.md     # What the lock feature persists, keyed where, how encoded
│   ├── biometric-adapter.md # Narrow wrapper contract over expo-local-authentication
│   ├── state-machine.md    # NotSet / Locked / Unlocked transitions, inactivity, recovery
│   └── screens.md          # PinSetup / Lock / PinRecoveryConfirm contracts + navigation
├── checklists/
│   └── requirements.md     # Spec quality checklist (from /speckit-specify)
└── tasks.md                # Phase 2 — /speckit-tasks output (not created here)
```

### Source Code (repository root)

The lock feature is bounded under `src/features/lock/` and imported through its barrel `@/features/lock`. Exactly two modules outside the feature folder reach into it: `src/app/providers/AppProviders.tsx` (wraps the tree with `<LockProvider>`) and `src/app/navigation/RootNavigator.tsx` (wraps the `Home` branch with `<LockGate>`). Both do so through the barrel. The 003 auth feature is minimally extended with one backwards-compatible `authService.logout` option; no other 003 file is modified.

```text
.
├── app.json                                # MODIFIED — declare expo-local-authentication plugin entry
├── package.json                            # MODIFIED — add expo-local-authentication, expo-crypto, @noble/hashes
└── src/
    ├── app/
    │   ├── navigation/
    │   │   ├── RootNavigator.tsx           # MODIFIED — wraps the Home branch with <LockGate>; Relogin modal stays at root level so it can still overlay Home when unlocked
    │   │   └── types.ts                    # MODIFIED — LockStackParamList covers PinSetup, Lock, PinRecoveryConfirm; RootStackParamList unchanged
    │   └── providers/
    │       └── AppProviders.tsx            # MODIFIED — wraps children with <LockProvider> INSIDE <SessionProvider> (lock depends on session's email for recovery pre-fill); also wraps the whole tree with <PrivacySnapshotView> from react-native-privacy-snapshot (FR-022 — OS task-switcher snapshot masking)
    ├── features/
    │   ├── auth/
    │   │   └── service/
    │   │       └── authService.ts          # MODIFIED — logout() gains { preserveEmail?: boolean } option; default false preserves 003 behavior
    │   └── lock/
    │       ├── index.ts                    # NEW — public barrel: lockService, useLock, LockProvider, LockGate, PinSetupScreen, LockScreen, PinRecoveryConfirmScreen, types
    │       ├── service/
    │       │   ├── lockService.ts          # NEW — setupPin(), verifyPin(), unlockWithBiometric(), beginPinRecovery(), completePinRecovery(), setInactivityTimeout()
    │       │   └── errors.ts               # NEW — LockError with codes: PIN_MISMATCH | PIN_INVALID_LENGTH | BIOMETRIC_UNAVAILABLE | BIOMETRIC_FAILED | RECOVERY_OFFLINE | PROGRESSIVE_DELAY | TOO_MANY_ATTEMPTS
    │       ├── state/
    │       │   ├── lockStore.ts            # NEW — module-level singleton + event emitter; status = NotSet | Locked | Unlocked; internal flags: backgroundedAtMs, failedAttempts
    │       │   ├── bootstrap.ts            # NEW — reads lock.pinCredential at boot; decides initial status (NotSet if absent, Locked if present)
    │       │   └── inactivity.ts           # NEW — AppState subscription; records backgroundedAtMs on background; on foreground, if elapsed > configured timeout, transitions to Locked
    │       ├── storage/
    │       │   └── lockStorage.ts          # NEW — typed wrapper over expo-secure-store for 'lock.pinCredential' and 'lock.inactivityTimeoutMinutes'
    │       ├── crypto/
    │       │   ├── pinHash.ts              # NEW — PBKDF2-SHA-256 via @noble/hashes; hashPin(pin, salt, iters) → hex; verifyPin(pin, storedCredential) → boolean
    │       │   └── random.ts               # NEW — thin wrapper over expo-crypto.getRandomBytesAsync for salt generation
    │       ├── biometric/
    │       │   └── biometricAdapter.ts     # NEW — typed wrapper over expo-local-authentication: isAvailable(), authenticate(promptLabel) → 'success' | 'failed' | 'cancelled' | 'unavailable'
    │       ├── hooks/
    │       │   └── useLock.ts              # NEW — useSyncExternalStore hook over lockStore; exposes { status } only (internal flags hidden)
    │       ├── components/
    │       │   ├── LockProvider.tsx        # NEW — Context-less provider: runs lockBootstrap(), starts inactivity listener, tears down on unmount
    │       │   ├── LockGate.tsx            # NEW — wraps Home-tree children; renders PinSetupScreen when status==='NotSet', LockScreen when 'Locked', children when 'Unlocked'
    │       │   └── PinPad.tsx              # NEW — numeric input primitive reused by PinSetupScreen and LockScreen (6 slots, digit keys, backspace)
    │       ├── screens/
    │       │   ├── PinSetupScreen.tsx      # NEW — two-step flow (enter + confirm), reused on first-run AND after PIN recovery
    │       │   ├── LockScreen.tsx          # NEW — biometric prompt → PIN pad fallback; "Forgot PIN" affordance
    │       │   └── PinRecoveryConfirmScreen.tsx # NEW — small interstitial confirming "you'll be logged out to reset your PIN; your data stays"
    │       └── tests/
    │           ├── pinHash.test.ts         # NEW — hash round-trip, wrong PIN, salt sensitivity
    │           ├── lockStore.test.ts       # NEW — state machine transitions
    │           ├── inactivity.test.ts      # NEW — timeout calculation
    │           └── lockStorage.test.ts     # NEW — read/write/delete, corrupted-payload → null
    └── (everything else unchanged from 001/002/003)
```

**Structure Decision**: The lock feature sits as a peer of `src/features/auth/` under `src/features/`, exposing itself through a single barrel. Two architectural levers keep the dependency direction clean:

1. **`<LockProvider>` wraps inside `<SessionProvider>` in `AppProviders.tsx`; `<PrivacySnapshotView>` wraps outermost**. Lock depends on session for PIN recovery (the email pre-fill); session does not depend on lock. This ordering makes `useSession()` available to `LockProvider` if future logic needs it (not used in the MVP, but the shape is there). The privacy-snapshot wrapper sits *outside* both providers so it also covers the `NotAuthenticated` / `LoginScreen` state (which can still contain a pre-filled email and therefore leak the last-known salesperson identity in the OS task-switcher).

2. **`<LockGate>` sits under the `Home` branch of `RootNavigator`, not at the root**. The Relogin modal (from 003) stays at the root stack level so it can still overlay the Home tree when unlocked and a sync rejection occurs. The guard lives inside the Home branch, so while the salesperson is NotAuthenticated they see `LoginScreen` unobstructed; while Authenticated but locked they see `PinSetupScreen` or `LockScreen`; only while Authenticated AND Unlocked do they see Home. Relogin-over-locked never happens because the silent-refresh-rejection state is reached from within a network-requiring action, which cannot run while the app is locked (business screens aren't mounted under the gate).

**Rejected alternatives**:

- **A top-level `src/lock/` directory (sibling to `src/data/` and `src/app/`)** — rejected by constitution §9 (code lives in feature folders). The data layer earned its top-level status because it has no UI; lock has three screens and a provider.
- **Fold the lock state into the existing session state machine** (`Authenticated(locked) / Authenticated(unlocked)`) — rejected because spec FR-017 explicitly decouples the two layers. Coupling them would mean every 003 test would have to account for a lock axis it does not conceptually own, and future changes to either feature would risk breaking the other.
- **Put `<LockGate>` at the root navigator level, above Auth/Home** — rejected because it would require the Relogin modal to somehow compose with the lock guard, and because the NotAuthenticated state has nothing to lock (no PIN exists yet). Simpler to gate only the Home subtree.
- **Persist the backgrounded-at timestamp to disk to handle process kill** — rejected: cold launch always locks (FR-005), so the "process killed while backgrounded" case is covered by the cold-launch path. In-memory suffices.
- **Use the OS device-PIN via `LocalAuthentication.evaluatePolicy(DeviceOwnerAuthentication)`** — rejected: the constitution calls out an *app-specific* 4–6 digit PIN set by the salesperson. The device PIN is not the salesperson's to set in the app's sense, and many personal devices have weak or absent device PINs.
- **Bcrypt / Argon2 for PIN hashing** — rejected. Bcrypt in pure JS is slow at acceptable parameters and provides no real gain over PBKDF2 for low-entropy inputs guarded by a device enclave. Argon2 would require a native module; P3 and P4 disfavor that for a hashing that runs once at setup and once per unlock.
- **A dedicated PinRecoveryScreen that duplicates the LoginScreen** — rejected. Duplicating the credential-entry UI means two places to keep in sync for copy, error mapping, and accessibility. Preserving the email via `authService.logout({ preserveEmail: true })` and routing to the existing LoginScreen is smaller and obvious.

## Phase 1 post-design re-check

After Phase 1 artifacts (research, data-model, contracts, quickstart) were drafted, the Constitution Check table remains satisfied. Two items that surfaced during Phase 1 and are worth noting:

1. **The `authService.logout({ preserveEmail })` extension is a contract touchpoint, not a code refactor**. The 003 `authService.logout()` default behavior is unchanged; only the lock feature passes `{ preserveEmail: true }`, and only from the PIN recovery path. The 003 data-model's "logout deletes lastEmail (implicit spec intent)" remains the default for salesperson-initiated logouts. This preserves both the 003 invariant and the 004 requirement.

2. **The progressive-delay and forced-recovery curve are in-memory only and reset on cold launch** (spec 004 Key Entities). This is both simpler to implement and an intentional UX choice: if the app crashes or is killed mid-brute-force, the attacker's progress is reset, and a legitimate salesperson who mistyped a few times before backgrounding the app gets a clean window on return if the return is a cold launch. The in-session progression is sufficient to defeat the "shoulder-surfer tries ten times" scenario, which is the realistic threat model for D6.

**Gate status (post-design)**: PASS.

## Complexity Tracking

One justified deviation is recorded in the Constitution Check table; it is inherent to the feature and has no simpler alternative under the current constitution:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| UX1 typing — PIN entry requires typing digits | A 4–6 digit PIN IS a typed input by constitutional fiat (§7 D6). Biometric unlock removes typing when enrolled; the PIN is the mandatory fallback (FR-007). | Skipping the PIN (biometric-only) would violate the "wet-hand / dirty-sensor" fallback that constitution §7 D6 explicitly requires. |
