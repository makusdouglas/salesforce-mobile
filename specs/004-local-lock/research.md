# Phase 0 — Research: Mandatory Local Lock

**Feature**: 004-local-lock
**Date**: 2026-04-20
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [.specify/memory/constitution.md](/.specify/memory/constitution.md)

Each item below ends with a single decision — no `NEEDS CLARIFICATION` marker survives this phase.

---

## R1 — Biometric prompt library

**Decision**: Use `expo-local-authentication`. Wrap in a narrow adapter (`biometric/biometricAdapter.ts`) that exposes `isAvailable()` (hardware present AND at least one biometric enrolled), `authenticate(promptLabel: string)` returning `'success' | 'failed' | 'cancelled' | 'unavailable'`, and nothing else. Configure with `disableDeviceFallback: true` so the OS will NOT offer the device PIN as a second-chance authenticator — our own PIN pad is the only fallback, per constitution §7 D6.

**Rationale**:

- `expo-local-authentication` is the package named by constitution §3 for exactly this purpose (added in v0.2.0).
- It covers Face ID, Touch ID (iOS) and fingerprint / face / iris (Android) through one API.
- The narrow adapter lets us test the screen-level logic against a mock (`success` / `failed` / `cancelled` / `unavailable` are the only branches LockScreen needs to differentiate).
- `disableDeviceFallback: true` matters because constitution §7 D6 is explicit that the *app's* PIN is the mandatory fallback — not the OS PIN, which a determined attacker on a stolen device may already know.

**Alternatives considered**:

- **`react-native-biometrics`** — third-party, requires additional native linking steps. No constitutional reason to prefer it over the Expo-native option. Rejected.
- **Native platform APIs directly** (LocalAuthentication framework on iOS, BiometricPrompt on Android) — out of scope for a managed Expo workflow. Rejected.
- **`disableDeviceFallback: false`** — would let the salesperson fall back to the OS device PIN if biometrics fail. Rejected: the constitutional promise of D6 is that the *app* PIN is what guards the app, not the OS-level credential.

---

## R2 — PIN hashing algorithm and library

**Decision**: Use PBKDF2 with HMAC-SHA-256, **10,000 iterations**, 16-byte (128-bit) per-device random salt. Implementation via `@noble/hashes` (pure JS, audited, ~3 KB gzipped, drop-in PBKDF2). Generate the salt via `expo-crypto.getRandomBytesAsync(16)`.

Persisted credential shape (JSON-encoded):

```ts
type PinCredential = {
  algo: 'PBKDF2-HMAC-SHA256';
  iterations: 10000;
  saltHex: string;   // 32 hex chars (16 bytes)
  hashHex: string;   // 64 hex chars (32 bytes, the 256-bit PBKDF2 output)
  version: 1;        // schema version; lets future changes migrate
};
```

**Rationale**:

