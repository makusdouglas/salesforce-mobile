# Contract — Auth screens and navigation

**Feature**: 003-online-auth
**Status**: Authoritative — every screen or navigator that interacts with the auth flow conforms to this contract.
**Implementation paths**: `src/features/auth/screens/LoginScreen.tsx`, `src/features/auth/screens/ReloginScreen.tsx`, `src/app/navigation/RootNavigator.tsx`, `src/app/navigation/AuthStack.tsx`.

---

## Navigation topology

```text
<NavigationContainer ref={rootNavigationRef}>
  <RootStackNavigator>
    ├── Auth (only mounted when session.status === 'NotAuthenticated')
    │   └── Login
    ├── Home (only mounted when session.status ∈ { 'Authenticated', 'RequiresRelogin' })
    │   └── ... (feature stacks per existing scaffold)
    └── Relogin (modal, mounted regardless of status but opened only by requireSession())
  </RootStackNavigator>
</NavigationContainer>
```

`RootNavigator` reads `session.status` via `useSession()` and conditionally renders `AuthStack` vs. `HomeStack`. The `Relogin` route is **not** under `AuthStack`; it sits at the root level as a modal, so it can appear on top of the Home tree without tearing it down (FR-008a — preserving local state while the prompt is shown).

---

## `LoginScreen`

**Route name**: `'Login'` under `AuthStack`.
**Params**: none.
**Presentation**: full screen.

### Required behavior

| Requirement | Trace | Notes |
|-------------|-------|-------|
| Email input auto-filled from `auth.lastEmail` when available | FR-017 | Read via `secureStore.getLastEmail()` in a `useEffect`. |
| Password input with show/hide toggle | FR-017 | `PasswordField` component (`src/features/auth/components/PasswordField.tsx`). |
| No non-essential form fields | FR-017 | Exactly two inputs + one submit button. |
| Error classification surfaced per AuthError code | FR-016 | Copy from the table in [auth-service.md](./auth-service.md#error-code--ux-copy-mapping-for-loginscreen--reloginscreen). |
| No partial state leaks to the app on failure | FR-001 scenario 5, spec edge case 1 | The screen stays mounted until `authService.login(...)` resolves. On throw, it remains on-screen with the error visible. Session state is NOT touched on failed login — the LoginScreen is the only caller of `authService.login` and it does not cause a side-effect on failure. |
| Password wiped from input state on successful login | FR-004 | `setPassword('')` is called inside the resolve branch of the login submit handler before navigating. |

### Submit flow

```text
submit() {
  setIsSubmitting(true);
  try {
    await authService.login({ email, password });
    setPassword('');                 // FR-004 — wipe before React keeps the input node around
    // RootNavigator observes session.status → 'Authenticated' and swaps to HomeStack.
  } catch (err) {
    if (err instanceof AuthError) {
      setErrorCode(err.code);        // renders the Portuguese copy from the mapping table
    } else {
      setErrorCode('ACCOUNT_ISSUE'); // unknown errors are routed to the safest message per FR-016
    }
  } finally {
    setIsSubmitting(false);
  }
}
```

### What LoginScreen MUST NOT do

- **Must not** persist the password anywhere (including React DevTools' component tree — password input is `secureTextEntry` + `autoComplete="current-password"` + `textContentType="password"` so platform tooling handles it correctly).
- **Must not** navigate away from itself on failure. Only success navigates (implicitly, via RootNavigator's observation of the session state).
- **Must not** provide a "Stay logged in" checkbox. The refresh token IS the "stay logged in" mechanism (FR-002 / FR-003) — there is no opt-out in the MVP.
- **Must not** provide a "Forgot password" link in the MVP. Password reset is out of scope for this feature; the administrator runs it via the Supabase dashboard (constitution P4).

---

## `ReloginScreen`

**Route name**: `'Relogin'` at the root navigator level (NOT under `AuthStack`).
**Params**: `{ resolve: () => void, reject: () => void }` — passed by `requireSession()` via the navigation ref.
**Presentation**: modal (slides up, does not unmount Home below).

### Required behavior

| Requirement | Trace | Notes |
|-------------|-------|-------|
| Email is pre-filled from `auth.lastEmail` | FR-018 | Read on mount. The salesperson only types the password. |
| Copy reassures that field data is safe | FR-022 | Visible heading text (Portuguese) informs the salesperson: "Seus dados continuam no dispositivo. Entre novamente para sincronizar." |
| Submit button triggers `authService.relogin(...)` | FR-010 | On resolve, calls the `resolve()` navigation-param callback; `requireSession()` then continues the deferred action. |
| Cancel button dismisses the modal | FR-008c | Calls the `reject()` navigation-param callback; `requireSession()` throws `AuthError('RELOGIN_REQUIRED')` to the original caller, which aborts the deferred action. Local data is untouched (FR-008a). |
| Relogin error UX matches LoginScreen | FR-016 | Same copy table. |

### Submit flow

```text
submit() {
  setIsSubmitting(true);
  try {
    const { hadQueuedSync } = await authService.relogin({ email, password });
    setPassword('');
    params.resolve();                  // unblocks requireSession()'s awaiter
    // If hadQueuedSync, the sync block re-triggers its push; the screen does not need to care.
  } catch (err) {
    setErrorCode(err instanceof AuthError ? err.code : 'ACCOUNT_ISSUE');
  } finally {
    setIsSubmitting(false);
  }
}

cancel() {
  params.reject();
  // navigation.goBack() is called by the nav-ref helper, not here
}
```

### What ReloginScreen MUST NOT do

- **Must not** wipe WatermelonDB (P5, FR-013).
- **Must not** be reachable from a button on the Home screen. It only appears when `requireSession()` opens it. If the salesperson wants to re-auth voluntarily, they go through Settings → Logout → Login.
- **Must not** allow switching email. Re-login with a different account requires a full logout flow first (single-user per device, constitution §1).

---

## `RootNavigator` — the state-driven selector

### Required behavior

```tsx
function RootNavigator() {
  const { status } = useSession();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {status === 'NotAuthenticated' ? (
        <RootStack.Screen name="Auth" component={AuthStack} />
      ) : (
        <RootStack.Screen name="Home" component={HomeStack} />
      )}
      <RootStack.Screen
        name="Relogin"
        component={ReloginScreen}
        options={{ presentation: 'modal' }}
      />
    </RootStack.Navigator>
  );
}
```

The `Relogin` screen is registered unconditionally so `rootNavigationRef.navigate('Relogin', { resolve, reject })` always succeeds. When the session transitions `NotAuthenticated → Authenticated` (successful login), React Navigation swaps to the Home tree on the next frame. No Home-tree screen needs to know about auth.

### What RootNavigator MUST NOT do

- **Must not** block on any network call. Status is read locally (FR-014 — 0 s added to cold launch).
- **Must not** call `authService.refresh()` directly. The bootstrap (inside `SessionProvider`) handles the initial hydration; the connectivity listener handles ongoing refreshes.

---

## Logout entry point (transitional)

The real logout UI lives with the future home / settings feature. Until that ships, HomeStack's placeholder screen gains a minimal `"Sair"` button that:

1. Asks the sync block (if installed) "any pending changes? is the net reachable?".
2. If both yes → shows a native `Alert` with three options (Sync then log out / Log out anyway / Cancel).
3. Calls `authService.logout()` in the chosen branch.

This is a transitional scaffold only; it lives in HomeStack.tsx and is removed when the home/settings feature takes over (tracked as a dependency in block 003's tasks, not a promise to the salesperson in the spec).
