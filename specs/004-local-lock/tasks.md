# Tasks: Mandatory Local Lock

**Input**: Design documents from `/specs/004-local-lock/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/lock-service.md](./contracts/lock-service.md), [contracts/lock-storage.md](./contracts/lock-storage.md), [contracts/biometric-adapter.md](./contracts/biometric-adapter.md), [contracts/state-machine.md](./contracts/state-machine.md), [contracts/screens.md](./contracts/screens.md), [quickstart.md](./quickstart.md)

**Tests**: Four unit-test files, per constitution §9 and [research.md R10](./research.md#r10--test-surface): `pinHash`, `lockStore`, `inactivity` (pure function), `lockStorage`. No UI tests. No integration tests. Biometric adapter and React components are integration points verified manually against the acceptance scenarios in [spec.md](./spec.md).

**Organization**: Tasks are grouped by user story per the spec's P1/P2/P3 ordering.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Relative-to-repo-root file paths

## Path Conventions

- Source layout from [plan.md Project Structure](./plan.md#project-structure): `src/features/lock/` owns everything lock-specific. The 003 auth feature is minimally extended via one task in US3.
- All identifiers in English (constitution §9). UI copy in Portuguese — exact strings owned by the screen implementation; this task list references behavior, not copy.
- Every create/edit cites the exact file path.
- `jest` + `ts-jest` + the `jest.config.ts` at repo root are already installed (from 003 block). No new test tooling in this block.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the three new runtime dependencies (biometrics, CSPRNG, PBKDF2), declare the Expo plugin entry, scaffold the `src/features/lock/` directory tree, and regenerate native projects.

- [ ] T001 Install runtime dependencies: run `pnpm add expo-local-authentication expo-crypto @noble/hashes` at repo root. Verify the resulting `package.json` lists all three under `dependencies`. No new dev dependencies — Jest + ts-jest are already in place from the 003 block. *(FR-022 dependency `react-native-privacy-snapshot` was descoped — see research R12.)*
- [x] T002 [P] Edit `app.json` — append `"expo-local-authentication"` to the `expo.plugins` array. `expo-crypto` and `@noble/hashes` need no plugin entry. Leave `"expo-secure-store"` and other existing plugins untouched.
- [x] T003 [P] Create the directory skeleton under `src/features/lock/`: `service/`, `state/`, `storage/`, `crypto/`, `biometric/`, `hooks/`, `components/`, `screens/`, `tests/`. No files yet — Phase 2 populates them.
- [ ] T004 Run `pnpm exec expo prebuild --clean` to regenerate `ios/` and `android/` with the newly-linked native module (`expo-local-authentication`). `expo-crypto` bundles with the core Expo native module already linked; `@noble/hashes` is pure JS. Commit the regenerated native project files. Depends T001, T002. *Note: one-time local action; subsequent clones rerun via `pnpm install && pnpm exec expo prebuild`.*

**Checkpoint**: Project builds a dev client; `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass on the pre-004 codebase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land every piece of lock-feature infrastructure shared across US1/US2/US3 — secure-store wrapper, crypto (salt + PBKDF2), biometric adapter, error class, state store + emitter, bootstrap, AppState listener skeleton (US2 completes the transition logic), React hook, Provider, lockService skeleton, PinPad primitive, conservative barrel, four unit tests, and the `AppProviders` wiring. RootNavigator wiring is deferred to US1 — nothing visible changes until the gate + screens land together.

**⚠️ CRITICAL**: No work in Phases 3–5 may begin until all Phase 2 tasks complete.