- **PBKDF2 fits the threat model.** A 4–6 digit PIN has 10,000–1,000,000 possible values. An offline attacker with the hash can brute-force it in seconds with *any* fast hash; the real defense is the OS enclave preventing hash exfiltration. The iteration count only matters after exfiltration, which in practice requires rooting the device and bypassing `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- **Why 10k and not 100k.** `@noble/hashes` is pure JS and runs on the React Native JS thread (Hermes). On a mid-range Android device, 100k iterations takes ~20–30 s — during which the UI freezes because JS is 100% occupied deriving the key. That is unacceptable UX for a lock that runs once on cold start and on every inactivity return. 10k iterations brings the derivation down to ~2–3 s with a spinner shown in `PinSetupScreen` / `LockScreen`. The security delta versus 100k is ~3.3 bits of brute-force cost — negligible compared to the ~13–20 bits of entropy in the PIN itself, which is the real ceiling. Online brute-force is separately bounded by the progressive-delay policy (R6), which caps achievable attempt rate regardless of hash cost.
- **`@noble/hashes` is the right library.** It is the audited, TypeScript-friendly choice for this space; it has no native dependencies; it exposes PBKDF2 directly (`pbkdf2Async(sha256, pass, salt, { c: 10_000, dkLen: 32 })`).
- **`expo-crypto` for salt generation** uses the platform CSPRNG (`SecRandomCopyBytes` on iOS, `SecureRandom` on Android). It is already a first-class Expo package; adding it costs nothing beyond the dependency entry.
- **Schema `version: 1` in the payload** gives us a one-line migration path if we ever need to bump iterations (e.g., if we later adopt `react-native-quick-crypto` for native PBKDF2 and can raise the cost) or switch to argon2id without nuking existing devices.

**Alternatives considered**:

- **Argon2id** — better theoretical resistance to GPU attacks. Rejected: no Expo-first pure-JS implementation that matches the audit quality of `@noble`; pulling a native module (`react-native-argon2`) adds friction and does not meaningfully raise the security bar for a device-enclave-protected hash of a 6-digit secret.
- **Bcrypt in pure JS** (e.g., `bcryptjs`) — works but is slower per iteration with no proportional gain; cost-factor tuning is more opaque than PBKDF2 iterations. Rejected.
- **A hand-rolled iterated SHA-256 via `expo-crypto.digestStringAsync` in a loop** — would be *not* PBKDF2 (wrong construction; misses the HMAC layer that prevents length-extension and keyed-vs-unkeyed variants). Rejected for correctness.
- **SHA-256(salt ‖ pin) with no iterations** — fails the offline-attack hypothetical badly (microseconds per guess). Rejected.
- **`react-native-quick-crypto`** — native, Node-crypto-compatible, fast. Would let us raise iterations to 100k+ without the UI freeze. Rejected for now (P3 — adds a native dep for a use case the 10k/pure-JS split already handles adequately). Revisit if a future audit requires higher iteration cost.
- **100k iterations in pure JS with a spinner** — rejected: ~20–30 s on mid-range Android blocks both PIN setup and every inactivity unlock. UX cost outweighs the marginal security gain (3.3 bits) for a low-entropy PIN.

---

## R3 — Secure-store key namespace

**Decision**: Use two keys under the `lock.` prefix, disjoint from 003's `auth.` namespace:

| Key                              | Value (JSON-encoded)                        | Lifecycle |
|----------------------------------|---------------------------------------------|-----------|
| `lock.pinCredential`             | `PinCredential` (see R2)                    | Set on first-run PIN setup and after PIN recovery. Deleted on `authService.logout()` (default behavior — even `preserveEmail: true` wipes the PIN, because the lock layer owns this key and the logout path's side-effect on the lock layer is what 004 FR-018 demands). Deleted on PIN recovery before the new PIN is set. |
| `lock.inactivityTimeoutMinutes`  | `{ minutes: number }` (integer, clamped to the allowed range) | Set the first time the salesperson adjusts the timeout, or on first run with the default value pre-persisted. Preserved on logout (the preference is a UX choice, not a secret tied to the session). Re-emitted on cold launch to rehydrate the inactivity tracker. |

Keys are accessed only through `src/features/lock/storage/lockStorage.ts`. No other file in the codebase may call `SecureStore.*` on a `lock.*` key.

**Rationale**:

- **Disjoint namespace** — 003's `secureStore.ts` contract says: *"Future auth-adjacent features (e.g., the §7 D6 local PIN) will add their own keys in their own storage wrapper and must not reuse these."* This satisfies that.
- **PIN wiped on logout** — FR-018 requires that logout wipes the PIN together with the session. The lock storage wrapper exposes `deletePinCredential()`; the `authService.logout()` extension (R5) invokes it as part of the logout side-effect chain.
- **Preference preserved on logout** — the salesperson's inactivity preference survives logout. Rationale: it's not a secret, and re-typing preferences on every logout is friction for no gain.
- **Two keys, not one blob** — the two entries have distinct lifecycles (PIN deleted on logout; preference preserved), exactly parallel to 003's `auth.refreshCredential` vs. `auth.lastEmail` decision.

**Alternatives considered**:

- **One combined blob** — would force a read-modify-write cycle and couple the lifecycles the spec keeps distinct. Rejected.
- **Persist the failed-attempts counter to disk** — rejected: spec Key Entities explicitly make it in-memory-only so cold launch is a clean window. Persisting would also mean a crash-loop at the OS level could permanently lock a legitimate salesperson out.
- **`AFTER_FIRST_UNLOCK` accessibility** — rejected, same reasoning as 003 R3: `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is stricter and sufficient; no auth-dependent background task reads the PIN hash.

