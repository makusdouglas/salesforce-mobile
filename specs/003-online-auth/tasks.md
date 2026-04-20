# Tasks: Online-One-Time Authentication

**Input**: Design documents from `/specs/003-online-auth/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/auth-service.md](./contracts/auth-service.md), [contracts/session.md](./contracts/session.md), [contracts/secure-storage.md](./contracts/secure-storage.md), [contracts/screens.md](./contracts/screens.md), [design/screens.md](./design/screens.md), [quickstart.md](./quickstart.md)

**Tests**: Two unit-test files only, per constitution §9 ("test investment goes to business logic") and [research.md R12](./research.md#r12--test-surface-business-logic-first): the session state machine and the secure-store wrapper. No UI tests. No integration tests. Screen behavior is verified manually against the acceptance scenarios in [spec.md](./spec.md).

**Organization**: Tasks are grouped by user story per the spec's P1/P2/P3 ordering.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Relative-to-repo-root file paths

## Path Conventions

- Source layout from [plan.md Project Structure](./plan.md#project-structure): `src/features/auth/` owns everything auth-specific; `src/data/supabase.ts` is the single Supabase client.
- All identifiers in English (constitution §9). UI copy in Portuguese.
- Every create/edit cites the exact file path.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the three new runtime dependencies (Supabase, secure-store, netinfo), install jest + ts-jest for the two unit tests ([research.md R12](./research.md#r12--test-surface-business-logic-first)), wire env-var plumbing, add the secure-store config plugin, and regenerate native projects.

- [x] T001 Install runtime dependencies: run `pnpm add @supabase/supabase-js expo-secure-store @react-native-community/netinfo @expo-google-fonts/inter expo-font` at repo root. Verify resulting `package.json` lists all five.
- [x] T002 [P] Install dev dependencies for unit tests: `pnpm add -D jest ts-jest @types/jest`. Add `"test": "jest"` to `package.json`'s `scripts`. Create `jest.config.ts` at repo root with `preset: 'ts-jest'`, `testEnvironment: 'node'`, `testMatch: ['<rootDir>/src/**/*.test.ts']`, `moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }`. Tests are pure TypeScript (no React Native runtime) per [research.md R12](./research.md#r12--test-surface-business-logic-first).
- [x] T003 [P] Create `.env.example` at repo root with two lines: `EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co` and `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`. Verify `.env` is already in `.gitignore`; if not, append it.
- [x] T004 [P] Edit `app.json` — append `"expo-secure-store"` to the `expo.plugins` array (create the array if it does not exist). `@react-native-community/netinfo` and `@expo-google-fonts/inter` need no plugin. Leave existing plugins untouched.
- [x] T005 [P] Create the directory skeleton under `src/features/auth/`: `service/`, `session/`, `storage/`, `connectivity/`, `hooks/`, `components/`, `screens/`, `theme/`, `tests/`. Leave the existing `src/features/auth/screens/AuthPlaceholderScreen.tsx` in place — T028 replaces it with `LoginScreen.tsx`.
- [ ] T006 Run `pnpm exec expo prebuild --clean` to regenerate `ios/` and `android/` with the new native modules (`expo-secure-store`, `netinfo`) linked. Commit the regenerated files. Depends T001, T004. *Note: one-time local action; subsequent clones rerun via `pnpm install && pnpm exec expo prebuild`.*

**Checkpoint**: Project builds a dev client; `pnpm lint`, `pnpm typecheck`, `pnpm test` (empty) all pass on the pre-003 codebase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land every piece of infrastructure the three user stories share — Supabase client, shadcn theme tokens, base UI primitives, secure-store wrapper, session state machine, React hook + provider, boot initializer skeleton, connectivity listener skeleton, `authService` skeleton with unimplemented methods, `requireSession` skeleton, and barrel. The two unit-test files also land here since they test foundational modules.

**⚠️ CRITICAL**: No work in Phases 3–5 may begin until all Phase 2 tasks complete.

- [x] T007 [P] Create `src/features/auth/theme/tokens.ts` exporting shadcn/ui light tokens as typed constants: `colors` (`background #FFFFFF`, `foreground #0A0A0A`, `primary #18181B`, `primaryForeground #FAFAFA`, `muted #F4F4F5`, `mutedForeground #71717A`, `border #E4E4E7`, `placeholder #A1A1AA`, `destructive #EF4444`, `overlay rgba(10,10,10,0.70)`), `radii` (`lg 8`, `xl 12`, `'2xl' 16`, `full 9999`), `spacing` (`xs/sm/md/lg/xl/2xl/3xl` = 4/8/12/16/20/24/32), `fontSizes` (12–30 scale), and `font.family = 'Inter'`. Values per [design/screens.md Tokens table](./design/screens.md#tokens-shadcn-light).
- [x] T008 [P] Create `src/features/auth/components/Card.tsx` — a `View`-based wrapper with `backgroundColor: colors.background`, `borderWidth: 1`, `borderColor: colors.border`, `borderRadius: radii.xl`, `padding: spacing['2xl']`. Accepts `style` override and `children`. No external dependency.
- [x] T009 [P] Create `src/features/auth/components/Input.tsx` — a `TextInput` styled per shadcn: height 40, `backgroundColor: colors.background`, `borderWidth 1`, `borderColor: colors.border`, `borderRadius: radii.lg`, `paddingHorizontal: spacing.md`, font Inter 14 `colors.foreground`, placeholder color `colors.placeholder`. Props: `label?: string` (rendered above when provided, Inter 13 500 `colors.foreground`), `value`, `onChangeText`, `placeholder`, `secureTextEntry?`, `autoCapitalize?`, `keyboardType?`, `rightSlot?: ReactNode`, `disabled?`, `readOnly?` (when true, swap bg to `colors.muted` and remove border).
- [x] T010 [P] Create `src/features/auth/components/Button.tsx` — a `Pressable` with `variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'` (default `'primary'`), `size: 'md' | 'lg'` (default `'md'`, height 40/46), `onPress`, `disabled?`, `loading?`, `children` (string or node). Variant styling per [design/screens.md Components](./design/screens.md#components-referenced-ad-hoc--a-promover-como-reusables-quando-reutilizados): primary fills `colors.primary`/text `colors.primaryForeground`; ghost is transparent with `colors.mutedForeground` text; outline has border `colors.border` + transparent fill; destructive uses `colors.destructive`. All variants share `borderRadius: radii.lg`.
- [x] T011 [P] Create `src/features/auth/components/PasswordField.tsx` — wraps `Input` with `secureTextEntry` toggled by an `Feather` icon (`eye` / `eye-off`) placed in the `rightSlot`. Uses `import { Feather } from '@expo/vector-icons';` — no new package needed ([design/screens.md Implementation mapping](./design/screens.md#implementation-mapping-react-native)). Exposes `value`, `onChangeText`, `label` only.
- [x] T012 [P] Create `src/features/auth/service/errors.ts` — export `class AuthError extends Error { code: 'NETWORK' | 'INVALID_CREDENTIALS' | 'ACCOUNT_ISSUE' | 'NOT_AUTHENTICATED' | 'RELOGIN_REQUIRED' }` and `function mapToAuthErrorCode(err: unknown): AuthError['code']` that classifies Supabase `AuthApiError` / `AuthError` shapes and `fetch` failures per [research.md R9](./research.md#r9--error-mapping-supabase--ux-copy) exactly. Never includes raw payload or stack in the error message (FR-016).
- [x] T013 Create `src/data/supabase.ts` — export `const supabase = createClient(url, anonKey, { auth: { autoRefreshToken: true, persistSession: false, detectSessionInUrl: false } })`. Read `url` from `process.env.EXPO_PUBLIC_SUPABASE_URL` and `anonKey` from `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`. If either is missing, `throw new Error('Missing EXPO_PUBLIC_SUPABASE_* env var')` at module evaluation time so the failure is loud at dev-client boot. Edit `src/data/index.ts` barrel to append `export { supabase } from './supabase';`.
- [x] T014 [P] Create `src/features/auth/storage/secureStore.ts` — typed wrapper per [contracts/secure-storage.md](./contracts/secure-storage.md). Six methods: `getRefreshCredential()`, `setRefreshCredential({ refreshToken, lastRefreshAtMs })`, `deleteRefreshCredential()`, `getLastEmail()`, `setLastEmail(email)`, `deleteLastEmail()`. Keys `'auth.refreshCredential'` and `'auth.lastEmail'`. Every `setItemAsync` passes `{ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }`. `getRefreshCredential` returns `null` on absence, on `JSON.parse` failure, and on schema-shape failure (defensive — a corrupt entry is indistinguishable from "no credential" at the auth state-machine level).
- [x] T015 [P] Create `src/features/auth/session/session.ts` — the module-level session singleton per [contracts/session.md](./contracts/session.md). Export `sessionStore.getSnapshot(): SessionSnapshot` (returns a frozen `{ status, email }`) and `sessionStore.subscribe(listener): () => void`. Export `_internalSessionStore` with `setAuthenticated`, `setRequiresRelogin`, `setNotAuthenticated`, `getInternal` (returns `{ accessToken, accessTokenExpiresAtMs, _isRefreshing, _queuedSync }`), `setInternal(patch)`. Subscribers held in a `Set<() => void>`; notify after each mutation; freeze snapshots in `__DEV__`. No listener may synchronously trigger a transition (throw in `__DEV__` if so).
- [x] T016 [P] Create `src/features/auth/hooks/useSession.ts` — `useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot)`. Return `{ status, email }` exactly. Depends T015.
- [x] T017 Create `src/features/auth/session/bootstrap.ts` — export `async function authBootstrap(): Promise<void>`:
  1. `const cred = await secureStore.getRefreshCredential()`.
  2. `const lastEmail = await secureStore.getLastEmail()`.
  3. If `cred === null`: `_internalSessionStore.setNotAuthenticated({ preserveEmail: lastEmail })`; return.
  4. If `Date.now() - cred.lastRefreshAtMs > 90 * 24 * 60 * 60 * 1000`: `await secureStore.deleteRefreshCredential()`; `_internalSessionStore.setNotAuthenticated({ preserveEmail: lastEmail })`; return.
  5. Else: `_internalSessionStore.setAuthenticated({ email: lastEmail ?? '', accessToken: '', accessTokenExpiresAtMs: 0, clearQueuedSync: true })` — optimistic Authenticated without access token (FR-014). The connectivity listener (T018) or `requireSession` (T022) will trigger the first refresh when needed.
  Depends T014, T015.
- [x] T018 [P] Create `src/features/auth/connectivity/connectivity.ts` — export `function startConnectivityListener(): () => void`. Subscribes via `NetInfo.addEventListener`. Tracks the previous `isConnected && isInternetReachable` value. On transition `false → true`, debounces 500 ms (trailing — per [research.md R4](./research.md#r4--connectivity-detection-library)), then fire-and-forgets `authService.refresh({ reason: 'connectivity' }).catch(() => {})`. Ignores if `_internalSessionStore.getInternal()._isRefreshing === true`. Returns the unsubscribe function. Depends T015, T021 (authService skeleton).
- [x] T019 [P] Create `src/features/auth/components/SessionProvider.tsx` — React component. On mount: `const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold })` (from `@expo-google-fonts/inter`). Then `useEffect(() => { authBootstrap(); return startConnectivityListener(); }, [])`. If `!fontsLoaded` render `null` (block first frame until font is ready — unblocks shadcn typography contract). Else render `{children}`. Depends T017, T018.
- [x] T020 Edit `src/app/providers/AppProviders.tsx` — wrap `<SafeAreaProvider>{children}</SafeAreaProvider>` with `<SessionProvider>`. Keep the existing `import '@/data';` side-effect import. Final shape: `<SessionProvider><SafeAreaProvider>{children}</SafeAreaProvider></SessionProvider>`. Depends T019.
- [x] T021 Create `src/features/auth/service/authService.ts` — skeleton export `const authService = { login, refresh, relogin, logout }` with each method throwing `new Error('not implemented')`. Signatures exactly as in [contracts/auth-service.md](./contracts/auth-service.md#authservice-shape). Stories US1/US2/US3 fill these in (T026, T030, T031, T038). Lets the barrel (T023) compile now.
- [x] T022 [P] Create `src/features/auth/session/requireSession.ts` — skeleton `requireSession()` per [contracts/auth-service.md §requireSession](./contracts/auth-service.md#requiresession--the-only-path-that-may-surface-the-re-login-prompt). For now handle only: `status === 'Authenticated'` with valid cached access token → return `{ accessToken }`; `status === 'NotAuthenticated'` → throw `AuthError('NOT_AUTHENTICATED')`. The `RequiresRelogin` branch and refresh-on-demand branch are completed in T032 (US2).
- [x] T023 Create `src/features/auth/index.ts` barrel — re-exports **only** these public names: `authService`, `useSession`, `requireSession`, `SessionProvider`, `AuthError`, types `SessionStatus`, `SessionSnapshot`. Do NOT re-export `sessionStore`, `_internalSessionStore`, `secureStore`, `Card`, `Input`, `Button`, `PasswordField`, screens, connectivity, bootstrap, or `supabase`. Depends T010–T022.
- [x] T024 [P] Create `src/features/auth/tests/session.test.ts` — ten unit tests for the session state machine covering every transition row in [contracts/session.md §state-transitions-authoritative-table](./contracts/session.md#state-transitions--authoritative-table): login success, refresh success (same-status emit), refresh rejection → RequiresRelogin, logout from Authenticated, logout from RequiresRelogin, 90-day TTL elapse at boot, relogin success clears `_queuedSync`, user-cancel Relogin (no state change), `_queuedSync` is not set on reason='boot', and a control test that `getSnapshot()` returns the frozen object after every transition. Mock `secureStore` entirely (`jest.mock('../storage/secureStore')`).
- [x] T025 [P] Create `src/features/auth/tests/secureStore.test.ts` — unit tests for the secure-store wrapper: round-trip encode/decode of `RefreshCredential`, missing-key → `null`, non-JSON → `null`, JSON-valid-but-wrong-shape → `null`, email round-trip, `deleteRefreshCredential` is idempotent, `setItemAsync` always called with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Mock `expo-secure-store` via `jest.mock`.

**Checkpoint**: `pnpm typecheck` + `pnpm test` green. `pnpm lint` green. `authService` methods still throw; that's expected. Dev client boots, sees no token, lands on `AuthPlaceholderScreen` (the existing stub — still the default route since RootNavigator branching ships in T029).

---

## Phase 3: User Story 1 — Online-Once Login, Then 90 Days Offline (Priority: P1) 🎯 MVP

**Goal**: Salesperson installs the app on a Wi-Fi'd device, types email + password once, is authenticated, and every subsequent business action works offline. A cold-launch in airplane mode goes straight to Home with zero login prompts.

**Independent Test**: Fresh install → online → open app → LoginScreen appears → type valid credentials → tap Entrar → arrive at Home. Enable airplane mode → kill app → cold-launch → still on Home, no prompt, no spinner.

### Implementation for User Story 1

- [x] T026 [US1] Implement `authService.login({ email, password })` in `src/features/auth/service/authService.ts`:
  1. `const { data, error } = await supabase.auth.signInWithPassword({ email, password })`.
  2. If `error`: `throw new AuthError(mapToAuthErrorCode(error))`.
  3. If `!data.session`: `throw new AuthError('ACCOUNT_ISSUE')` (defensive — Supabase contract guarantees a session on success).
  4. Extract `accessToken = data.session.access_token`, `refreshToken = data.session.refresh_token`, `accessTokenExpiresAtMs = (data.session.expires_at ?? 0) * 1000`.
  5. `await secureStore.setRefreshCredential({ refreshToken, lastRefreshAtMs: Date.now() })` and `await secureStore.setLastEmail(email)` in parallel via `Promise.all`.
  6. `_internalSessionStore.setAuthenticated({ email, accessToken, accessTokenExpiresAtMs, clearQueuedSync: true })`.
  Depends T013, T014, T015, T021. FR-001, FR-002, FR-003, FR-004.
- [x] T027 [US1] Create `src/features/auth/screens/LoginScreen.tsx` — implements the phone and tablet layouts captured in [design/login-phone.png](./design/login-phone.png) and [design/login-tablet.png](./design/login-tablet.png), per contract in [contracts/screens.md §LoginScreen](./contracts/screens.md#loginscreen):
  - Root: `ScrollView` with `contentContainerStyle: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 72, paddingHorizontal: 24, gap: 40 }`.
  - Wordmark: `View` 48×48 `backgroundColor: colors.primary`, `borderRadius: radii.lg`, centered `<Feather name="shopping-bag" size={20} color={colors.primaryForeground} />`.
  - Heading: Inter 22/700 letterSpacing 2 `"SALESFORCE"`, subtitle Inter 14 `colors.mutedForeground` `"Entre para acessar sua conta."`.
  - `<Card>` containing `<Input label="E-mail" ...>`, `<PasswordField label="Senha" ...>`, `<Button variant="primary">Entrar</Button>`.
  - Footer: Inter 12 `colors.mutedForeground` `"Precisa de acesso? Fale com o administrador."`.
  - On mount: `useEffect(() => { secureStore.getLastEmail().then(v => v && setEmail(v)); }, [])`.
  - Submit handler exactly per [contracts/screens.md §LoginScreen-submit-flow](./contracts/screens.md#submit-flow): `setIsSubmitting(true)`; `try { await authService.login({ email, password }); setPassword(''); }` `catch (err) { setErrorCode(err instanceof AuthError ? err.code : 'ACCOUNT_ISSUE'); } finally { setIsSubmitting(false); }`. Error copy rendered inline above the button using the Portuguese mapping in [contracts/auth-service.md §error-code-ux-copy](./contracts/auth-service.md#error-code--ux-copy-mapping-for-loginscreen--reloginscreen).
  - Responsive: on `width >= 768`, wrap the card in `<View style={{ maxWidth: 440, width: '100%' }}>` and center; wordmark scales to 64×64, heading to 30, etc., per tablet screenshot.
  Depends T008–T012, T014, T026.
- [x] T028 [US1] Edit `src/app/navigation/AuthStack.tsx` — replace the `AuthPlaceholderScreen` import and `Stack.Screen` with `LoginScreen` under route name `'Login'`. Edit `src/app/navigation/types.ts` — change `AuthStackParamList = { Login: undefined }`. **Delete** `src/features/auth/screens/AuthPlaceholderScreen.tsx`. Depends T027.
- [x] T029 [US1] Edit `src/app/navigation/RootNavigator.tsx` — remove `initialRouteName="Home"`; read `status` from `useSession()`; render `<Stack.Screen name="Auth" component={AuthStack} />` when `status === 'NotAuthenticated'`, otherwise render `<Stack.Screen name="Home" component={HomeStack} />`. Do **not** register the `Relogin` modal here — US2 does that in T035. Edit `src/app/navigation/types.ts` if needed so `RootStackParamList` still has `Auth` and `Home` entries. Depends T016, T028.

**Checkpoint**: MVP slice ready.
- Fresh install → LoginScreen → valid login → Home.
- Invalid credentials → stays on LoginScreen with inline error.
- No internet → stays on LoginScreen with "Sem conexão" error.
- After a login, kill + cold-launch offline → still on Home, zero network calls (FR-005, FR-014, SC-001, SC-002, SC-009).

---

## Phase 4: User Story 2 — Silent Refresh + Re-Login on Rejection (Priority: P2)

**Goal**: The long-lived credential is rotated silently whenever connectivity returns. If the server rejects the refresh, the app keeps working offline and only prompts re-login when the salesperson tries a network-requiring action.

**Independent Test**:
- Logged-in app, cached access token expired, airplane mode → disable airplane → silent refresh fires, no UI change, subsequent sync works.
- Admin revokes the refresh token server-side → app continues to work offline → salesperson triggers a manual sync → Relogin modal appears with email pre-filled → enter password → Entrar e sincronizar → Home returns, queued sync fires.

### Implementation for User Story 2

- [x] T030 [US2] Implement `authService.refresh(opts?: { reason?: 'boot' | 'connectivity' | 'requireSession' })` in `src/features/auth/service/authService.ts`:
  1. `const cred = await secureStore.getRefreshCredential()`. If null: `_internalSessionStore.setNotAuthenticated({ preserveEmail: await secureStore.getLastEmail() })`; `throw new AuthError('RELOGIN_REQUIRED')`.
  2. If `Date.now() - cred.lastRefreshAtMs > 90 * 24 * 60 * 60 * 1000`: `await secureStore.deleteRefreshCredential()`; `_internalSessionStore.setNotAuthenticated({ preserveEmail: await secureStore.getLastEmail() })`; `throw new AuthError('RELOGIN_REQUIRED')`.
  3. `_internalSessionStore.setInternal({ _isRefreshing: true })`.
  4. `try { const { data, error } = await supabase.auth.refreshSession({ refresh_token: cred.refreshToken }); ... } finally { _internalSessionStore.setInternal({ _isRefreshing: false }); }`.
  5. On `error` classified as `NETWORK`: `throw new AuthError('NETWORK')` (state unchanged).
  6. On `error` classified as anything else (rejection): `await secureStore.deleteRefreshCredential()`; `_internalSessionStore.setRequiresRelogin({ preserveEmail: (await secureStore.getLastEmail()) ?? '', queueSync: opts?.reason !== 'boot' })`; `throw new AuthError('RELOGIN_REQUIRED')`.
  7. On success: extract new access+refresh+expires; `await secureStore.setRefreshCredential({ refreshToken: data.session.refresh_token, lastRefreshAtMs: Date.now() })`; `_internalSessionStore.setAuthenticated({ email: (await secureStore.getLastEmail()) ?? '', accessToken: data.session.access_token, accessTokenExpiresAtMs: (data.session.expires_at ?? 0) * 1000, clearQueuedSync: false })`.
  8. **Sync-block seam (FR-007 handoff)**: after step 7, if a sync module is mounted (e.g. `@/features/sync`), fire-and-forget `sync.runPullThenPush().catch(() => {})`. The sync block is **not** shipped with this feature — this task implements the handoff as a no-op when the module is absent. See [plan.md Assumptions](./plan.md#assumptions) and [research.md R1](./research.md#r1--supabase-auth-sdk-which-methods-which-persistence-mode) for the rationale; the future sync-feature task list will fill in `runPullThenPush`. Today: leave a one-line comment `// TODO(sync-block): call sync.runPullThenPush() here when the feature ships` at the call site.
  Depends T014, T015, T026 (for shared post-success state path). FR-006, FR-007, FR-008, FR-009, FR-020.
- [x] T031 [US2] Implement `authService.relogin({ email, password }): Promise<{ hadQueuedSync: boolean }>` in `src/features/auth/service/authService.ts`:
  1. Read `const hadQueuedSync = _internalSessionStore.getInternal()._queuedSync` **before** the network call.
  2. Delegate to the same login flow as T026 (extract as a private `_completeLoginExchange(email, password)` helper; reuse in both `login` and `relogin`).
  3. On success, `_internalSessionStore.setAuthenticated({ ..., clearQueuedSync: true })` (clears `_queuedSync`).
  4. Return `{ hadQueuedSync }`.
  Depends T026. FR-010, FR-018.
- [x] T032 [US2] Complete `requireSession()` in `src/features/auth/session/requireSession.ts` per [contracts/auth-service.md §requireSession](./contracts/auth-service.md#requiresession--the-only-path-that-may-surface-the-re-login-prompt):
  1. Snapshot = `sessionStore.getSnapshot()`; internal = `_internalSessionStore.getInternal()`.
  2. If `snapshot.status === 'NotAuthenticated'`: `throw new AuthError('NOT_AUTHENTICATED')`.
  3. If `snapshot.status === 'RequiresRelogin'`: `await new Promise<void>((resolve, reject) => rootNavigationRef.navigate('Relogin', { resolve, reject }))`; then **recurse**. If the promise rejects (user canceled), re-throw `new AuthError('RELOGIN_REQUIRED')`.
  4. If `internal.accessToken && Date.now() < internal.accessTokenExpiresAtMs - 5000` (5 s safety margin): return `{ accessToken: internal.accessToken }`.
  5. Else: `try { await authService.refresh({ reason: 'requireSession' }); return requireSession(); } catch (err) { if (err instanceof AuthError && err.code === 'RELOGIN_REQUIRED') { return requireSession(); } else { throw err; } }`.
  Depends T022, T030, T033.
- [x] T033 [US2] Create `src/app/navigation/navigationRef.ts` — `export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();`. Edit `App.tsx` to pass `ref={rootNavigationRef}` on `<NavigationContainer>`. Edit `src/app/navigation/types.ts` — add `Relogin: { resolve: () => void; reject: () => void }` to `RootStackParamList` so the ref is typed and navigation to the modal is type-safe. The `rootNavigationRef` is imported by `requireSession()` (T032); never imported from feature code. **No external dependencies** — T035 registers the actual modal route later (types land here to break the former T033↔T035 cycle).
- [x] T034 [US2] Create `src/features/auth/screens/ReloginScreen.tsx` — implements phone (bottom-sheet) + tablet (center dialog) per [design/relogin-phone.png](./design/relogin-phone.png) / [design/relogin-tablet.png](./design/relogin-tablet.png), contract in [contracts/screens.md §ReloginScreen](./contracts/screens.md#reloginscreen):
  - Route params: `{ resolve: () => void; reject: () => void }`. Received via `useRoute()`.
  - Root: on phone, backdrop `View` `flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end'`; on tablet, same backdrop but `justifyContent: 'center', alignItems: 'center'`.
  - Card `View` in white: phone — `borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12`; tablet — `borderRadius: radii['2xl']`, border `1px colors.border`, `width: 460`.
  - Grip bar (phone only): 40×4 rounded `colors.border`.
  - Header: `Feather refresh-cw` 20/22 in a 44×44/52×52 `colors.muted` rounded circle; `Sessão expirada` Inter 18/20 600; body `Seus dados continuam no dispositivo. Entre novamente para sincronizar.` Inter 14 `colors.mutedForeground` center aligned.
  - Email read-only row: `<Input readOnly rightSlot={<Feather name="lock" size={14} color={colors.mutedForeground} />} value={email} />`.
  - Password: `<PasswordField label="Senha" />`.
  - `<Button variant="primary">Entrar e sincronizar</Button>` / `<Button variant="ghost" onPress={handleCancel}>Cancelar</Button>`.
  - On mount: pre-fill email from `secureStore.getLastEmail()`. Never allow editing the email (read-only — FR-018, constitution §1).
  - Submit: `await authService.relogin({ email, password })`; then `params.resolve()`.
  - Cancel: `params.reject(); rootNavigationRef.goBack();`.
  Depends T008–T012, T014, T031, T033.
- [x] T035 [US2] Edit `src/app/navigation/RootNavigator.tsx` — register `<Stack.Screen name="Relogin" component={ReloginScreen} options={{ presentation: 'modal' }} />` **outside** the status-conditional (always registered so `requireSession` can navigate to it regardless of status). The type entry in `RootStackParamList` was already added by T033. Depends T034.
- [x] T036 [US2] Replace the placeholder callback body in `src/features/auth/connectivity/connectivity.ts` with the real `authService.refresh({ reason: 'connectivity' }).catch(err => { /* AuthError NETWORK: next event retries. AuthError RELOGIN_REQUIRED: state already transitioned; nothing to do here. */ })`. Depends T018, T030.
- [x] T037 [US2] Edit `src/features/auth/session/bootstrap.ts` — after the optimistic `setAuthenticated` in step 5, if `await NetInfo.fetch()` reports `isConnected && isInternetReachable`, call `authService.refresh({ reason: 'boot' }).catch(() => {})`. Do not await — the first frame of the UI must not block on this. Depends T017, T030.

**Checkpoint**: Silent refresh works end-to-end. Server-side revocation defers the prompt to the next network-requiring action (FR-008). `_queuedSync` is set on rejection and cleared on successful re-login (FR-010). No visible UI during happy-path refresh (SC-003). Zero validate-token calls in a typical 5-minute session (SC-002).

---

## Phase 5: User Story 3 — Clean Logout (Priority: P3)

**Goal**: Salesperson triggers logout. Server-side session is revoked (best-effort), local secure-store entries are wiped, LoginScreen appears. Local business data survives intact.

**Independent Test**:
- Online logout: tap Sair → confirm → `auth.refreshCredential` absent from Keychain, `supabase.auth.signOut()` called, LoginScreen visible. Log back in same account → prior WatermelonDB records still present.
- Offline logout: airplane mode → tap Sair → confirm → secure-store still wiped, LoginScreen appears, `signOut` call swallowed silently.

### Implementation for User Story 3

- [x] T038 [US3] Implement `authService.logout()` in `src/features/auth/service/authService.ts`:
  1. `await Promise.all([secureStore.deleteRefreshCredential(), secureStore.deleteLastEmail()])`.
  2. `_internalSessionStore.setNotAuthenticated({ preserveEmail: null })`.
  3. Fire-and-forget `supabase.auth.signOut().catch(() => {})`. Do **not** await — constitution P5 + FR-011: local wipe succeeds even if the server call fails.
  Depends T013, T014, T015. FR-011, FR-013.
- [x] T039 [US3] Edit `src/features/home/screens/HomePlaceholderScreen.tsx` — add a transitional `Sair` button at the bottom using `<Button variant="ghost">Sair</Button>`. On press, `Alert.alert('Sair da conta', 'Seus dados permanecem no dispositivo.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: () => authService.logout() }])`. This is the **transitional** logout entry (spec calls it "transitional scaffold" — it lives in HomeStack until the future home/settings feature subsumes it). The "offer final sync before logout" variant from FR-012 lands **with the sync block** (per the updated FR-012 conditional-MUST wording — the sync block is its trigger, not this feature). This feature ships the unconditional-logout path; the sync-block feature adds the final-sync dialog when it arrives. Depends T010, T038.

**Checkpoint**: Logout cycle complete. Spec's SC-006 and SC-007 observable. Local WatermelonDB records preserved after logout + re-login (spot-check manually).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T040 [P] Run `pnpm lint`, `pnpm typecheck`, `pnpm test` at repo root — all three must be green before merging. If the ESLint `no-restricted-imports` rule added by block 002 flags any Supabase import outside `src/data/`, fix before merge (the intended escape is via `authService` / `supabase` from `@/data`).
- [ ] T041 [P] Walk through every acceptance scenario in [spec.md §User Scenarios](./spec.md#user-scenarios--testing-mandatory) on a real dev-client build (iOS + Android). Record each pass/fail in the PR description. Manual verification covers: US1 scenarios 1–5, US2 scenarios 1–5, US3 scenarios 1–5, plus the nine Edge Cases. **SC-008 is cross-feature** (it measures the sync block's behavior after server-side revocation, which cannot be exercised until the sync feature ships) — mark it as **N/A — pending sync feature** in this batch and re-verify when the sync feature lands.
- [ ] T042 Run a filesystem + Keychain audit after a successful login: confirm the password string does not appear in `~/Library/Developer/CoreSimulator/.../Documents/` (iOS sim) or via `adb shell run-as com.<pkg>` (Android). Acceptance of SC-005. Record the audit command and its output (redacted) in the PR description.
- [x] T043 [P] Confirm [design/screens.md Tokens](./design/screens.md#tokens-shadcn-light) and `src/features/auth/theme/tokens.ts` match byte-for-byte on hex values — drift check before merge.
- [x] T044 [P] Grep `src/features/auth/` (and `src/data/supabase.ts`) for `console.log` / `console.warn` / `console.error` / `console.info` / `console.debug`. For each hit, confirm the log line does **not** include `password`, `refreshToken`, `accessToken`, or any substring of their values. Redact or remove any violator. This is the FR-004 compliance gate at log level — `AuthError.message` is already taxonomic (T012), but ad-hoc `console.*` calls inside the flow are an implicit risk if they ever get added.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: starts immediately.
- **Foundational (Phase 2)**: depends on Setup — blocks all user stories.
- **US1 / US2 / US3 (Phases 3–5)**: all depend on Foundational. US2 depends structurally on US1 (relogin shares the credential exchange path). US3 can technically ship in parallel with US2 but is P3 and is typically built after.
- **Polish (Phase 6)**: depends on whichever user stories are being shipped in this batch.

### User Story Dependencies

- **US1 (P1)**: requires Foundational only. Ships as MVP.
- **US2 (P2)**: depends on US1 (T031 `relogin` reuses the credential-exchange helper factored out of T026 `login`). Can begin once T026 is done.
- **US3 (P3)**: independent of US2; depends on T014 (secure-store) and T015 (session store) from Foundational, plus T010 (Button) from Foundational.

### Within Each User Story

- Models/services before screens: `authService.login` (T026) before `LoginScreen` (T027) before navigation wiring (T028, T029).
- In US2: `refresh` (T030) + `relogin` (T031) before `requireSession` completion (T032) before `ReloginScreen` (T034) before navigation registration (T035).
- Connectivity listener activation (T036) and bootstrap refresh (T037) come last in US2 — they rely on `authService.refresh` being real.

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005 are all [P] (different files).
- Phase 2: T007–T012, T014, T015, T016, T018, T022, T024, T025 are [P] across different files. T013 (`supabase.ts`) is alone in `src/data/` and can be [P] with everything else. T017, T019, T020, T021, T023 have dependencies and are sequential within their local subgraph.
- US1: none of the four tasks run in parallel — they're linearly dependent.
- US2: T030 + T031 + T034 can proceed in parallel once T026 (US1) and T033 (navigationRef) are done.
- US3: both tasks are sequential.

---

## Parallel Example — Phase 2 Foundational

```bash
# Start a burst of foundational work once T006 (prebuild) completes:
Task: "Create src/features/auth/theme/tokens.ts"                          # T007
Task: "Create src/features/auth/components/Card.tsx"                      # T008
Task: "Create src/features/auth/components/Input.tsx"                     # T009
Task: "Create src/features/auth/components/Button.tsx"                    # T010
Task: "Create src/features/auth/components/PasswordField.tsx"             # T011
Task: "Create src/features/auth/service/errors.ts"                        # T012
Task: "Create src/data/supabase.ts + barrel re-export"                    # T013
Task: "Create src/features/auth/storage/secureStore.ts"                   # T014
Task: "Create src/features/auth/session/session.ts"                       # T015
Task: "Create src/features/auth/hooks/useSession.ts"                      # T016
Task: "Create src/features/auth/session/requireSession.ts (skeleton)"     # T022
Task: "Unit tests: session.test.ts"                                       # T024
Task: "Unit tests: secureStore.test.ts"                                   # T025
```

T017 (bootstrap), T018 (connectivity), T019 (SessionProvider), T020 (AppProviders edit), T021 (authService skeleton), T023 (barrel) follow once their deps settle.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) — everything marked above, including unit tests.
3. Complete Phase 3 (US1) — T026 → T027 → T028 → T029.
4. **STOP and VALIDATE**: run acceptance scenarios for US1 against a dev-client build on a real device. No silent refresh, no Relogin — but login works and the 90-day window is already enforced at the bootstrap level via T017.
5. Demo to the stakeholder. At this point, a salesperson who logs in online can work offline for 90 days. The only missing behavior is silent renewal when connectivity returns — every cold-launch still uses the stored credential. Good enough for a pilot with weekly resync.

### Incremental Delivery

1. Setup + Foundational → infrastructure ready.
2. US1 → ship as MVP. Internal test with real salespeople for 1 week of field use.
3. US2 → ship next. Unlocks the truly seamless "never log in again" experience.
4. US3 → ship last. Only needed before the pilot ends and the device rotation policy kicks in.

### Parallel Team Strategy

Single-developer project per the constitution §3 ("a solo project") — parallelism is across **files**, not **developers**. The [P] marks throughout Phase 2 are the opportunity to commit broadly-scoped infrastructure in a single sitting before moving to story work.

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks.
- `[Story]` label maps the task to US1 / US2 / US3 for traceability.
- No UI tests, no integration tests, no E2E harness — constitution §9 + [research.md R12](./research.md#r12--test-surface-business-logic-first).
- Verify unit tests fail before implementing the state machine (TDD discipline for T015 / T024 pair and T014 / T025 pair).
- Commit after each task or tight logical group. Prefer small, reviewable commits.
- Stop at each checkpoint to validate.
- Avoid: bypassing `requireSession()`, storing the access token on disk, importing `@supabase/*` outside `src/data/`, persisting the password anywhere.
