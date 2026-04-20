# Contract — Lock screens and navigation

**Feature**: 004-local-lock
**Status**: Authoritative — every screen or navigator that interacts with the lock flow conforms to this contract.
**Implementation paths**: `src/features/lock/screens/PinSetupScreen.tsx`, `src/features/lock/screens/LockScreen.tsx`, `src/features/lock/screens/PinRecoveryConfirmScreen.tsx`, `src/features/lock/components/LockGate.tsx`, `src/app/navigation/RootNavigator.tsx`.

---

## Navigation topology

The three lock screens are NOT registered as React Navigation routes at the root stack. They are rendered imperatively by `LockGate` based on `lockStore.status` — the gate lives inside the `Home` branch of `RootNavigator` and swaps its render based on state.

```text
<NavigationContainer ref={rootNavigationRef}>
  <RootStackNavigator>
    ├── Auth   (mounted when session.status === 'NotAuthenticated')
    │   └── Login                              (003)
    ├── Home   (mounted when session.status ∈ { 'Authenticated', 'RequiresRelogin' })
    │   └── <LockGate>                         (004)
    │         ├── <PinSetupScreen />            (when lock.status === 'NotSet')
    │         ├── <LockScreen />                (when lock.status === 'Locked')
    │         └── <HomeStack />                  (when lock.status === 'Unlocked')
    └── Relogin (modal, 003 — unchanged)
  </RootStackNavigator>
</NavigationContainer>
```

`PinRecoveryConfirmScreen` is an intra-LockScreen modal/overlay rendered imperatively by `LockScreen` when the salesperson taps "Esqueci meu PIN". It is not a React Navigation route — it is a simple React conditional render inside `LockScreen`'s own tree. This keeps all lock surfaces under the gate and out of the root stack, avoiding topology drift while the salesperson is locked.

**Rationale for not registering lock screens as routes**: the gate is a render-time concept, not a navigation concept. Registering them as routes would require keeping the navigator and the `lockStore` in lockstep, with the usual race-condition pitfalls; simpler to let the gate own the render and let React reconcile.

---

## `PinSetupScreen`

**Route**: none (rendered by `<LockGate />` when `lock.status === 'NotSet'`).
**Presentation**: full screen.

### Required behavior

| Requirement | Trace | Notes |
|-------------|-------|-------|
| Two-step entry: type PIN, then confirm PIN on a second screen/page | FR-001, FR-003 | Two local sub-states: `'entering'` and `'confirming'`. The `'entering'` sub-state accepts 4–6 digits; "Avançar" is enabled when length is within range. The `'confirming'` sub-state is the same PIN pad with the expected length pinned to the entered PIN's length. |
| Reject confirm-step mismatches | FR-003, acceptance scenario 2 of US1 | Mismatch shows "Os PINs não coincidem. Tente novamente." and returns the flow to the `'entering'` sub-state with a cleared PIN. No partial credential is written. |
| Persist via lockService.setupPin on confirm-step match | FR-004 | On success, navigates away implicitly (LockGate observes `status === 'Unlocked'` and renders HomeStack). |
| Clear plaintext PIN from local state on transition | FR-004 | `setPin('')` is called before LockGate re-renders. |
| No business data visible | FR-020 | No `HomeStack` component is imported or referenced. The screen renders a minimal branded container. |
| Portuguese copy per constitution §9 | §9 | Heading: "Crie seu PIN". Subtext: "4 a 6 dígitos. Usado para desbloquear o app." Confirm step heading: "Confirme seu PIN". |
| Phone + tablet viewports | UX5 | Card-centered layout reuses the 003 aesthetic: ~440 pt centered on tablet, full-width card with horizontal padding on phone. |

### Submit flow (confirm step)

```text
confirmSubmit() {
  if (confirmInput !== enteredPin) {
    setErrorCode('PIN_MISMATCH');
    setSubStep('entering');
    setEnteredPin('');
    setConfirmInput('');
    return;
  }
  try {
    await lockService.setupPin(enteredPin);
    setEnteredPin('');
    setConfirmInput('');
    // LockGate observes status → 'Unlocked' and swaps to HomeStack on next frame.
  } catch (err) {
    if (err instanceof LockError) setErrorCode(err.code);
    else setErrorCode('STORAGE_UNAVAILABLE');
  }
}
```

### What PinSetupScreen MUST NOT do

- **Must not** persist the plaintext PIN anywhere, including React DevTools' component tree — PIN input uses `secureTextEntry={true}` and `keyboardType="number-pad"` (`textContentType="oneTimeCode"` on iOS to suppress password-manager offers).
- **Must not** show a "skip" or "set later" affordance. The PIN setup is mandatory (FR-001).
- **Must not** permit non-digit characters. The PIN pad component enforces numeric-only input at the primitive level.
- **Must not** permit fewer than 4 or more than 6 digits. The "Avançar" button is disabled outside that range.
- **Must not** import from 003's auth surface. This screen is self-contained.

---

## `LockScreen`

