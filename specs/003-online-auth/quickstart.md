# Quickstart — Using authentication in a feature

**Feature**: 003-online-auth
**Audience**: developers writing a feature under `src/features/<feature>/` that needs the current session, the current salesperson's email, or the server round-trip that a future sync block will own.

The auth module is a single barrel at `@/features/auth`. Three public entry points cover every use case:

- **`useSession()`** — reactive snapshot of the session for UI.
- **`requireSession()`** — gate for any network-requiring action.
- **`authService`** — imperative methods (login, logout) for screens that own those actions.

Everything else (`sessionStore`, `secureStore`, `authService.refresh`, the connectivity listener) is internal.

---

## 1. Install (one-time, handled by this feature's tasks)

After this block is implemented, a fresh clone must:

```bash
pnpm install
pnpm exec expo prebuild            # regenerates ios/ and android/ with expo-secure-store + netinfo
cp .env.example .env               # fill in EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
pnpm exec eas build --profile development --platform ios   # or android
```

No new Xcode / Gradle steps. `expo-secure-store` and `@react-native-community/netinfo` have Expo config plugins that work under the dev client shipped in block 002.

---

## 2. Read the session in a React component

```tsx
// src/features/home/screens/HomePlaceholderScreen.tsx
import { Text } from 'react-native';
import { useSession } from '@/features/auth';

export function HomePlaceholderScreen() {
  const { email } = useSession();
  return <Text>Olá, {email}</Text>;
}
```

- `useSession()` returns `{ status, email }`. `status` is `'NotAuthenticated' | 'Authenticated' | 'RequiresRelogin'`.
- The hook re-renders only when `status` or `email` change — silent refreshes do NOT cause re-renders (research R6 + [contracts/session.md](./contracts/session.md)).
- If you render `email` before the first authenticated session has resolved, it's `null` — guard accordingly.

---

## 3. Guard a network-requiring action

Whenever a future feature calls out to Supabase (sync push, sync pull, any server-backed operation), it first awaits `requireSession()`:

```ts
// Example: the future sync block's push function
import { requireSession, AuthError } from '@/features/auth';

export async function syncPush() {
  let accessToken: string;
  try {
    ({ accessToken } = await requireSession());
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.code === 'NETWORK')           return { ok: false, reason: 'offline' };
      if (err.code === 'RELOGIN_REQUIRED')  return { ok: false, reason: 'user-canceled-relogin' };
      if (err.code === 'NOT_AUTHENTICATED') return { ok: false, reason: 'no-session' };
    }
    throw err;
  }

  // accessToken is valid; proceed with the Supabase call.
  await supabase.from('orders').insert(...);
}
```

Key points:

- `requireSession()` **will surface the Relogin modal** if the stored refresh token is rejected — the *only* function in the codebase that may do so.
- Callers do NOT need to know about the refresh flow, the 90-day TTL, connectivity events, or any of the auth state machine. They just await.
- `requireSession()` returns quickly (synchronous access-token cache hit) in the happy path. A round-trip only happens when the cached access token is absent or expired.

**Rule**: Every module that initiates a server call must route through `requireSession()`. No exceptions. Never call `supabase.auth.*` directly outside of `src/features/auth/`.

---

## 4. Trigger logout from a settings button

```tsx
import { Alert, Button } from 'react-native';
import { authService } from '@/features/auth';

function LogoutButton() {
  return (
    <Button
      title="Sair"
      onPress={() => {
        Alert.alert('Sair', 'Seus dados continuam no dispositivo.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: () => authService.logout() },
        ]);
      }}
    />
  );
}
```

- `authService.logout()` wipes secure-store, clears the in-memory session, and best-effort revokes the server-side token. It always resolves once local steps complete, even if the server call fails (FR-011).
- After resolve, RootNavigator observes `status === 'NotAuthenticated'` and swaps to the Login screen automatically.
- The more elaborate "offer final sync before logout" flow (FR-012) lives in the settings screen that composes this button with sync-status info. The core `authService.logout()` does not enforce it.