---

## R4 — Inactivity detection mechanism

**Decision**: Subscribe to React Native's `AppState` in the `LockProvider` via `AppState.addEventListener('change', handler)`. Track a single in-memory number `backgroundedAtMs`:

- On transition `active → background | inactive`: set `backgroundedAtMs = Date.now()`.
- On transition `background | inactive → active`: compute `elapsed = Date.now() - backgroundedAtMs` (guard: if `backgroundedAtMs === null`, do nothing — first transition of the session). If `elapsed > timeoutMs`, emit `setLocked()`. Clear `backgroundedAtMs` regardless.
- Process kill: next session start is a cold launch. Bootstrap (R7) re-evaluates from secure store; backgroundedAtMs is not persisted.

Timeout range: min 1 minute, max 30 minutes. Default 5 minutes (constitutional). The chosen value is read at boot and re-read whenever the settings control writes it.

**Rationale**:

- **`AppState`** is the platform's canonical foreground/background signal in RN. It fires on both iOS (backgrounding + app-switcher) and Android (home button / task-switcher). No polling, no wall-clock timers — purely event-driven, which matches P3 (MVP simplicity).
- **In-memory only** — see plan.md Structure Decision. Cold launch always forces unlock (FR-005), so "process killed while backgrounded" is covered by the cold-launch bootstrap without the complexity of persisting wall-clock time (which has its own subtleties around device sleep and clock skew).
- **1–30 minute range** — 30 min caps the "I left my phone on a table at lunch" window; 1 min floor avoids trap configurations where the salesperson locks themselves out just by glancing at a neighboring app.
- **No foreground-idle tracking** — per spec Assumption: "inactivity timer runs on background time only; foreground time always resets it". An actively-used app in the foreground is trusted to have the salesperson present. This removes a big pile of gesture-tracking boilerplate (PanResponder listeners on every screen) and aligns with UX1.

**Alternatives considered**:

- **Idle timer on foreground inactivity** — would require wiring `PanResponder` or screen-level `onTouchEnd` handlers across the entire app tree. Rejected by P3.
- **A JS interval polling `Date.now()` vs. a "last active at" field** — wasteful; `AppState` is free. Rejected.
- **Persist `backgroundedAtMs`** — see above; cold launch covers it, and persistence opens a clock-skew attack (attacker clears the stored timestamp to reset the timer). Rejected.

---

## R5 — Lock-to-auth integration points

**Decision**: The lock feature touches the 003 auth feature through exactly three integration points, all scoped and reversible:

1. **`authService.logout({ preserveEmail?: boolean })`** — the 003 signature gains an optional `preserveEmail` flag, defaulting to `false` (preserves current 003 behavior). When `true`, `auth.lastEmail` is NOT deleted during logout. The lock feature invokes this with `{ preserveEmail: true }` only from the PIN-recovery path. This is a single-line 003 change inside `authService.logout()` — the default semantics are unchanged.
2. **Logout side-effect: wipe PIN**. `authService.logout()` gains an additional side-effect: after the auth wipe, it calls `lockStorage.deletePinCredential()` (but NOT `deleteInactivityPreference()` — R3 preserves the preference). This lives in 003's code because logout is initiated from 003; we avoid circular imports by exposing a tiny `{ deletePinCredential }` function from `@/features/lock/storage` and having the auth feature import it. The direction (auth → lock) is the side of the dependency we want — Auth doesn't know *about* the lock state machine, it just knows to wipe the PIN key when tearing down a session.
3. **`LockGate` lives under the `Home` branch of `RootNavigator`**. No auth module imports anything from lock; the integration is purely a rendering concern in `RootNavigator.tsx`, which already imports from both features.