**Route**: none (rendered by `<LockGate />` when `lock.status === 'Locked'`).
**Presentation**: full screen.

### Required behavior

| Requirement | Trace | Notes |
|-------------|-------|-------|
| Invoke biometric prompt on mount when available AND enrolled | FR-006 | `biometricAdapter.isAvailable()` → if true, call `biometricAdapter.authenticate({ promptMessage, cancelLabel })` inside a `useEffect` that runs once per mount. |
| Fall through to PIN pad on any non-`success` biometric result | FR-007 | `'failed' | 'cancelled' | 'unavailable'` all route to the same "show PIN pad" state. No error text surfaces — the salesperson saw the OS prompt and understands. |
| Direct PIN pad (no biometric prompt flash) when biometric unavailable | FR-007, SC-006 | `isAvailable()` resolving false on mount sets `showPinPad = true` immediately; `authenticate()` is never called. |
| Offer "Esqueci meu PIN" affordance | FR-013 | Button below the PIN pad. Tapping it opens PinRecoveryConfirmScreen as an in-tree overlay (conditional render). |
| Enforce progressive delay | FR-016, research R6 | LockScreen reads `useLockFailedAttempts()` (internal hook) and, when the count is in the delay zone, disables the PIN pad and shows a countdown timer with a "aguarde N segundos" label. |
| Force recovery at attempt 10 | FR-016 | When `failedAttempts === 10`, `verifyPin` throws `TOO_MANY_ATTEMPTS`; LockScreen auto-opens PinRecoveryConfirmScreen with a message "Muitas tentativas. Redefinir PIN pelo login." |
| No business data visible | FR-020 | Same constraint as PinSetupScreen. |
| Preserve prior foreground screen after unlock | FR-012 | LockGate swapping back to `children` (HomeStack) preserves React Navigation state naturally — HomeStack never unmounted. |

### Biometric-then-PIN state machine

```text
         mount
           │
           ▼
   ┌────────────────────┐
   │ biometricAdapter.  │
   │ isAvailable()?     │
   └────┬──────────┬────┘
        │          │
       yes         no
        │          │
        ▼          │
   ┌────────────┐  │
   │ biometric. │  │
   │ authenticate│  │
   └──┬──────┬──┘  │
      │      │     │
   success   non-  │
      │    success │
      ▼      │     ▼
  (lockService.unlockWithBiometric() already transitioned → Unlocked → LockGate unmounts)
             │     │
             └─────┴────► show PIN pad
                          │
                          │ (salesperson types, taps Avançar)
                          ▼
                   lockService.verifyPin(pin)
                   ├─ true  → Unlocked → LockGate unmounts
                   └─ false → increment, apply delay, stay.
```

### Submit flow (PIN pad)

```text
verifyPinSubmit() {
  if (pin.length < 4) return;   // primitive guard
  setIsSubmitting(true);
  try {
    const ok = await lockService.verifyPin(pin);
    setPin('');
    if (!ok) {
      setErrorText('PIN incorreto.');
      // failedAttempts is already incremented by the service; the delay-zone useEffect reads
      // the new value via useLockFailedAttempts() and disables the pad with a countdown.
    }
  } catch (err) {
    if (err instanceof LockError && err.code === 'TOO_MANY_ATTEMPTS') {
      setShowRecoveryConfirm(true);
    } else {
      setErrorText('Erro ao verificar PIN. Tente novamente.');
    }
  } finally {
    setIsSubmitting(false);
  }
}
```

### What LockScreen MUST NOT do

- **Must not** render any business content (catalog, client count, sync status) behind, below, or around the lock. FR-020.
- **Must not** allow switching to a different salesperson. Only logout (from settings after unlocking via recovery or normal means) can change the account.
- **Must not** show the biometric prompt when `isAvailable()` returns false. No "biometrics disabled" dialogue; the PIN pad is the first and only UI on devices without biometrics.
- **Must not** leak `failedAttempts` as a visible number, only as a feature of the countdown UX. Surfacing "5/10 attempts" would help a shoulder-surfer gauge their progress.

---

## `PinRecoveryConfirmScreen`

**Route**: none (conditional render inside `LockScreen`).
**Presentation**: full-screen overlay over LockScreen (modal-style, covers the PIN pad).

### Required behavior

| Requirement | Trace | Notes |
|-------------|-------|-------|
| Reassurance copy (Portuguese) | FR-014, US3 scenario 1 | "Para redefinir seu PIN, você precisará entrar de novo com e-mail e senha. Seus dados continuam no aparelho." |
| Online-check before "Continuar" | FR-014, US3 scenario 2 | On mount, read `NetInfo.fetch()`. Also subscribe briefly for connectivity changes. "Continuar" button is disabled while `!isConnected || !isInternetReachable`; a sub-text shows "Conecte-se à internet para continuar". |
| Cancel button returns to LockScreen | FR-013, US3 scenario 6 | Simply flips the `showRecoveryConfirm` flag back to false; the PIN pad is visible again and the original PIN still unlocks. |
| "Continuar" calls `lockService.beginPinRecovery()` | FR-014, FR-015 | On resolve, the session transitions to `NotAuthenticated`; the RootNavigator unmounts the Home branch (and thus LockGate and this screen); the LoginScreen appears with the email pre-filled. |
| Preserves local business data | FR-015, SC-010 | The flow never calls any WatermelonDB mutation. The PIN wipe + logout do not touch business data per 003 FR-013 + 004 FR-015. |

