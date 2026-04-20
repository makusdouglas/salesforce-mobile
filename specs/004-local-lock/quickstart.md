# Quickstart — Mandatory Local Lock

**Feature**: 004-local-lock
**Purpose**: Show, in under 10 minutes, how a new feature or a developer onboarding to the codebase sees and uses the local lock. Not a design doc — [plan.md](./plan.md), [research.md](./research.md), and [contracts/*](./contracts/) cover that.

---

## TL;DR for a feature author

If your feature lives under `src/features/<your-feature>/` and renders screens inside `HomeStack`, **you don't need to do anything**. The lock runs silently: `<LockGate>` wraps the entire Home branch in `RootNavigator`, so your screen only mounts when the salesperson has unlocked the app. You can assume:

- `useSession().status === 'Authenticated'` OR `'RequiresRelogin'` (per 003).
- `useLock().status === 'Unlocked'` (because your screen is rendering).
- No token-validation call is needed on any business action (003 FR-005 still holds).
- The salesperson's in-memory state, scroll positions, and unsaved form fields are preserved across inactivity lock cycles (FR-012). You do not need to "restore" anything — the gate keeps HomeStack mounted and layers the LockScreen on top.

That's it for 99% of feature work.

---

## What to import

### From `@/features/lock`

```ts
import {
  useLock,          // rarely needed in feature code
  LockProvider,     // used only in src/app/providers/AppProviders.tsx
  LockGate,         // used only in src/app/navigation/RootNavigator.tsx
  lockService,      // used only in SettingsScreen (future) for setInactivityTimeout
  type LockStatus,
} from '@/features/lock';
```

### From `@/features/auth` (unchanged — for reference)

```ts
import {
  authService,
  useSession,
  requireSession,
  SessionProvider,
  AuthError,
  LoginScreen,
  ReloginScreen,
} from '@/features/auth';
```

**The lock feature imports `authService.logout` (with the new `{ preserveEmail: true }` option) from `@/features/auth`** — this is the only cross-feature import from lock into auth. In the other direction, `authService.logout()` imports `deletePinCredential` from `@/features/lock/storage/lockStorage` (the ONE legal non-barrel import from auth into lock).

---

## The app-provider wiring

`src/app/providers/AppProviders.tsx`:

```tsx
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LockProvider>
        <NavigationContainer ref={rootNavigationRef}>
          {children}
        </NavigationContainer>
      </LockProvider>
    </SessionProvider>
  );
}
```

Why in this order: `LockProvider` doesn't read from `SessionProvider` in the MVP, but the lock feature's PIN-recovery path depends on the session layer being initialized before any lock action runs. Putting `SessionProvider` outermost means its bootstrap has completed before the lock gate first renders.

---

## The root navigator wiring

`src/app/navigation/RootNavigator.tsx` (delta from 003):

```tsx
function RootNavigator() {
  const { status: sessionStatus } = useSession();
  const authenticated = sessionStatus !== 'NotAuthenticated';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
      <Stack.Screen
        name="Relogin"
        component={ReloginScreen}
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
```

The only change from 003: the Home route uses a children render prop so it can wrap `HomeStack` in `<LockGate>`. Everything else stays as-is.

---

## Salesperson journey — the golden path

### First run on a fresh install

1. App launches. `SessionProvider.authBootstrap()` reads no refresh token. `session.status = 'NotAuthenticated'`.
2. `LockProvider.lockBootstrap()` reads no PIN credential. `lock.status = 'NotSet'` (but LockGate isn't mounted yet — the Home branch isn't in the tree because session is NotAuthenticated).
3. `RootNavigator` renders `AuthStack` → `LoginScreen` appears.
4. Salesperson types email + password, submits. `authService.login()` writes `auth.refreshCredential` + `auth.lastEmail`, transitions session to `Authenticated`.
5. `RootNavigator` re-renders, now on the Home branch. `LockGate` mounts, reads `lock.status === 'NotSet'`, renders `PinSetupScreen`.
6. Salesperson types a 4–6 digit PIN, confirms it on the second step. `lockService.setupPin(pin)` writes `lock.pinCredential`, transitions `lock.status` to `Unlocked`.
7. `LockGate` re-renders, layers HomeStack on top (the previously-prepared children). Salesperson lands on Home.

**Time budget**: SC-001 says PIN setup itself is under 30 seconds; SC-002 says cold launch with biometrics is under 3 s and we're adding a first-run setup only, not affecting subsequent cold launches.

### Daily use — cold launch with an existing session and PIN

1. App launches. `SessionProvider.authBootstrap()` reads a valid refresh token within the 90-day window. `session.status = 'Authenticated'` (optimistic).
2. `LockProvider.lockBootstrap()` reads the PIN credential. `lock.status = 'Locked'`.
3. `RootNavigator` renders the Home branch; `LockGate` mounts, layers `LockScreen` over `HomeStack`.
4. `LockScreen` mounts, calls `biometricAdapter.isAvailable()`. If `true`, calls `biometricAdapter.authenticate()`.
5. On `'success'`, `lockService.unlockWithBiometric()` transitions `lock.status` to `Unlocked`. The `LockScreen` unmounts (the gate stops layering it) and the salesperson sees Home.
6. If `'failed' | 'cancelled' | 'unavailable'`, the `LockScreen` falls through to the PIN pad. Salesperson types the PIN; on correct entry, same transition.
7. Meanwhile, because `session.status` was already `Authenticated` at boot, 003's connectivity listener is running and will silently refresh the access token whenever the device comes online. None of that is visible.

### Mid-session inactivity

1. Salesperson working in the app (unlocked). Phone goes idle or backgrounded.
2. `AppState` transitions `active → background`. `inactivity.ts` records `backgroundedAtMs = Date.now()`.
3. Time passes.
4. Salesperson foregrounds the app. `AppState` transitions `background → active`. Handler reads `backgroundedAtMs`, computes `elapsed`. If `elapsed > timeoutMs` (default 5 min), transitions `lock.status` to `Locked`.
5. `LockGate` re-layers `LockScreen` over the still-mounted `HomeStack`. Biometric or PIN flow as in step 4 above.
6. On unlock, `LockScreen` unmounts; `HomeStack` is already rendered with the exact state the salesperson left it in (same scroll, same form state). FR-012 satisfied.

### Forgot PIN — recovery

1. Salesperson at `LockScreen`, has forgotten the PIN (or exhausted 10 attempts).
2. Taps "Esqueci meu PIN" → `LockScreen` conditionally renders `PinRecoveryConfirmScreen` on top.
3. `PinRecoveryConfirmScreen` checks `NetInfo`. If offline, "Continuar" is disabled with a "Conecte-se..." message.
4. Salesperson on Wi-Fi. Taps "Continuar". `lockService.beginPinRecovery()`:
   - Re-checks connectivity (defense in depth).
   - `lockStorage.deletePinCredential()` wipes the PIN.
   - `authService.logout({ preserveEmail: true })` wipes the refresh token, preserves `auth.lastEmail`.
   - Session transitions to `NotAuthenticated`.
5. `RootNavigator` unmounts the Home branch (and thus LockGate, LockScreen, PinRecoveryConfirmScreen). Mounts `AuthStack` → `LoginScreen` with email pre-filled from `auth.lastEmail`.
6. Salesperson types password → `authService.login()` → session `Authenticated`.
7. `RootNavigator` swaps to Home → `LockGate` mounts → reads `lock.status === 'NotSet'` (because step 4 wiped the PIN) → `PinSetupScreen` appears.
8. Salesperson sets a new PIN → unlock → Home.

Throughout: **zero WatermelonDB mutations**. Every client, order, receipt, and cached catalog image that was on the device before step 1 is present in step 8.

---

## How to change the inactivity timeout (transitional)

The MVP ships a minimal control on the HomePlaceholderScreen (or a small SettingsScreen if one lands in the same cycle). The code:

```tsx
const currentMinutes = lockService.getInactivityTimeout();

<SegmentedControl
  values={['1 min', '5 min', '10 min', '30 min']}
  selectedIndex={minutesToIndex(currentMinutes)}
  onChange={async (event) => {
    const minutes = indexToMinutes(event.nativeEvent.selectedSegmentIndex);
    await lockService.setInactivityTimeout(minutes);
  }}
/>
```

`lockService.setInactivityTimeout()` clamps to `[1, 30]` and updates both the secure-store entry and the in-memory value used by the AppState handler. No restart is needed.

**This is transitional.** The real settings UI lands with a future settings feature; the placeholder control exists so that the spec's FR-010 is testable end-to-end in this cycle.

---

## Testing sanity checklist

After plumbing the feature in, verify manually against the acceptance scenarios:

- [ ] Fresh install → login → PIN setup appears → two-step entry works → Home opens. (US1 scenarios 1–2)
- [ ] Kill app → cold launch → biometric prompt (if enrolled) → success → Home. (US1 scenario 3)
- [ ] Disable biometrics on device (or test on a device without them) → cold launch → PIN pad directly (no flash). (US1 scenario 4, SC-006)
- [ ] Biometric prompt → cancel → PIN pad appears. (US1 scenario 5)
- [ ] Wrong PIN → "PIN incorreto" → retry. (US1 scenario 6)
- [ ] LockScreen shows no business content. (US1 scenario 7, FR-020)
- [ ] Set inactivity to 1 minute via settings → background → wait 90 seconds → foreground → LockScreen. (US2 scenario 1)
- [ ] Background → foreground within 30 seconds → no LockScreen. (US2 scenario 2)
- [ ] Mid-form inactivity lock → unlock → form state preserved. (US2 scenario 5, FR-012)
- [ ] LockScreen → Esqueci meu PIN → offline → "Conecte-se..." (US3 scenario 2)
- [ ] LockScreen → Esqueci meu PIN → online → LoginScreen (email pre-filled) → login → PIN setup → Home. Local records intact. (US3 scenarios 3–5, SC-010)
- [ ] Logout from Home → LoginScreen → re-login → PIN setup screen appears. (FR-018 + FR-019)
- [ ] 10 consecutive wrong PINs → auto-routes to PinRecoveryConfirmScreen. (FR-016)

---

## What the lock feature does NOT do

- Does not issue any network requests on the happy unlock path (SC-004).
- Does not import `@/features/home/*` or `@/data/repositories/*`.
- Does not store the plaintext PIN (SC-007).
- Does not survive uninstall (OS wipes secure store; fresh install retriggers first-run setup).
- Does not override the OS biometric prompt or device PIN — those remain the device-owner's.
- Does not offer a "change PIN" path without going through recovery. MVP scope limit (FR-021).

## Bonus: OS task-switcher masking (FR-022)

A small infrastructural piece that ships with this feature but is orthogonal to the lock state machine: `react-native-privacy-snapshot` wraps the root app tree in `AppProviders.tsx`. When the app goes to background, the library overlays a mask that the OS captures for the multitasking preview — so the task-switcher thumbnail shows the mask, not business data. Zero state to manage; the library self-installs via `expo prebuild`. See [research R12](./research.md#r12--os-task-switcher-snapshot-masking).

---

## Further reading

- [plan.md](./plan.md) — the what and why, Constitution Check, project structure.
- [research.md](./research.md) — the detailed rationale for every non-obvious decision (crypto, biometrics, state machine, recovery flow, progressive delay curve).
- [data-model.md](./data-model.md) — the authoritative data shapes and lifecycles.
- [contracts/lock-service.md](./contracts/lock-service.md) — the full API surface.
- [contracts/lock-storage.md](./contracts/lock-storage.md) — the secure-store wrapper.
- [contracts/biometric-adapter.md](./contracts/biometric-adapter.md) — the OS API wrapper.
- [contracts/state-machine.md](./contracts/state-machine.md) — the transitions and internal flags.
- [contracts/screens.md](./contracts/screens.md) — UI contracts and navigation topology.
- [spec.md](./spec.md) — user scenarios, FRs, SCs, assumptions.