**Rationale**:

- **Minimal 003 surface change** — one optional parameter, one extra side-effect line. Backwards compatible: every existing call site of `authService.logout()` continues to work unchanged.
- **The PIN wipe belongs to the logout event, not to a separate "post-logout cleanup"** — coupling it to `logout()` means there is no window between session teardown and PIN teardown. FR-018 says "On D5 logout, the PIN MUST be wiped along with the session credentials" — the word "along with" implies atomicity, and putting the wipe inside `logout()` gives it.
- **Directional dependency** — auth imports *one small* function from lock-storage, but lock does not import from auth's internals. The barrels stay clean.

**Alternatives considered**:

- **Observable pattern — lockStore subscribes to sessionStore** — e.g., when sessionStatus transitions to `NotAuthenticated`, lock wipes the PIN. Rejected: it decouples two actions that must be atomic, and it would mean a race where the PIN is briefly present after the session is torn down.
- **A new `authService.logoutAndWipePin()`** — rejected: doubles the API surface and leaves the original `logout()` as a footgun (callers might forget to use the wipe variant). Better to put the wipe inside the only `logout()` we have.
- **Keep 003 `logout()` unchanged and have the lock feature call its own "post-logout" handler via a sessionStore subscription** — rejected for the same atomicity concern.

---

## R6 — Progressive delay and forced-recovery threshold

**Decision**: Keep an in-memory `failedAttempts: number` in `lockStore`, resetting to 0 on a successful unlock and on cold launch (its the in-memory `Session lock state` per spec Key Entities). Apply the following curve:

| Consecutive wrong attempts | Next attempt delay | Notes |
|----------------------------|--------------------|-------|
| 1–3                        | 0 s                | Typos happen; no punishment. |
| 4                          | 1 s                | Light pushback. |
| 5                          | 2 s                | |
| 6                          | 5 s                | |
| 7                          | 10 s               | |
| 8                          | 20 s               | |
| 9                          | 30 s               | |
| 10                         | (no next attempt)  | The PIN pad is disabled; the salesperson is routed to the "Forgot PIN" recovery flow (FR-016). |

Delay is enforced by disabling the PIN pad and showing a countdown on the LockScreen. Biometric attempts do NOT contribute to this counter (biometric failure falls through to PIN, per FR-007, and an attacker with the hash could bypass this counter anyway — the real defense is the hash + enclave).

**Rationale**:

- **Curve shape** — forgiving at the top (accommodates genuine typos) and aggressive at the bottom (10 attempts is the forced-recovery wall, matching a reasonable "this is not the salesperson" confidence threshold given a 10^4–10^6 PIN space).
- **In-memory reset on cold launch** — per spec Key Entities. A power-cycle should not lock a legitimate user out forever; the progressive-delay policy is about defeating a shoulder-surfer running through attempts in one session, not about long-term durable lockout.
- **Recovery is the wall, not a lock-out screen** — routing to "Forgot PIN" after the Nth attempt is friendlier than a dead-end "try again tomorrow" and more secure than allowing indefinite retries (recovery requires network + valid Supabase credentials — a much higher bar for the attacker).

**Alternatives considered**:

- **Fixed short timeout (e.g. 30 s between every attempt)** — annoying for the legitimate user's first typo. Rejected.
- **Persistent attempt counter across cold launches** — provably safer against a sophisticated attacker, but also means a salesperson who mistyped twice, backgrounded to check something, and came back to a cold launch due to OS reclaim now starts at attempt 3. Rejected: the extra paranoia is not worth the real-world UX cost at MVP scale.
- **Permanently lock after N attempts without recovery route** — leaves a stranded device. Rejected.