- [x] T005 [P] Create `src/features/lock/storage/lockStorage.ts` per [contracts/lock-storage.md](./contracts/lock-storage.md). Exports:
  - Types `PinCredential` (with `algo: 'PBKDF2-HMAC-SHA256'`, `iterations: 10000`, `saltHex`, `hashHex`, `version: 1`) and `InactivityPreference` (`{ minutes: number, version: 1 }`).
  - Object `lockStorage` with four methods: `getPinCredential()`, `setPinCredential(cred)`, `getInactivityPreference()`, `setInactivityPreference(pref)`. All pass `{ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }` on `setItemAsync`.
  - Standalone function `deletePinCredential(): Promise<void>` (idempotent — no-op if the key is absent). This is the one export legal for auth → lock cross-import (consumed by T032).
  - Read-side validation per [contracts/lock-storage.md §Encoding rules](./contracts/lock-storage.md#encoding-rules): regex `/^[0-9a-f]{32}$/` for `saltHex`, `/^[0-9a-f]{64}$/` for `hashHex`, `version === 1` check. Validation failure returns `null`. `InactivityPreference.minutes` is clamped to `[1, 30]` on read without rewriting the store. Keys are `'lock.pinCredential'` and `'lock.inactivityTimeoutMinutes'`.
- [x] T006 [P] Create `src/features/lock/crypto/random.ts` — a thin wrapper over `expo-crypto.getRandomBytesAsync`. Export `generateSaltHex(byteLength: number = 16): Promise<string>` that calls `getRandomBytesAsync(byteLength)` and converts the `Uint8Array` result to a lowercase hex string. No retry logic; errors propagate.
- [x] T007 [P] Create `src/features/lock/crypto/pinHash.ts` — PBKDF2 wrapper. Import `pbkdf2` from `@noble/hashes/pbkdf2` and `sha256` from `@noble/hashes/sha256`. Export:
  - `type PinCredential` re-imported from `@/features/lock/storage/lockStorage`.
  - `async function hashPin(pin: string, saltHex: string, iterations: number = 10_000): Promise<string>` — runs `pbkdf2(sha256, utf8ToBytes(pin), hexToBytes(saltHex), { c: iterations, dkLen: 32 })` and returns the 64-char lowercase hex string. *(10k chosen for pure-JS UX budget — see research R2.)*
  - `async function verifyPin(pin: string, credential: PinCredential): Promise<boolean>` — recomputes `hashPin(pin, credential.saltHex, credential.iterations)` and compares to `credential.hashHex` via constant-time equality (loop over the hex chars accumulating OR of differences). Never logs the PIN, salt, or hash.
  - `async function createCredentialFromPin(pin: string): Promise<PinCredential>` — generates a salt via `generateSaltHex(16)`, computes hash, returns `{ algo: 'PBKDF2-HMAC-SHA256', iterations: 10_000, saltHex, hashHex, version: 1 }`.
  Depends T006.
- [x] T008 [P] Create `src/features/lock/biometric/biometricAdapter.ts` per [contracts/biometric-adapter.md](./contracts/biometric-adapter.md). Exports:
  - `type BiometricResult = 'success' | 'failed' | 'cancelled' | 'unavailable'`.
  - `biometricAdapter` object with `isAvailable(): Promise<boolean>` (memoized on first call — `LocalAuthentication.hasHardwareAsync() && LocalAuthentication.isEnrolledAsync()`) and `authenticate(options: { promptMessage: string; cancelLabel: string }): Promise<BiometricResult>`. Configuration passed to `authenticateAsync`: `{ promptMessage, cancelLabel, disableDeviceFallback: true, fallbackLabel: undefined, requireConfirmation: false }`. Mapping from `expo-local-authentication` error codes to `BiometricResult` per the table in [contracts/biometric-adapter.md §Result mapping](./contracts/biometric-adapter.md#result-mapping-from-expo-local-authentication--biometricresult). Wrap thrown exceptions as `'unavailable'`.
- [x] T009 [P] Create `src/features/lock/service/errors.ts` — export `class LockError extends Error { readonly code: 'PIN_INVALID_LENGTH' | 'PIN_MISMATCH' | 'BIOMETRIC_UNAVAILABLE' | 'BIOMETRIC_FAILED' | 'RECOVERY_OFFLINE' | 'TOO_MANY_ATTEMPTS' | 'STORAGE_UNAVAILABLE' }`. Constructor accepts `(code, message?)`. Never carries the plaintext PIN, never carries raw OS error payloads.
- [x] T010 [P] Create `src/features/lock/state/lockStore.ts` per [contracts/state-machine.md](./contracts/state-machine.md):
  - `type LockStatus = 'NotSet' | 'Locked' | 'Unlocked'`; `type LockSnapshot = { status: LockStatus }`.
  - `export const lockStore: { getSnapshot(): LockSnapshot; subscribe(listener: () => void): () => void }`. Subscribers held in a `Set<() => void>`; notify after each mutation that changes the public status. Freeze snapshots in `__DEV__`. Guard listeners against re-entrancy in `__DEV__` (throw `DevError` if a listener synchronously triggers another transition).
  - `export const _internalLockStore: { setStatus(s), setInactivityTimeoutMinutes(n), getInactivityTimeoutMinutes(), setBackgroundedAt(ms | null), getBackgroundedAt(), incrementFailedAttempts(), resetFailedAttempts(), getFailedAttempts() }`. Only `setStatus` emits; all other setters mutate the internal state silently. `setStatus` is a no-op (no emission) if the new status equals the current status AFTER enforcing the illegal-transition guards in [contracts/state-machine.md §State machine](./contracts/state-machine.md#state-machine--the-authoritative-table). In `__DEV__`, throw on illegal transitions (`NotSet → Locked` directly, `Unlocked → NotSet` via any path other than the ones enumerated).
  - Additionally export `getProgressiveDelayMs(failedAttempts: number): number` from this file — a pure function implementing [research.md R6](./research.md#r6--progressive-delay-and-forced-recovery-threshold)'s curve: returns 0 for attempts 1–3, 1000 for 4, 2000 for 5, 5000 for 6, 10000 for 7, 20000 for 8, 30000 for 9, and `Infinity` for >= 10 (caller's signal to route to recovery).
- [x] T011 [P] Create `src/features/lock/components/PinPad.tsx` — a numeric-input primitive. Props: `{ value: string; onChange: (next: string) => void; maxLength: 4 | 5 | 6; onSubmit?: () => void; disabled?: boolean }`. Layout: 3×4 grid of `Pressable` keys (`1..9`, blank, `0`, backspace). Each key updates `value` (append digit if below maxLength; remove last on backspace). On Submit press (or when `value.length === maxLength` and `onSubmit` provided), call `onSubmit?.()`. Uses shadcn tokens from `@/features/auth/theme/tokens` — **explicit allowed cross-feature import of design tokens only** (document this at the top of the file with a one-line comment). Respects `disabled` by dimming keys and ignoring presses.
- [x] T012 [P] Create `src/features/lock/hooks/useLock.ts` — `useSyncExternalStore(lockStore.subscribe, lockStore.getSnapshot)` returning exactly `{ status }`. Also create `src/features/lock/hooks/useLockFailedAttempts.ts` — a tiny hook that polls `_internalLockStore.getFailedAttempts()` via a React state cell updated on every `lockStore` emission (subscribe + `getFailedAttempts()` on change). Marked internal — NOT re-exported from the barrel; consumed only by `LockScreen` (T024).
- [x] T013 Create `src/features/lock/state/bootstrap.ts` per [contracts/state-machine.md §Bootstrap contract](./contracts/state-machine.md#bootstrap-contract). Export `async function lockBootstrap(): Promise<void>`:
  1. `const [credential, preference] = await Promise.all([lockStorage.getPinCredential(), lockStorage.getInactivityPreference()])`.
  2. If `preference === null`: `await lockStorage.setInactivityPreference({ minutes: 5, version: 1 }); _internalLockStore.setInactivityTimeoutMinutes(5)`. Else: `_internalLockStore.setInactivityTimeoutMinutes(preference.minutes)` (value is already clamped by the wrapper).
  3. If `credential === null`: `_internalLockStore.setStatus('NotSet')`. Else: `_internalLockStore.setStatus('Locked')`.
  Depends T005, T010.
- [x] T014 Create `src/features/lock/state/inactivity.ts` per [contracts/state-machine.md §Inactivity tracker contract](./contracts/state-machine.md#inactivity-tracker-contract). **Phase 2 lands the SKELETON**: export `startInactivityListener(): () => void` that subscribes to `AppState.addEventListener('change', handler)` and tracks `backgroundedAtMs` on transitions (`active → background | inactive` sets, `background | inactive → active` clears). The skeleton does NOT yet transition `Unlocked → Locked` — that logic is US2 (T029). Also export the pure helper `export function isInactivityExpired(input: { backgroundedAtMs: number | null; nowMs: number; timeoutMinutes: number }): boolean` for unit testing — returns `false` when `backgroundedAtMs === null` or when `nowMs - backgroundedAtMs <= timeoutMinutes * 60 * 1000`; returns `true` otherwise. Guard against negative elapsed values (clock skew) by clamping elapsed to `Math.max(0, nowMs - backgroundedAtMs)`. Depends T010.
- [x] T015 Create `src/features/lock/components/LockProvider.tsx` — React component. On mount: `useEffect(() => { let cancelled = false; (async () => { await lockBootstrap(); if (cancelled) return; setBootstrapped(true); })(); const stopInactivity = startInactivityListener(); return () => { cancelled = true; stopInactivity(); }; }, [])`. If `!bootstrapped`, render `null`. Else render `{children}`. Does NOT inject a React Context. Depends T013, T014.
- [x] T016 Create `src/features/lock/service/lockService.ts` SKELETON per [contracts/lock-service.md §lockService shape](./contracts/lock-service.md#lockservice-shape). Export `const lockService = { setupPin, verifyPin, unlockWithBiometric, beginPinRecovery, setInactivityTimeout, getInactivityTimeout }`. All methods except `getInactivityTimeout` throw `new Error('not implemented')`. `getInactivityTimeout` returns `_internalLockStore.getInactivityTimeoutMinutes()`. Signatures exactly per the contract. US1 fills in `setupPin`/`verifyPin`/`unlockWithBiometric` (T022); US2 fills in `setInactivityTimeout` (T031); US3 fills in `beginPinRecovery` (T036). Lets the barrel (T017) compile now.
- [x] T017 Create `src/features/lock/index.ts` — CONSERVATIVE barrel re-exporting **only** what Phase 2 ships: `lockService`, `useLock`, `LockProvider`, `LockError` (value and type `LockErrorCode`), types `LockStatus`, `LockSnapshot`. Does NOT yet re-export `LockGate`, `PinSetupScreen`, `LockScreen`, `PinRecoveryConfirmScreen` (US1/US3 extend the barrel as those screens land). Document at the top: "Design tokens from `@/features/auth/theme/tokens` are the one allowed cross-feature import; internal state (`lockStore`, `_internalLockStore`, `lockStorage`, `biometricAdapter`, `pinHash`, `random`, `bootstrap`, `inactivity`, `useLockFailedAttempts`) is NOT re-exported. `deletePinCredential` is a direct import path for the auth logout integration only (T032)."
- [x] T018 Edit `src/app/providers/AppProviders.tsx` — wrap the existing provider tree with `<LockProvider>` (inside `<SessionProvider>`). Final shape:
  ```tsx
  export function AppProviders({ children }) {
    return (
      <SessionProvider>
        <LockProvider>
          <SafeAreaProvider>{children}</SafeAreaProvider>
        </LockProvider>
      </SessionProvider>
    );
  }
  ```
  LockProvider goes INSIDE SessionProvider because US3's recovery flow uses `authService.logout` — outer-provider initializes first. *(FR-022 privacy-snapshot integration was descoped from MVP — see research R12.)* Depends T015.
- [x] T019 [P] Create `src/features/lock/tests/pinHash.test.ts` — unit tests covering:
  - `hashPin(pin, salt, iters)` produces identical output for identical inputs (determinism).
  - `hashPin(pin1, salt, iters)` ≠ `hashPin(pin2, salt, iters)` for distinct PINs.
  - `hashPin(pin, salt1, iters)` ≠ `hashPin(pin, salt2, iters)` for distinct salts.
  - `verifyPin(correctPin, credential)` returns `true`; `verifyPin(wrongPin, credential)` returns `false`.
  - `createCredentialFromPin(pin)` returns a well-formed `PinCredential` (`algo === 'PBKDF2-HMAC-SHA256'`, `iterations === 10_000`, `version === 1`, salt 32 hex chars, hash 64 hex chars).
  - Constant-time equality: a test that flips the last byte of `hashHex` in a credential and confirms `verifyPin` still returns `false` without short-circuiting (mechanical — the test just calls and asserts; it does not measure timing).
  Mock `expo-crypto.getRandomBytesAsync` to return a deterministic salt for the creation test (via `jest.mock('expo-crypto', ...)`). Depends T006, T007.
- [x] T020 [P] Create `src/features/lock/tests/lockStore.test.ts` — unit tests covering every row of [contracts/state-machine.md §State machine](./contracts/state-machine.md#state-machine--the-authoritative-table):
  - boot → NotSet (bootstrap with null credential).
  - boot → Locked (bootstrap with credential present).
  - NotSet → Unlocked (setStatus('Unlocked') after setup).
  - Unlocked → Locked (setStatus('Locked')).
  - Locked → Unlocked (setStatus after successful unlock).
  - Locked → Locked silent-no-emit (setStatus('Locked') when already Locked does not notify subscribers).
  - Unlocked → NotSet (setStatus after logout path).
  - `getProgressiveDelayMs`: 0 for 0–3 attempts, 1000/2000/5000/10000/20000/30000 for 4–9, `Infinity` for ≥10.
  - Subscribers receive notifications exactly once per transition.
  - `__DEV__` guard: illegal transition `NotSet → Locked` throws in dev, is a no-op in prod.
  - Frozen snapshot: `Object.isFrozen(getSnapshot())` is true in `__DEV__`.
  Mock `lockStorage` entirely (`jest.mock('../storage/lockStorage')`). Depends T010.
- [x] T021 [P] Create `src/features/lock/tests/inactivity.test.ts` — pure-function tests for `isInactivityExpired`:
  - Returns `false` when `backgroundedAtMs === null`.
  - Returns `false` when `nowMs - backgroundedAtMs === timeoutMinutes * 60_000` (boundary — timeout not strictly exceeded).
  - Returns `true` when `nowMs - backgroundedAtMs === timeoutMinutes * 60_000 + 1`.
  - Returns `false` when `nowMs < backgroundedAtMs` (clock skew — elapsed clamped to 0).
  - Returns `true` for a background-and-return spanning 10 minutes with a 5-min timeout; returns `false` for a 3-min span with a 5-min timeout.
  Depends T014.
- [x] T022 [P] Create `src/features/lock/tests/lockStorage.test.ts` — unit tests:
  - `setPinCredential` round-trip: set, then `getPinCredential` returns the same object.
  - `getPinCredential` returns `null` when the key is absent.
  - `getPinCredential` returns `null` when `JSON.parse` fails (mock raw string return).
  - `getPinCredential` returns `null` when saltHex or hashHex fails the regex validation.
  - `getPinCredential` returns `null` when `version !== 1`.
  - `getInactivityPreference` round-trip with `minutes === 5`.
  - `getInactivityPreference` clamps stored `minutes: 0` to `1` and `minutes: 100` to `30` without rewriting.
  - `deletePinCredential` is idempotent (call twice, no throw).
  - Every `setItemAsync` invocation is called with `{ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' }` — verified via jest mock assertion.
  Mock `expo-secure-store` via `jest.mock`. Depends T005.

**Checkpoint**: `pnpm typecheck` + `pnpm test` green (old + four new). `pnpm lint` green. Dev-client boots; `LockProvider` runs its bootstrap (a `lock.pinCredential` does not exist yet on any device), `lockStore.status === 'NotSet'`, AppState listener records `backgroundedAtMs` (with no visible effect yet). The app still behaves exactly like the 003 scaffold for any existing user — the gate is not yet wrapping Home. This is by design: US1 is what makes the lock visible.

---

## Phase 3: User Story 1 — Set PIN Once, Unlock Daily With Finger or PIN (Priority: P1) 🎯 MVP

**Goal**: Fresh install → online login (from 003) → forced PIN setup → Home. Kill app → cold-launch → biometric prompt if enrolled, else PIN pad → correct PIN or biometric success → Home. Biometric failure or cancellation falls through to PIN instantly. No network calls on unlock.

**Independent Test**: Fresh install on a device WITH biometric enrollment. Login (003) → PIN setup appears → type 4–6 digits → confirm → Home. Kill app. Airplane mode. Cold-launch → biometric prompt appears → success → Home. Repeat on a device WITHOUT biometric enrollment: cold-launch lands on PIN pad directly — no biometric flash, no error.

### Implementation for User Story 1

- [x] T023 [US1] Implement `lockService.setupPin`, `lockService.verifyPin`, and `lockService.unlockWithBiometric` in `src/features/lock/service/lockService.ts`:
  - `async setupPin(pin: string): Promise<void>`:
    1. If `!/^\d{4,6}$/.test(pin)`: `throw new LockError('PIN_INVALID_LENGTH')`.
    2. `const credential = await createCredentialFromPin(pin)`.
    3. `await lockStorage.setPinCredential(credential)` (throws propagate as `LockError('STORAGE_UNAVAILABLE')` — wrap with `try/catch` + rethrow).
    4. `_internalLockStore.setStatus('Unlocked')`.
  - `async verifyPin(pin: string): Promise<boolean>`:
    1. If `!/^\d{4,6}$/.test(pin)`: `throw new LockError('PIN_INVALID_LENGTH')`.
    2. If `_internalLockStore.getFailedAttempts() >= 10`: `throw new LockError('TOO_MANY_ATTEMPTS')`.
    3. `const credential = await lockStorage.getPinCredential()`. If null: `throw new LockError('STORAGE_UNAVAILABLE')` (illegal state — verify called without a stored PIN).
    4. `const ok = await verifyPin_from_crypto(pin, credential)` (import from `../crypto/pinHash` — rename the local import to disambiguate from the service method).
    5. If `ok`: `_internalLockStore.resetFailedAttempts(); _internalLockStore.setStatus('Unlocked'); return true`.
    6. Else: `_internalLockStore.incrementFailedAttempts(); return false`.
  - `async unlockWithBiometric(): Promise<'success' | 'failed' | 'cancelled' | 'unavailable'>`:
    1. `const available = await biometricAdapter.isAvailable()`. If false, return `'unavailable'`.
    2. `const result = await biometricAdapter.authenticate({ promptMessage: <Portuguese "Desbloqueie para acessar o catálogo">, cancelLabel: <Portuguese "Usar PIN"> })`. Exact Portuguese strings live inline here (constitution §9 allows, since lockService is the orchestration point that knows the user-facing prompt; the alternative of passing strings down from a screen would leak UI concerns into a service). Note: the lock spec does not treat these two short OS-prompt strings as "UI copy owned by the screen" — they are OS-dialog text, and the service is the logical owner.
    3. If `result === 'success'`: `_internalLockStore.setStatus('Unlocked')`. `failedAttempts` is NOT touched (biometric does not contribute to the PIN counter).
    4. Return `result` verbatim.
  Depends T005, T007, T008, T010, T016. FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008.
- [x] T024 [US1] Create `src/features/lock/screens/PinSetupScreen.tsx` per [contracts/screens.md §PinSetupScreen](./contracts/screens.md#pinsetupscreen). Two local sub-steps:
  - `'entering'`: shows Portuguese heading ("Crie seu PIN"), Portuguese subtext ("4 a 6 dígitos. Usado para desbloquear o app."), `<PinPad value={pin} onChange={setPin} maxLength={6} />`, and an "Avançar" button disabled until `pin.length >= 4`.
  - `'confirming'`: shows Portuguese heading ("Confirme seu PIN"), same `<PinPad />` with `maxLength` pinned to `pin.length` from the entering step, and a "Confirmar" button disabled until `confirmInput.length === pin.length`.
  - On "Confirmar" press: if `confirmInput !== pin`, `setErrorText(<PIN_MISMATCH Portuguese copy>); setSubStep('entering'); setPin(''); setConfirmInput('')`. Else `await lockService.setupPin(pin); setPin(''); setConfirmInput('')` — LockGate observes `Unlocked` and swaps to children on next render.
  - `secureTextEntry={true}`, `keyboardType="number-pad"`, `textContentType="oneTimeCode"` on the (invisible) TextInput backing the PinPad (on iOS this suppresses password-manager offers).
  - Responsive: on `width >= 768`, centers the card with `maxWidth: 440`; on phone, full-width with horizontal padding. Uses shadcn tokens.
  Depends T011, T023.
- [x] T025 [US1] Create `src/features/lock/screens/LockScreen.tsx` per [contracts/screens.md §LockScreen](./contracts/screens.md#lockscreen):
  - On mount: `useEffect(() => { biometricAdapter.isAvailable().then(available => { if (!available) { setShowPinPad(true); return; } lockService.unlockWithBiometric().then(result => { if (result !== 'success') setShowPinPad(true); }); }); }, [])`. (On `'success'`, `lockStore` already transitioned to `Unlocked` and LockGate unmounts this screen — no further action needed.)
  - When `showPinPad === true`: render the PIN pad + a Portuguese error text slot + a disabled `"Esqueci meu PIN"` ghost button (enabled by T037 in US3). Tapping the button is a no-op in US1 — document with an inline comment `// TODO(US3): enable in T037`.
  - Submit handler: `async () => { if (pin.length < 4) return; try { const ok = await lockService.verifyPin(pin); setPin(''); if (!ok) setErrorText(<PIN_INCORRECT Portuguese>); } catch (err) { if (err instanceof LockError && err.code === 'TOO_MANY_ATTEMPTS') { /* US3: open recovery. US1: setErrorText(<TOO_MANY_ATTEMPTS Portuguese>) */ } else { setErrorText(<GENERIC Portuguese>); } } }`.
  - Progressive delay: `const failedAttempts = useLockFailedAttempts()`; `const delayMs = getProgressiveDelayMs(failedAttempts)`; when `delayMs > 0 && delayMs < Infinity`, disable the PIN pad, show a countdown that ticks down every 500 ms via `setInterval`, re-enable at 0. When `delayMs === Infinity`, the pad stays disabled and the "Esqueci meu PIN" button becomes the forced path (US3 wires the actual navigation).
  - Visual: the LockScreen is a full-screen container with **no business data visible** (FR-020). The background is `colors.background`; the wordmark from 003 is reused on top for brand continuity.
  - Responsive: same card-centered pattern as PinSetupScreen.
  Depends T011, T012, T023.
- [x] T026 [US1] Create `src/features/lock/components/LockGate.tsx` per [contracts/screens.md §LockGate](./contracts/screens.md#lockgate--the-render-gate). Implementation uses **layered rendering** so HomeStack stays mounted across Lock↔Unlocked transitions (FR-012):
  ```tsx
  export function LockGate({ children }: { children: React.ReactNode }) {
    const { status } = useLock();
    return (
      <>
        <View style={{ flex: 1, display: status === 'Unlocked' ? 'flex' : 'none' }}>
          {children}
        </View>
        {status === 'NotSet' && <PinSetupScreen style={StyleSheet.absoluteFill} />}
        {status === 'Locked' && <LockScreen      style={StyleSheet.absoluteFill} />}
      </>
    );
  }
  ```
  `PinSetupScreen` and `LockScreen` accept a `style` prop forwarded to their root container. Depends T024, T025.
- [x] T027 [US1] Edit `src/features/lock/index.ts` barrel to add: `export { LockGate } from './components/LockGate';`, `export { PinSetupScreen } from './screens/PinSetupScreen';`, `export { LockScreen } from './screens/LockScreen';`. Depends T024, T025, T026.
- [x] T028 [US1] Edit `src/app/navigation/RootNavigator.tsx` — wrap the Home `<Stack.Screen>` with a children render prop that mounts `<LockGate>` around `<HomeStack />`. Exact delta per [contracts/screens.md §RootNavigator changes](./contracts/screens.md#rootnavigator-changes-modified-from-003):
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
  Leave the Relogin modal registration untouched (it stays at the root level, unchanged from 003). Depends T027.

**Checkpoint**: MVP slice ready.
- Fresh install → login (003) → PinSetupScreen appears → two-step entry → Home.
- Kill app → cold-launch with biometric enrollment → biometric prompt → success → Home (SC-002).
- Kill app → cold-launch on device without biometrics → PIN pad directly (SC-006).
- Wrong PIN attempts 1–3 → instant retry; 4–9 → progressive delay visible; 10 → pad disabled (recovery routing arrives with US3).
- Unlock completes with zero network calls (SC-004 precondition — inactivity is US2).

---

## Phase 4: User Story 2 — Auto-Lock on Inactivity (Priority: P2)

**Goal**: An unlocked app that spends longer than the configured timeout in the background triggers the lock screen on foreground return. The salesperson can change the timeout within `[1, 30]` minutes via an in-app control.

**Independent Test**:
- Set timeout to 1 minute. Leave Home → background for 90 s → foreground → LockScreen appears.
- Set timeout back to 5 min default. Background for 30 s → foreground → Home, no lock.
- Active foreground interaction does not lock the app regardless of elapsed foreground time (by design — inactivity tracks background only).
- After an inactivity lock, unlock → salesperson lands on the same screen with the same in-memory state they left (FR-012, SC-005).

### Implementation for User Story 2

- [x] T029 [US2] Complete `src/features/lock/state/inactivity.ts` handler — replace the Phase 2 skeleton's "do nothing on foreground" branch with the full transition logic per [contracts/state-machine.md §Inactivity tracker contract](./contracts/state-machine.md#inactivity-tracker-contract):
  ```ts
  // background|inactive → active
  const startedAt = _internalLockStore.getBackgroundedAt();
  _internalLockStore.setBackgroundedAt(null);
  if (startedAt === null) return;
  const expired = isInactivityExpired({
    backgroundedAtMs: startedAt,
    nowMs: Date.now(),
    timeoutMinutes: _internalLockStore.getInactivityTimeoutMinutes(),
  });
  if (expired && lockStore.getSnapshot().status === 'Unlocked') {
    _internalLockStore.setStatus('Locked');
  }
  ```
  The `NotSet` and `Locked` short-circuits in the condition are required because transitioning `NotSet → Locked` or `Locked → Locked` is illegal / noop per the state machine table. Depends T010, T014 (skeleton).
- [x] T030 [US2] Implement `lockService.setInactivityTimeout(minutes: number): Promise<void>` in `src/features/lock/service/lockService.ts`:
  1. `const clamped = Math.max(1, Math.min(30, Math.round(minutes)))`.
  2. `await lockStorage.setInactivityPreference({ minutes: clamped, version: 1 })`.
  3. `_internalLockStore.setInactivityTimeoutMinutes(clamped)`.
  No emission from `setInactivityTimeoutMinutes`; the next background-foreground cycle uses the new value.
  `getInactivityTimeout()` was already implemented in T016 — leave it. Depends T005, T010, T016.
- [x] T031 [US2] Edit `src/features/home/screens/HomePlaceholderScreen.tsx` — add a transitional minute-selector row above the existing "Sair" button (added by 003 T039). Options: `[1, 5, 10, 30]` minutes. Use a simple row of `<Button variant={isSelected ? 'primary' : 'outline'} size="md">`. On press, `await lockService.setInactivityTimeout(selectedMinutes)`. Pre-select based on `lockService.getInactivityTimeout()`. Portuguese label: "Bloquear após". Spec-mandated persistence across cold launches is delivered by T030's storage write. This is **transitional** — the real settings UI lands with the future settings feature. Depends T023, T030.

**Checkpoint**: US2 complete. Background → timeout exceeded → foreground → LockScreen (from US1). Mid-form state preserved by LockGate's layered render. Timeout preference persists across cold launches (SC-011).

---

## Phase 5: User Story 3 — Forgot PIN Recovery via Online Re-Login (Priority: P3)

**Goal**: Salesperson on the LockScreen taps "Esqueci meu PIN". Interstitial confirms the flow (requires internet; data stays). On confirm, the app wipes the old PIN, wipes the refresh token WHILE preserving the last-email, routes to the 003 LoginScreen (pre-filled), login succeeds, LockGate detects `status === 'NotSet'` and shows PinSetupScreen, new PIN is set, Home opens. Every local business record survives intact.

**Independent Test**:
- Online: tap "Esqueci meu PIN" → interstitial → Continuar → LoginScreen with email pre-filled → login → PIN setup → new PIN → Home. Count clients/orders/receipts before and after; both must match (SC-010).
- Offline: tap "Esqueci meu PIN" → interstitial shows "Conecte-se à internet" → Continuar disabled → Cancel → LockScreen still usable with the ORIGINAL PIN (FR-014 — no state altered offline).

### Implementation for User Story 3

- [x] T032 [US3] Extend 003's `src/features/auth/service/authService.ts` `logout()` method with the new `{ preserveEmail?: boolean }` option per [plan.md Project Structure](./plan.md#project-structure) + [research.md R5](./research.md#r5--lock-to-auth-integration-points):
  1. Change the signature to `logout(options?: { preserveEmail?: boolean }): Promise<void>`. Default `preserveEmail === false` preserves existing behavior.
  2. In the body, replace `await Promise.all([secureStore.deleteRefreshCredential(), secureStore.deleteLastEmail()])` with:
     ```ts
     const ops: Promise<void>[] = [secureStore.deleteRefreshCredential()];
     if (!options?.preserveEmail) ops.push(secureStore.deleteLastEmail());
     await Promise.all(ops);
     ```
  3. Add one more line AFTER the secure-store auth-wipe and BEFORE the `setNotAuthenticated` call: `await deletePinCredential();` — imported as `import { deletePinCredential } from '@/features/lock/storage/lockStorage';` at the top of the file. This satisfies 004 FR-018 (PIN wiped atomically with session). The `deletePinCredential()` export is idempotent (no-op if no PIN), so this is safe even when the user never set a PIN.
  4. Leave step 2 and 3 of the original logout flow (setNotAuthenticated, best-effort `supabase.auth.signOut()`) unchanged.
  This is the ONE legal cross-feature import from `@/features/auth` into `@/features/lock/storage`. The review rule: no other `preserveEmail: true` call site may be introduced outside T036.
  Depends T005. FR-018.
- [x] T033 [US3] Create `src/features/lock/screens/PinRecoveryConfirmScreen.tsx` per [contracts/screens.md §PinRecoveryConfirmScreen](./contracts/screens.md#pinrecoveryconfirmscreen):
  - Portuguese reassurance heading + body: "Para redefinir seu PIN, você precisará entrar de novo com e-mail e senha. Seus dados continuam no aparelho."
  - Buttons: `<Button variant="primary" disabled={offline || isSubmitting}>Continuar</Button>` / `<Button variant="ghost">Cancelar</Button>`.
  - On mount: `const netState = await NetInfo.fetch(); setOffline(!(netState.isConnected && netState.isInternetReachable))`. Also subscribe: `const unsub = NetInfo.addEventListener(state => setOffline(!(state.isConnected && state.isInternetReachable))); return unsub;`.
  - When `offline === true`, render an additional Portuguese hint: "Conecte-se à internet para continuar".
  - Continuar handler: `setIsSubmitting(true); try { await lockService.beginPinRecovery(); } catch (err) { if (err instanceof LockError && err.code === 'RECOVERY_OFFLINE') { setOffline(true); } else { setErrorText(<GENERIC Portuguese>); } } finally { setIsSubmitting(false); }`. Navigation away is implicit — session flips, LockGate unmounts.
  - Cancel handler: just call the parent's `onCancel` prop passed from LockScreen. (LockScreen owns the conditional render and can dismiss the screen.)
  - Props: `{ onCancel: () => void }`.
  Depends T033-adjacent contracts only. Does NOT yet depend on T036 — the screen can be created without the service method existing; the try/catch handles undefined behavior gracefully by hitting the generic branch.
- [x] T034 [US3] Edit `src/features/lock/index.ts` barrel — add `export { PinRecoveryConfirmScreen } from './screens/PinRecoveryConfirmScreen';`. Depends T033.
- [x] T035 [US3] Implement `lockService.beginPinRecovery()` in `src/features/lock/service/lockService.ts` per [contracts/lock-service.md §lockService.beginPinRecovery](./contracts/lock-service.md#lockservice-shape) and [research.md R8](./research.md#r8--pin-recovery-flow):
  1. `const netState = await NetInfo.fetch()`. If `!netState.isConnected || !netState.isInternetReachable`: `throw new LockError('RECOVERY_OFFLINE')`.
  2. `await lockStorage.setPinCredentialDeleteHelper()` — actually, just call `await import('../storage/lockStorage').then(m => m.deletePinCredential())` to invoke the standalone export. (Or simpler: import `deletePinCredential` at the top of `lockService.ts` and call it directly.) This wipes the PIN.
  3. `await authService.logout({ preserveEmail: true })` — imported from `@/features/auth`. This wipes the refresh token, preserves the email, wipes the PIN again (idempotent — the prior step already did so). Session transitions to `NotAuthenticated`, RootNavigator unmounts Home branch on next render.
  4. Method returns. The eventual LoginScreen → PIN setup flow is navigation-driven; this service method does not await it.
  Note the **ordering**: PIN wipe BEFORE session wipe. If session wipe fails mid-way, the PIN is still gone (safer — the salesperson is forced through LoginScreen → PinSetupScreen on next cold launch). Research R8 documents this trade-off.
  Depends T005, T008, T016, T032. FR-014, FR-015.
- [x] T036 [US3] Edit `src/features/lock/screens/LockScreen.tsx` to enable the "Esqueci meu PIN" affordance:
  - Remove the `// TODO(US3)` comment from T025.
  - Add local state `const [showRecoveryConfirm, setShowRecoveryConfirm] = useState(false)`.
  - On "Esqueci meu PIN" button press: `setShowRecoveryConfirm(true)`.
  - Render PinRecoveryConfirmScreen conditionally on top of the PIN pad (using `StyleSheet.absoluteFill` to overlay): `{showRecoveryConfirm && <PinRecoveryConfirmScreen onCancel={() => setShowRecoveryConfirm(false)} style={StyleSheet.absoluteFill} />}`.
  - Also auto-open the recovery screen when `verifyPin` throws `TOO_MANY_ATTEMPTS`: replace the US1 placeholder in the catch branch with `setShowRecoveryConfirm(true); setErrorText(<TOO_MANY_ATTEMPTS Portuguese: "Muitas tentativas. Redefinir PIN pelo login.">)`.
  Depends T025, T034, T035.

**Checkpoint**: US3 complete. "Esqueci meu PIN" → online → recovery flow completes end-to-end (SC-009). 10 consecutive wrong PINs auto-routes to recovery (FR-016). Offline recovery blocks with a clear message and leaves existing PIN intact (FR-014). Local business data survives recovery (SC-010). Re-login after a logout triggers the first-run PIN setup (FR-018 + FR-019) — this path is implicitly covered by T032 (logout wipes PIN) and T028 (RootNavigator gate routes to PinSetupScreen when status === 'NotSet').

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T037 [P] Run `pnpm lint`, `pnpm typecheck`, `pnpm test` at repo root — all three must be green before merging. The four new test files (T019–T022) must all pass. No regressions on 003's existing tests.
- [ ] T038 [P] Walk through every acceptance scenario in [spec.md §User Scenarios](./spec.md#user-scenarios--testing-mandatory) on a real dev-client build (iOS + Android). Record each pass/fail in the PR description. Coverage: US1 scenarios 1–7, US2 scenarios 1–6, US3 scenarios 1–6, plus the 13 Edge Cases. Specifically exercise: fresh install, cold launch with and without biometric enrollment, biometric cancel vs failure, wrong PIN with the progressive curve, inactivity at 1 / 5 / 10 / 30 min, offline "Esqueci meu PIN", online recovery → data audit, 10-attempt forced recovery, logout → re-login → PIN setup re-triggered. **Also verify FR-022 / SC-012**: on both iOS and Android, foreground the app on 10 representative screens (catalog list, catalog detail, client detail, new-order draft, order detail, receipts list, receipt detail, home, settings, PinSetup mid-flow), press home to background, then open the OS task-switcher — the thumbnail MUST show the privacy mask, not business content, on every screen. Record the check for each screen in the PR description.
- [ ] T039 Run a filesystem + Keychain audit after a successful PIN setup: on iOS sim, verify `~/Library/Developer/CoreSimulator/.../Library/Keychains/` contains only a PBKDF2 hash entry for `lock.pinCredential` (extract via `security find-generic-password` and confirm the value is a JSON blob with 32-hex `saltHex` + 64-hex `hashHex`, NO plaintext PIN). On Android, via `adb shell run-as com.<pkg>` inspect `shared_prefs/` and verify no plaintext PIN appears. Acceptance of SC-007. Record the audit commands and (redacted) outputs in the PR description.
- [ ] T040 Verify phone AND tablet rendering per constitution UX5 and plan.md Complexity Tracking entry 2. For each of PinSetupScreen, LockScreen, PinRecoveryConfirmScreen: boot the iOS simulator at iPhone (390×844) and at iPad (820×1180); walk through each screen's states (entering, confirming, biometric fallback, PIN error, offline-recovery warning, countdown during progressive delay). Document pass/fail in the PR description. If a Pencil design pass was run during implementation (optional per research R11), also attach the exported frames under `specs/004-local-lock/design/`.
- [x] T041 [P] Grep `src/features/lock/` for `console.log` / `console.warn` / `console.error` / `console.info` / `console.debug`. For each hit, confirm the logged line does NOT include any substring of `pin`, `saltHex`, `hashHex`, or any plaintext credential. Redact or remove any violator. This is the FR-004 compliance gate at log level — the `LockError.message` is already taxonomic (T009), but ad-hoc `console.*` would be an implicit leak risk.
- [ ] T042 Run the quickstart.md "Testing sanity checklist" section end-to-end on a real dev-client build — all 13 checkboxes must tick. Any failure blocks merge. Reference: [quickstart.md §Testing sanity checklist](./quickstart.md#testing-sanity-checklist).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: starts immediately.
- **Foundational (Phase 2)**: depends on Setup — blocks all user stories.
- **US1 / US2 / US3 (Phases 3–5)**: all depend on Foundational. US2 depends on US1 (its control lives on the placeholder home screen that US1 makes routable — actually, technically the home placeholder exists from 001; US2 just adds a control to it, so US2 can run in parallel with US1 on the code level, but the *validation* of US2 requires US1 to be visible). US3 depends structurally on US1 (the "Esqueci meu PIN" affordance is wired by US3 onto the LockScreen that US1 creates) and on the existence of the 003 auth `logout` extension (T032).
- **Polish (Phase 6)**: depends on whichever user stories are being shipped in this batch.

### User Story Dependencies

- **US1 (P1)**: requires Foundational only. Ships as MVP.
- **US2 (P2)**: depends on Foundational (for `lockStorage`, `lockStore`) + US1 (for the home screen to host the transitional settings control). Can begin in parallel with US1 implementation on the code level for T029 and T030; T031 requires the home layout US1 touches.
- **US3 (P3)**: depends on Foundational + US1 (LockScreen's "Esqueci meu PIN" affordance is extended by T036). T032 touches 003's code and is independent of US1 (can start as soon as Phase 2 finishes).

### Within Each User Story

- **US1**: T023 (service methods) → T024 (PinSetupScreen) + T025 (LockScreen) → T026 (LockGate) → T027 (barrel) → T028 (RootNavigator).
- **US2**: T029 + T030 in parallel; T031 after T030.
- **US3**: T032 + T033 in parallel; T035 after T032 and T034; T036 after T035.

### Parallel Opportunities

- Phase 1: T002, T003 are [P].
- Phase 2: T005–T012 are [P] across different files. T013 (bootstrap) depends on T005 + T010; T014 (inactivity skeleton) depends on T010. T015–T017 have dependencies and are sequential within their subgraph. T018 is a single-file edit after T015. T019–T022 are all [P] tests.
- US1: T024 + T025 are [P] (different files, both depend on T023).
- US2: T029 + T030 are [P].
- US3: T032 + T033 are [P].

---

## Parallel Example — Phase 2 Foundational

```bash
# Start a burst of foundational work once T004 (prebuild) completes:
Task: "Create src/features/lock/storage/lockStorage.ts"                         # T005
Task: "Create src/features/lock/crypto/random.ts"                               # T006
Task: "Create src/features/lock/crypto/pinHash.ts (depends T006)"               # T007
Task: "Create src/features/lock/biometric/biometricAdapter.ts"                  # T008
Task: "Create src/features/lock/service/errors.ts"                              # T009
Task: "Create src/features/lock/state/lockStore.ts"                             # T010
Task: "Create src/features/lock/components/PinPad.tsx"                          # T011
Task: "Create src/features/lock/hooks/useLock.ts + useLockFailedAttempts.ts"    # T012
Task: "Unit test: pinHash.test.ts"                                              # T019
Task: "Unit test: lockStore.test.ts"                                            # T020
Task: "Unit test: inactivity.test.ts"                                           # T021
Task: "Unit test: lockStorage.test.ts"                                          # T022
```

T013 (bootstrap), T014 (inactivity skeleton), T015 (Provider), T016 (service skeleton), T017 (barrel), T018 (AppProviders edit) follow once their deps settle.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) — infrastructure + four unit tests.
3. Complete Phase 3 (US1) — T023 → (T024 ‖ T025) → T026 → T027 → T028.
4. **STOP and VALIDATE**: run US1 acceptance scenarios on both a biometric-enrolled device and a biometric-less device (or a device with biometrics disabled). Cold-start lock works; PIN setup forced on first login after 003's login. At this point, constitution §7 D6's cold-start requirement is satisfied; the inactivity requirement is not (it needs US2 to ship together for the full constitutional D6). MVP ship decision: do NOT ship US1 alone to salespeople, per §7 D6's "and" clause. Ship after US1 + US2.

### Incremental Delivery

1. Setup + Foundational → infrastructure ready.
2. US1 + US2 → ship as the MVP constitutional D6 slice.
3. US3 → ship next. Enables "Esqueci meu PIN" support, which is expected before external handoff beyond the pilot.
4. Each story adds value without breaking previous stories. US2 can be validated independently of US3 as long as US1 shipped.

### Parallel Team Strategy

Single-developer project per the constitution §3 — parallelism is across **files**, not **developers**. The [P] marks throughout Phase 2 are the opportunity to commit broadly-scoped infrastructure in a single sitting before moving to story work. Within US2 and US3, the [P] marks let T029‖T030 and T032‖T033 proceed before their merge points.

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks.
- `[Story]` label maps the task to US1 / US2 / US3 for traceability.
- No UI tests, no integration tests, no E2E harness — constitution §9 + [research.md R10](./research.md#r10--test-surface).
- Verify unit tests fail before implementing the state machine / crypto / inactivity helpers (TDD discipline for T019/T007, T020/T010, T021/T014, T022/T005 pairs).
- Commit after each task or tight logical group. Prefer small, reviewable commits.
- Stop at each checkpoint to validate.
- Avoid: storing the plaintext PIN anywhere, calling `deletePinCredential` directly from any module other than `authService.logout` (T032) and `lockService.beginPinRecovery` (T035), leaking business data on the lock screen (FR-020), passing `preserveEmail: true` to `authService.logout` from anywhere other than T035, importing `expo-local-authentication` or `expo-secure-store` from outside the respective adapter/wrapper modules.