---

## 5. What the bootstrap does (you do NOT call this yourself)

At app start, `AppProviders` wraps the tree with `<SessionProvider>`, which runs a single-shot bootstrap inside a `useEffect`:

```text
1. Read auth.refreshCredential from secure store.
2. If absent                                  → status = NotAuthenticated.
3. If present AND lastRefreshAtMs within 90 days → status = Authenticated (optimistic, no network call — FR-014).
4. If present AND lastRefreshAtMs older than 90 days → delete the credential; status = NotAuthenticated; preserve lastEmail.
5. Start the NetInfo listener.
6. If status is Authenticated AND the device is currently online, fire a silent refresh to get an access token.
```

You do not invoke this directly. You do not need to wait for it — the initial snapshot reflects the bootstrap outcome synchronously enough that the first render of `RootNavigator` sees the right `status`.

---

## 6. What NOT to do

- ❌ `import { createClient } from '@supabase/supabase-js'` in feature code — ESLint (block 002 R11) forbids `@supabase/*` outside `src/data/`. The Supabase client lives at `src/data/supabase.ts`; auth goes through `authService`.
- ❌ `import { sessionStore } from '@/features/auth/session/session'` — bypasses the hook; not re-exported from the barrel.
- ❌ `import SecureStore from 'expo-secure-store'` anywhere outside `src/features/auth/storage/` — the wrapper is the only sanctioned caller (see [contracts/secure-storage.md](./contracts/secure-storage.md)).
- ❌ Call `authService.refresh()` from a feature — it is not re-exported; the connectivity listener and `requireSession()` are the only callers.
- ❌ Show the Relogin screen from anywhere other than `requireSession()`. If you feel tempted to do so, the problem is probably somewhere else.
- ❌ Persist anything auth-adjacent to WatermelonDB. Auth state never touches the local database.
- ❌ Add a "remember me" checkbox, a "forgot password" link, or a signup screen in the MVP. Constitution P4 (reuse Supabase dashboard) and the spec's explicit scope (single-user per device, admin-managed accounts) rule these out.

---

## 7. Testing your feature against auth

You do **not** need to stand up a mock Supabase to test a feature that depends on auth. Two practical paths:

- **Unit tests**: import from a test double of `@/features/auth` that returns a canned `SessionSnapshot`. The auth module's internal state machine is tested separately (research R12); your feature does not need to re-test it.
- **Manual verification**: run the dev client, log in once against the real Supabase project, and exercise your feature. For the "refresh failure" path (FR-008), trigger it from the Supabase admin dashboard (revoke the refresh token) and observe your feature's behavior when the next network-requiring action runs.

If your feature is itself the sync block (which owns the most integration-heavy interaction with auth), build a minimal harness that injects a stubbed `requireSession` — the auth test file cannot cover all the sync-side edge cases, only the auth-side of the contract.

---

## 8. Feature checklist for any PR that touches a network round-trip

- [ ] All Supabase calls (including the ones that will arrive in the sync block) route through `requireSession()` first.
- [ ] No `supabase.auth.*` call anywhere outside `src/features/auth/service/authService.ts`.
- [ ] No access token held in component state. Only `authService` keeps it in memory; callers receive it from `requireSession()` and pass it directly to the HTTP call, then let it go.
- [ ] Errors from `requireSession()` handled: `NETWORK` (toast / retry), `RELOGIN_REQUIRED` (abort silently — the screen already shown the prompt), `NOT_AUTHENTICATED` (developer bug — throw a loud error).
- [ ] No feature-local subscriber to the connectivity listener — that's auth's responsibility. Features should poll `requireSession()` at the moment they need the token.
- [ ] No password passed anywhere except into `authService.login(...)` / `authService.relogin(...)`.