---

## R7 — Bootstrap sequence on cold launch

**Decision**: Lock bootstrap (`state/bootstrap.ts`) runs inside `LockProvider`'s mount effect, after `SessionProvider` has completed `authBootstrap()`. The sequence:

1. Read `lock.pinCredential` from secure store.
2. If absent: `lockStore.setStatus('NotSet')`. (`LockGate` will render PinSetupScreen when the salesperson reaches Home.)
3. If present: `lockStore.setStatus('Locked')`. (`LockGate` renders LockScreen.)
4. Read `lock.inactivityTimeoutMinutes`. If present: hydrate the in-memory preference. If absent: pre-persist `{ minutes: 5 }` and hydrate with that default.
5. Start the `AppState` subscription (R4). Do not yet trust `backgroundedAtMs` — it is null until the first background transition.

`LockProvider` gates the rendering of its children on its own `bootstrapped` flag, in the same pattern `SessionProvider` already uses. Total added cold-launch work: two secure-store reads (small, in the tens of ms range) — well inside the SC-002 budget of 3 s.

**Rationale**:

- **Ordering** — lock depends on session having decided its own initial status because the LoginScreen only appears while session is `NotAuthenticated`, and we want `LockGate` *not* to second-guess that. If the session is `NotAuthenticated`, `LockGate` is simply not mounted (it lives under the Home branch of RootNavigator).
- **Pre-persisting the default inactivity timeout** — saves a branch in the AppState handler ("is there a preference, or do I use the default?"). After boot, there's always a value.
- **Separate `bootstrapped` flag** — mirrors the 003 pattern and avoids a flicker where the lock-screen briefly doesn't know whether to show setup or lock.

**Alternatives considered**:

- **Fold lock bootstrap into the SessionProvider** — rejected: couples the two features in a way FR-017 specifically avoids. A separate Provider is a clean seam.
- **Lazy-bootstrap on first `useLock()` call** — rejected: introduces a race where the first component to render under the gate sees `NotSet` (the default) for a frame before the bootstrap finishes and corrects it.

---

## R8 — PIN recovery flow

**Decision**: Recovery is a one-shot state transition orchestrated by `lockService.beginPinRecovery()`:

1. `LockScreen` → user taps "Esqueci meu PIN" → navigates to `PinRecoveryConfirmScreen`.
2. `PinRecoveryConfirmScreen` shows the reassurance copy (Portuguese): *"Para redefinir seu PIN, você precisará entrar de novo com e-mail e senha. Seus dados permanecem no aparelho."* — with two buttons: "Continuar" and "Cancelar". If offline at this moment, "Continuar" is disabled and a "Conecte-se à internet para continuar" message appears.
3. On "Continuar": call `lockService.beginPinRecovery()`:
   - `lockStorage.deletePinCredential()` — wipe the old PIN.
   - `authService.logout({ preserveEmail: true })` — wipe the refresh token + last-refresh timestamp, KEEP `auth.lastEmail`. `SessionStore` transitions to `NotAuthenticated`.
   - `RootNavigator` observes `NotAuthenticated` → renders `AuthStack / LoginScreen` (the existing 003 screen, pre-filling the email from `auth.lastEmail`).
4. The salesperson types their password → `LoginScreen` calls `authService.login({ email, password })` as usual → `Authenticated` again → `RootNavigator` swaps back to HomeStack.
5. `LockGate` reads `lockStore.status`. Because the PIN was wiped in step 3, status is `NotSet` → `LockGate` renders `PinSetupScreen` → salesperson sets a new PIN → `lockStore.setStatus('Unlocked')` → `LockGate` renders Home.
6. If the salesperson cancels at any point (hits back before completing LoginScreen): they stay `NotAuthenticated` and locked out of Home. Tapping the app again drops them on LoginScreen. This is acceptable — they *started* a recovery and the refresh token is already gone; they have to complete the re-login to get back in. No local business data is touched.