### Cancel / Continuar flow

```text
continueSubmit() {
  setIsSubmitting(true);
  try {
    await lockService.beginPinRecovery();
    // Navigation away from this screen happens implicitly — session flips → RootNavigator unmounts Home branch.
  } catch (err) {
    if (err instanceof LockError && err.code === 'RECOVERY_OFFLINE') {
      setOfflineWarning(true);
    } else {
      setErrorText('Erro ao iniciar redefinição. Tente novamente.');
    }
  } finally {
    setIsSubmitting(false);
  }
}

cancel() {
  setShowRecoveryConfirm(false);  // LockScreen re-shows its PIN pad; original PIN still valid.
}
```

### What PinRecoveryConfirmScreen MUST NOT do

- **Must not** collect credentials itself. The LoginScreen is the credential-entry surface; this screen just confirms the intent.
- **Must not** delete any business data.
- **Must not** wipe the PIN before the online-check passes. FR-014.
- **Must not** dismiss itself on a successful recovery-begin call — the LockScreen's unmount (via LockGate observing session flip) is what removes it from the tree.

---

## `LockGate` — the render gate

### Required behavior

```tsx
export function LockGate({ children }: { children: React.ReactNode }) {
  const { status } = useLock();
  if (status === 'NotSet')  return <PinSetupScreen />;
  if (status === 'Locked')  return <LockScreen />;
  return <>{children}</>;   // Unlocked — render HomeStack
}
```

### What LockGate MUST NOT do

- **Must not** render anything conditionally that depends on the session status. LockGate is mounted only when the session is already Authenticated or RequiresRelogin (RootNavigator's branching already handled that). Double-guarding here would be redundant and would create a confusing failure mode if the two layers disagreed.
- **Must not** unmount HomeStack when transitioning Unlocked → Locked. React will reconcile: on Lock → Unlocked, HomeStack remounts if it had been unmounted. But per React Navigation's defaults, once HomeStack is mounted inside a container, swapping back to it is a navigation-preserving re-render. The gate renders whichever branch is active; when switching back to the `children` branch, React remounts the children tree. To preserve FR-012 (prior screen state after an inactivity lock), the HomeStack is rendered inside a `<View style={{ flex: 1, display: status === 'Unlocked' ? 'flex' : 'none' }}>` while the lock screen is layered on top — this keeps HomeStack mounted across Lock ↔ Unlocked transitions, preserving in-memory state. See implementation note below.
- **Must not** invoke any network calls.

### Implementation note on state preservation (FR-012)

The literal behavior "swap to a different component" would unmount HomeStack. Spec FR-012 requires that unlock-after-inactivity restores the salesperson to the exact screen and state they were on. The gate therefore implements **layered rendering**:

```tsx
return (
  <>
    <View style={{ flex: 1, display: status === 'Unlocked' ? 'flex' : 'none' }}>
      {children}
    </View>
    {status === 'NotSet'  && <PinSetupScreen  style={StyleSheet.absoluteFill} />}
    {status === 'Locked'  && <LockScreen      style={StyleSheet.absoluteFill} />}
  </>
);
```

HomeStack stays mounted across lock transitions. PIN setup and lock screens are layered on top, not swapped in. This is a render-level fact that the contract pins down to satisfy FR-012 without touching React Navigation.

**Exception**: on `NotSet → Unlocked` (first-run PIN setup completing), HomeStack mounting for the first time is a legitimate mount — there was no prior state to preserve. The layered render still works: HomeStack mounts when the gate first renders it, which is the first time `status === 'Unlocked'`.

---

## `RootNavigator` changes (MODIFIED from 003)

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

**Delta from 003**: the Home `<Stack.Screen />` uses a children render prop instead of `component` so it can wrap `<HomeStack />` in `<LockGate>`. The Relogin route stays unchanged at the root level.

---

## Summary

- Three lock screens, rendered by `LockGate` based on `lockStore.status`, layered on top of a persistently-mounted `HomeStack` to satisfy FR-012.
- `LockGate` lives inside the Home branch of `RootNavigator`; the Relogin modal remains at the root level from 003.
- PinSetupScreen forces first-run PIN entry + confirm; on success, the gate swaps to children.
- LockScreen tries biometrics, falls through to PIN pad on any non-success, enforces the progressive-delay curve, and routes to PinRecoveryConfirmScreen at attempt 10 or on "Esqueci meu PIN" tap.
- PinRecoveryConfirmScreen is an in-LockScreen overlay gating the destructive recovery action behind an online-check; its "Continuar" button invokes `lockService.beginPinRecovery()` and relies on session-state changes + the root navigator to route the salesperson back through LoginScreen → PinSetupScreen.