If the salesperson is offline during step 3, we do NOT call `lockStorage.deletePinCredential()` — the UI blocks at step 2 with the "connect to the internet" message, so the PIN is still there and they can still unlock with biometric or PIN if they remember it (or cancel recovery and retry later).

**Rationale**:

- **No new screens for the credential exchange** — the existing `LoginScreen` already handles pre-fill, error mapping, password show/hide, and the `authService.login()` call. Duplicating it would violate P3.
- **Ordering of wipes (PIN first, then session)** — if the session wipe fails (e.g., `expo-secure-store` throws), we have a lingering PIN but no session. The lock feature tolerates this gracefully: next cold launch, the session is wiped but the PIN is still wiped (because we wiped it first). The worst case is the salesperson sees "LoginScreen → PIN setup" instead of "LoginScreen → unlock-with-existing-PIN", which is the safer failure mode.
- **Offline check happens before any wipe** — FR-014 requires that PIN recovery MUST NOT proceed offline AND MUST NOT alter existing state while offline. The interstitial is the enforcement point.

**Alternatives considered**:

- **A dedicated `PinRecoveryLoginScreen` with its own credential form** — rejected per R8 above.
- **Call `supabase.auth.signInWithPassword` directly from `lockService.beginPinRecovery()`** — rejected: duplicates login-flow error handling, bypasses the 003 invariants (e.g., session state transitions, `auth.refreshCredential` write), and concentrates Supabase knowledge outside the auth feature.
- **Session wipe first, then PIN wipe** — rejected per the ordering analysis above. Wiping the PIN first makes the "half-failed recovery" state recoverable by a clean re-login.

---

## R9 — Lock state machine

**Decision**: Three statuses, one store.

```text
                          ┌──────────────────┐
                          │      NotSet      │  ← cold-launch bootstrap finds no PIN credential
                          └────────┬─────────┘
                                   │ lockService.setupPin(pin)  (FR-001..004)
                                   ▼
                          ┌──────────────────┐
                          │     Unlocked     │  ← post-setup, salesperson is in the app
                          └───┬──────────┬───┘
                              │          │
     inactivity.expired()     │          │ authService.logout()  OR  beginPinRecovery()
     OR cold-launch with      │          ▼
     existing PIN             │   ┌──────────────────┐
                              │   │      NotSet      │
                              ▼   └──────────────────┘
                          ┌──────────────────┐
                          │      Locked      │
                          └──┬───────────┬───┘
                             │           │
 unlockWithBiometric() or   │           │ beginPinRecovery() path (R8)
 verifyPin(correct)          │           ▼
                             │   (eventually returns to NotSet and then Unlocked
                             │    through LoginScreen → PinSetupScreen)
                             ▼
                         Unlocked
```

Internal-only state (not in the public snapshot):
- `backgroundedAtMs: number | null` — R4.
- `failedAttempts: number` — R6.

Public snapshot exposes only `status`. Callers of `useLock()` do not branch on internal flags.

**Rationale**:

- **Three public states are enough.** `NotSet` is distinct from `Locked` because PinSetupScreen and LockScreen are different UIs; collapsing them would force the component to branch internally, which is uglier than branching at the navigator level.
- **No "Unlocking" intermediate state.** The biometric prompt is OS-owned and synchronous from our perspective (we await `authenticateAsync()`); between `authenticate` and the status flip there is no React render, so no spinner state is needed.
- **Internal flags are invisible** to match the 003 `_queuedSync / _isRefreshing` pattern — they are implementation details of the state machine, not public API.

**Alternatives considered**:

- **Four states including an explicit `Recovering`** — rejected: recovery is a navigation flow, not a state. `Locked → (session flips to NotAuthenticated) → Locked is never observed` because RootNavigator unmounts LockGate the moment session is `NotAuthenticated`. When we land back in Home post-recovery, the status is already `NotSet` due to the PIN wipe.
- **Two states (Locked / Unlocked) with "no PIN set" folded into Locked and branched on inside `LockScreen`** — rejected, as above.

---

## R10 — Test surface

**Decision**: Ship four test files covering the genuinely stateful logic:

- **`pinHash.test.ts`** — hash round-trip, wrong PIN returns false, different salts produce different hashes, different PINs produce different hashes with the same salt, payload schema version is 1. Mocks none — PBKDF2 is deterministic.
- **`lockStore.test.ts`** — every transition in R9, including invariants (`NotSet` can only come from bootstrap-with-no-PIN, logout, or recovery; `Unlocked → Locked` transitions clear `failedAttempts`; `Locked → Unlocked` clears `backgroundedAtMs`). Mocks out `lockStorage` (no real secure-store calls in unit tests).
- **`inactivity.test.ts`** — pure-function test: given `{ backgroundedAtMs, nowMs, timeoutMinutes }`, does the policy say to lock? Covers edge cases (backgroundedAtMs null, timeout exactly met, timeout exceeded by 1 ms, negative elapsed due to clock skew — ignored, treated as 0).
- **`lockStorage.test.ts`** — encoding/decoding round-trip, missing-key returns null, partial/corrupted payload returns null, write rejection propagates.

Not unit-tested: `biometricAdapter` (thin wrapper over an OS API), the React components (screens, PinPad, Provider, Gate), the AppState subscription. These are integration points and are verified manually against the spec's acceptance scenarios.

**Rationale**:

- Constitution §9 puts test budget on business logic. Crypto correctness, state-machine transitions, and the inactivity-expiry calculation are the three places where a silent logic bug would cause either a security regression (wrong hashing, transitions that skip the wall) or a UX regression (wrong inactivity decision).
- **`biometricAdapter` is deliberately not unit-tested** because it is a 20-line wrapper whose entire purpose is to abstract the OS API behind a discriminated-union return. A unit test would only verify that we pass-through the mock, which is zero signal.

**Alternatives considered**:

- **No tests** — acceptable per §9 for pure plumbing, but the state machine and the hash function are not plumbing. Rejected.
- **Full E2E** (Detox / Maestro) — premature for the MVP; `expo-local-authentication` is not meaningfully drivable from an E2E harness without a mock build anyway. Rejected.

---

## R11 — Pencil design decision

**Decision**: Run `/speckit-pencil-design` OR reuse 003's auth-screen visual pattern (centered card on tablet, full-width card on phone) with a minor variant for the PIN pad. The plan and the screens contract commit to one outcome before implementation begins: either three new Pencil frames (PinSetup, Lock, PinRecoveryConfirm — each at phone 390×844 and tablet 820×1180, per UX5) land under `specs/004-local-lock/design/`, or a one-page "design-reuse note" under the same path explicitly states that no new frames are needed and lists the 003 primitives being reused.

**Rationale**:

- **UX5 requires both viewports ship.** Either path satisfies that; the task list will block screen-implementation closure on tablet-simulator verification regardless of which path is taken.
- **003 set a strong precedent** for a centered-card, shadcn-light aesthetic that the lock screens can wear without looking out of place. The PIN pad is the one new element; it can live inside the same card frame.

**Alternatives considered**:

- **Ship without Pencil frames and without an explicit reuse note** — rejected: violates UX5's design-time requirement.
- **Block implementation on Pencil frames even if reuse is obviously sufficient** — rejected as busywork; the reuse-note path is a legitimate escape hatch when it's honest.

---

## R12 — OS task-switcher snapshot masking *(DEFERRED — post-MVP)*

**Decision**: FR-022 is **out of scope for the MVP**. No privacy-snapshot integration ships with this feature.

**Context of deferral**: The originally-chosen library — `react-native-privacy-snapshot` — is a pre-TurboModule package (~2016) that does not expose any bindings under React Native's new architecture. With `newArchEnabled: true` in `app.json` (a project-wide choice inherited from the Expo baseline), `NativeModules.PrivacySnapshot` resolves to `null` at runtime and the intended `PrivacySnapshot.enabled(true)` call is a no-op crash. A full prebuild (`pnpm exec expo prebuild --clean`) followed by a native rebuild confirmed the incompatibility — the module is not linked into either the iOS or Android build because it does not ship a new-arch spec.

**Rationale for descoping (not forcing an alternative)**:

- **Residual risk is narrow.** The D6 threat model ("lost or stolen device", constitution §7) is primarily addressed by FR-005 (cold-start lock) and FR-006 (post-inactivity lock): anyone who gains the device must clear the lock screen to reach business data. The only window FR-022 would close is the OS-captured thumbnail shown in the task-switcher *while the legitimate salesperson is still the last user*. A persistent attacker with the device in hand bypasses the thumbnail trivially by tapping into the app.
- **Alternatives carry MVP-disproportionate cost.** A purpose-built config plugin (iOS `UIBlurEffect` on `applicationWillResignActive` + Android `FLAG_SECURE`) is tractable but non-trivial native work — outside the MVP envelope for a feature whose primary-value surface (cold-start + inactivity lock + PIN recovery) is already landed. Pure JS overlays via `AppState` have timing gaps on iOS and do not reliably cover the OS snapshot pass.
- **Room to revisit.** When a new-arch-compatible mask library lands (tracked via Expo/community releases), or if the security audit that accompanies a post-MVP release demands the coverage, FR-022 and SC-012 can be re-activated with a targeted follow-up. The rest of the lock feature is unaffected.

**Alternatives reviewed and not taken at MVP**:

- **`react-native-privacy-snapshot`** — rejected: new-arch incompatibility confirmed empirically.
- **Custom config plugin (iOS + Android)** — deferred: correct solution, disproportionate for MVP.
- **`expo-screen-capture` `preventScreenCaptureAsync`** — rejected: different attacker surface (blocks screenshots, not the task-switcher snapshot).
- **JS-only `AppState` overlay** — rejected: timing-fragile on iOS; does not reliably cover the OS snapshot pass.

---

## Summary of decisions → plan updates

- Biometric via `expo-local-authentication` with `disableDeviceFallback: true` (R1).
- PIN hashing via `@noble/hashes` PBKDF2-SHA-256 @ 10k iterations (chosen for a ~2–3 s UX budget on pure-JS derivation; see R2 for the trade-off) with a 16-byte per-device salt from `expo-crypto` (R2).
- Two secure-store keys: `lock.pinCredential` (wiped on logout and on PIN recovery) and `lock.inactivityTimeoutMinutes` (preserved on logout) (R3).
- Inactivity via `AppState` + in-memory `backgroundedAtMs`; no foreground-idle tracking; 1–30 min range, 5 min default (R4).
- 003 integration: `authService.logout({ preserveEmail?: boolean })` + a post-logout `lockStorage.deletePinCredential()` call — one-line change to 003, directional import (auth → lock.storage) (R5).
- Progressive delay curve 1s→2s→5s→10s→20s→30s for attempts 4–9; attempt 10 routes to recovery; in-memory counter resets on cold launch (R6).
- Cold-launch bootstrap runs inside LockProvider after SessionProvider is ready; two secure-store reads, gated render (R7).
- PIN recovery routes through the existing LoginScreen via `preserveEmail: true` logout; no new credential screen (R8).
- Three-state machine (NotSet / Locked / Unlocked) with hidden `backgroundedAtMs` and `failedAttempts` flags (R9).
- Tests: pinHash, lockStore state machine, inactivity math, lockStorage round-trip (R10).
- Pencil: fresh frames OR a documented reuse note before implementation, phone + tablet either way (R11).
- OS task-switcher snapshot masking (FR-022 / SC-012) is **descoped from MVP** — no library integration ships. See R12 for the deferral rationale.

No unresolved `NEEDS CLARIFICATION` remains.
