# Feature Specification: Online-One-Time Authentication

**Feature Branch**: `003-online-auth`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User description: "Implement online-one-time authentication per constitution §7 D5. Flow: email/password login screen that authenticates against Supabase Auth, exchanges for access_token + refresh_token, persists the refresh_token (never the password) in expo-secure-store (Keychain/EncryptedSharedPreferences). Background silent refresh whenever connectivity returns; 90-day TTL enforcement; on refresh failure, keep local data intact, queue the failed sync, and prompt re-login only on the next network-requiring action. No feature may call validate-token on every tap. Include a logout flow that revokes the refresh token server-side and wipes the secure-store entry."

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from [layout.pen](../../layout.pen) via the Pencil MCP.
**Design system**: **shadcn/ui (light)** — fundo branco, card com borda fina, primary button preto. Variantes de botão (outline, secondary, ghost, destructive) reservadas para ações futuras de maior destaque.

### Screens

| Screen | Viewport | Screenshot | Intent |
|--------|----------|------------|--------|
| Login | Phone | [login-phone.png](./design/login-phone.png) | First-time online login em fundo branco — wordmark SALESFORCE, subtítulo "Entre para acessar sua conta.", email + password, primary button preto "Entrar", rodapé com redirecionamento ao administrador. Maps to User Story 1. |
| Login | Tablet | [login-tablet.png](./design/login-tablet.png) | Same contract, card centralizado ~440 px, wordmark maior. Maps to User Story 1. |
| Relogin | Phone | [relogin-phone.png](./design/relogin-phone.png) | Bottom-sheet modal sobre Home escurecida — e-mail read-only (muted + lock icon), senha, primary button preto "Entrar e sincronizar", ghost "Cancelar". Maps to User Story 2 (refresh-failure path) and FR-008/FR-018/FR-022. |
| Relogin | Tablet | [relogin-tablet.png](./design/relogin-tablet.png) | Dialog central sobre Home escurecida. Same contract as phone. |

### Design decisions carried into this spec

- **shadcn/ui como base** (light): neutro e denso o bastante para um app B2B de campo sem puxar dependência pesada — a implementação reimplementa os primitives em React Native (`View` / `TextInput` / `Pressable`), respeitando constituição §3 "heavy UI libraries are forbidden".
- **Primary button preto**: a CTA principal em cada tela é a única de alto peso visual; cor accent fica **reservada** para situações em que múltiplas ações coexistem na mesma superfície. Nas duas telas desta feature não há concorrência, então preto é suficiente.
- Wordmark **SALESFORCE** + subtítulo neutro *"Entre para acessar sua conta."* — a promessa do §7 D5 (90 dias offline) vive no comportamento (FR-001, SC-001) e não na copy de tela, mantendo a superfície resistente a mudanças de messaging.
- O Relogin modal sobre Home escurecida (dim `#0A0A0AB3`) é a representação visual de FR-008(a) — Home permanece montada; o prompt é overlay, nunca destrutivo. Alinha com RootNavigator mantendo Home no state `RequiresRelogin` (ver [plan.md](./plan.md#project-structure) e [contracts/screens.md](./contracts/screens.md#reloginscreen)).
- Reassurance copy *"Seus dados continuam no dispositivo. Entre novamente para sincronizar."* satisfaz FR-022 explicitamente; locked at design time.
- CTA do Relogin é *"Entrar e sincronizar"* (não só "Entrar") — mapeia o click ao efeito real (FR-010: re-auth destrava `_queuedSync`).
- Relogin phone usa **bottom-sheet** (grip bar); Relogin tablet usa **dialog central** (borda, sem grip) — ambos sobre Home escurecida. Mesma mensagem, duas apresentações nativas.
- Campo de e-mail read-only com ícone `lock` no Relogin enforça single-user-per-device (constituição §1) — trocar conta requer logout → login, não edição no campo.
- **Cancelar = ghost button** (muted-foreground, sem fill): intencionalmente fraco visualmente, mas legítimo (FR-008c) — local data segue intacto (FR-008a).
- Sem "Remember me", "Forgot password" ou "Create account" — constituição P4 (admin registra contas via Supabase dashboard) e escopo MVP lockam fora.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — The Salesperson Logs In Once and Works in the Field for Up to 90 Days (Priority: P1)

A salesperson opens the app for the first time on their device, connects to the internet (office Wi-Fi, for example), types their e-mail and password on a login screen, and authenticates. From that point on, every field operation — opening the catalog, registering a client, assembling an order, generating a PDF, recording a payment receipt — works without any further login prompt, even when the phone has no connectivity, for as long as the salesperson keeps using the app within a 90-day rolling window.

**Why this priority**: This is the core promise of constitution P1 (offline-first is non-negotiable) and §7 D5 (online-one-time, offline-persistent). Without this story delivered, every business feature built on top of this foundation would either be blocked by a login spinner in a store with no signal, or would have to build its own credential-handling workaround.

**Independent Test**: On a freshly installed app, perform one online login, then put the device in airplane mode and exercise every business feature the MVP ships. Zero additional login prompts appear over the test session. Killing and cold-launching the app while still offline still does not prompt for credentials.

**Acceptance Scenarios**:

1. **Given** a fresh install with internet available, **When** the salesperson types valid credentials and submits, **Then** the app authenticates with the remote auth provider, receives the credentials needed to operate offline, persists only the long-lived credential (never the password) in the device's secure credential storage, and navigates to the app's home.
2. **Given** a salesperson who has logged in successfully at least once, **When** the app is cold-launched with no internet, **Then** the login screen is skipped and the home screen appears with full access to catalog, clients, orders, PDFs, and receipts.
3. **Given** a salesperson in airplane mode mid-session, **When** they perform any business operation that the MVP ships offline (constitution P1), **Then** the operation completes against local data with no token-validation network call and no user-visible auth checkpoint.
4. **Given** the salesperson has been logged in and active for 89 days with periodic internet exposure, **When** they cold-launch the app again, **Then** they proceed straight to the home screen without being prompted for credentials.
5. **Given** the salesperson types wrong credentials on the login screen, **When** they submit, **Then** the login screen re-appears with a clear error message, and the app remains on the login screen — no partial state leaks into the app.

---

### User Story 2 — Credentials Refresh Silently the Moment Internet Returns (Priority: P2)

The salesperson walks from a store with no signal to a coffee shop with Wi-Fi. Without any action on their part, the app silently renews the authentication it needs to talk to the server and runs a sync pass in the background. The salesperson never sees a spinner, a toast, or a login dialog during this hand-over. If the renewal succeeds, everything just works; if it fails because the server has revoked the session, the salesperson still does not see a prompt until they actually try to do something that requires the network.

**Why this priority**: Without silent refresh, the promise of US1 decays: either the app starts demanding re-logins every few days, or worse, it starts pestering the salesperson in the middle of a store. Silent refresh is what makes "online-one-time" sustainable across a 90-day window. P2 rather than P1 because the salesperson can still work offline against the local database during the grace period between access-token expiry and the next sync attempt — but this story must ship together with US1, not later.

**Independent Test**: With the app logged in, put the device in airplane mode long enough for the short-lived access credential to expire. Re-enable connectivity. Observe the app: no modal or spinner appears; a sync pass runs in the background; a subsequent network-requiring action works without prompting. Separately, simulate a server-side revocation: observe that no prompt appears until the salesperson next attempts a network-requiring action.

**Acceptance Scenarios**:

1. **Given** a logged-in app in airplane mode, **When** connectivity is restored, **Then** the app silently attempts to renew the short-lived access credential in the background with no visible UI change during the happy path.
2. **Given** a successful background renewal, **When** it completes, **Then** the app runs a sync pass (pull-then-push per constitution D1) without the salesperson asking.
3. **Given** an expired or server-revoked long-lived credential, **When** the background renewal fails, **Then** (a) no local data is discarded, (b) any in-flight sync is queued for retry after re-auth, and (c) no re-login prompt is shown until the salesperson's next attempt at a network-requiring action.
4. **Given** the renewal failure in the scenario above, **When** the salesperson next attempts a network-requiring action (typically a manual sync), **Then** the re-login screen appears with the salesperson's e-mail pre-filled.
5. **Given** the app is simply in use offline with no connectivity events, **When** the salesperson performs any business operation, **Then** the app does NOT make a token-validation network call of any kind — offline operations MUST NOT trigger auth traffic.

---

### User Story 3 — The Salesperson Can Log Out and Revoke the Session Cleanly (Priority: P3)

The salesperson — or the admin working with them remotely — can trigger a logout from the app. The device's session is revoked on the server so a stolen or lost device can no longer sync, and the local credential is wiped from the secure store. Local business data that has not yet been synced is preserved by default so that logging back in does not erase the salesperson's field work.

**Why this priority**: Logout is the counterpart of login and the mechanism by which a salesperson rotates credentials or hands the device to another salesperson. P3 because the MVP can run a pilot without it — but it must exist before public rollout to satisfy §7 D5's "revoke the refresh token server-side and wipes the secure-store entry".

**Independent Test**: Trigger logout while online; confirm the remote session is revoked (a subsequent sync using the revoked credential is rejected by the server); confirm the device's secure credential storage no longer holds the long-lived credential. Separately, trigger logout while offline; confirm the local credential is still wiped (server revocation is retried next time connectivity returns, or simply fails silently — the device is already unauthenticated locally). In both cases, confirm local business data still exists on the device after logout.

**Acceptance Scenarios**:

1. **Given** a logged-in salesperson with internet, **When** they trigger logout, **Then** the app asks the remote auth provider to revoke the long-lived credential, removes the credential from secure storage, and returns to the login screen.
2. **Given** a logged-in salesperson with no internet, **When** they trigger logout, **Then** the credential is removed from secure storage immediately and the app returns to the login screen. Remote revocation is not required for the local wipe to succeed.
3. **Given** unsynced local changes (drafts, orders, receipts) at the time of logout, **When** connectivity is available and the salesperson confirms logout, **Then** the app offers to run a final sync before logging out; the salesperson can accept, decline, or cancel.
4. **Given** a salesperson has logged out, **When** they log back in on the same device with the same account, **Then** all locally stored business data from before the logout is still present (constitution P5).
5. **Given** a device has been logged out and its refresh credential revoked server-side, **When** anyone attempts to sync from that device after reinstalling the app with the old credential restored from backup, **Then** the server rejects the sync and the client falls back to the re-login prompt (FR-008c).

---

### Edge Cases

- What happens when the salesperson types credentials, submits, and the device has no internet? The login screen MUST stay on-screen with an error that distinguishes "no internet" from "wrong password"; no partial state leaks into the app.
- What happens when the remote auth provider is temporarily unreachable (5xx)? Same treatment as "no internet" — stay on the login screen, surface a "try again" error, do not mark the session as established.
- What happens when the device's clock is wrong? The 90-day TTL is enforced by the remote auth provider, not by the client, so client-side clock skew does not grant extra window. Client MAY optimistically attempt a refresh regardless.
- What happens when the device is restored from backup to a new phone? If the secure credential storage is restored along with the app, a silent refresh will either succeed (session still valid) or fail cleanly and prompt re-login. If the secure storage is not restored, the app behaves like a fresh install — the salesperson re-logs in.
- What happens when connectivity flaps on and off rapidly during a silent refresh? The refresh is best-effort; a failed refresh does not invalidate the existing long-lived credential. The next connectivity window retries. The salesperson is never prompted mid-flap.
- What happens when the salesperson uninstalls the app and reinstalls it? The secure credential storage is cleared by the OS on uninstall — the reinstall is effectively a fresh install (US1 scenario 1).
- What happens when a second salesperson tries to log into the same device without logout? Multi-user-per-device is out of scope for this feature (constitution §1 — one salesperson per install). The login screen is not expected to be reachable while a session exists; access to the logout flow is the supported path.
- What happens when the salesperson attempts logout but the server-side revocation call fails (network blip)? Local wipe still succeeds; the server-side revocation SHOULD be retried opportunistically, but the MVP MAY treat the token as "orphaned at the server" without retry — constitution accepts this because the server-side session is a short-lived (access-token) window and the full 90-day refresh ring is invalidated on the server at the next opportunity. Server RLS remains the final authority.
- What happens when the refresh fails but the salesperson is offline at the moment of failure? The salesperson never sees a prompt in that state — constitution §7 D5 requires the prompt only on the next network-requiring action. Local work continues unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide a login screen that accepts the salesperson's e-mail and password and uses them exactly once to authenticate against the remote auth provider.
- **FR-002**: On successful initial login, the app MUST receive a short-lived access credential and a long-lived refresh credential from the remote auth provider, and MUST persist only the long-lived credential.
- **FR-003**: The long-lived credential MUST be persisted in the operating-system's secure credential storage (Keychain on iOS, EncryptedSharedPreferences on Android, as surfaced by `expo-secure-store`). No other form of persistence (app preferences, plaintext file, application database) is acceptable for this credential.
- **FR-004**: The password MUST NEVER be written to any form of persistent storage — not disk, not secure enclave, not logs, not telemetry. It MUST be held in memory for the duration of the login exchange only and discarded immediately after the token exchange completes or fails.
- **FR-005**: Between successful logins, the app MUST NOT make a token-validation network call per business action. No user-facing feature (catalog, clients, orders, PDFs, receipts) MAY issue a validate-token round-trip as a precondition to its offline work.
- **FR-006**: When the device's operating system reports connectivity restoration (from an offline or no-network state), the app MUST attempt a background renewal of the short-lived access credential using the stored long-lived credential. This renewal MUST NOT surface a spinner, modal, toast, or any user-visible affordance on the happy path.
- **FR-007**: If the background renewal succeeds, the app MUST trigger a sync pass immediately, following the existing pull-then-push ordering defined by constitution D1. Retry semantics for an interrupted sync are owned by the sync block; this feature only hands off.
- **FR-008**: If the background renewal fails because the long-lived credential is rejected by the remote auth provider (expired, revoked, user disabled), the app MUST:
  (a) NOT discard or alter any local business data;
  (b) Mark the pending sync as queued so it can be retried after successful re-authentication;
  (c) Defer any re-login prompt until the salesperson's next attempt at a network-requiring action — and THEN present the re-login screen.
- **FR-009**: The 90-day TTL of the long-lived credential MUST be enforced — a refresh that has not been used successfully within the last 90 days MUST be treated as invalid and MUST follow the re-login flow defined in FR-008(c). The TTL is enforced by the remote auth provider; the client MAY also proactively treat any refresh older than 90 days as invalid to save a round-trip.
- **FR-010**: Successful re-login MUST clear the queued-pending-sync flag and MUST immediately retry the sync that was queued on FR-008(b).
- **FR-011**: The app MUST expose a logout action reachable from the salesperson-facing UI. Logout MUST (a) ask the remote auth provider to revoke the long-lived credential, (b) remove the long-lived credential from the device's secure credential storage, and (c) return the app to the login screen. Step (b) MUST succeed even if step (a) fails (e.g., no internet).
- **FR-012**: Once the sync block is installed, when the salesperson triggers logout AND internet is available AND unsynced local changes exist, the app SHOULD offer to run a final sync before completing logout; the salesperson MUST be able to accept the sync, decline and logout anyway, or cancel and return to the app. Until the sync block ships, logout proceeds unconditionally (the sync block does not exist to be called). The conditional-MUST reflects that this feature alone cannot observe "unsynced local changes" — that signal belongs to the sync block's state.
- **FR-013**: Local business data (clients, orders, order items, payment receipts, cached catalog, drafts) MUST NOT be deleted on logout. Constitution P5 (salesperson data is sacred) governs here. A separate "reset this device" / forensic-wipe flow is out of scope for this feature.
- **FR-014**: On cold launch, if a long-lived credential exists in secure storage AND its cached last-successful-refresh timestamp is inside the 90-day window, the app MUST skip the login screen and navigate directly into the app. No network round-trip MUST be required for this decision.
- **FR-015**: On cold launch, if no long-lived credential exists in secure storage (fresh install or post-logout), the app MUST present the login screen. The salesperson MUST NOT be able to proceed past this screen without a successful online authentication against the remote auth provider.
- **FR-016**: Login error handling MUST distinguish at the UX level between (a) no internet / server unreachable — "connect and try again", (b) invalid credentials — "check your e-mail and password", and (c) server-reported account issues (banned, disabled) — a generic "contact the admin" message. The app MUST NOT leak raw server error payloads or diagnostic strings to the salesperson.
- **FR-017**: The login screen MUST respect the tap-not-type principle (constitution UX1) as far as a credential form allows: it MUST offer a "show/hide password" toggle, MUST NOT demand non-essential fields, and MUST auto-fill the e-mail from the last successful login when one is available.
- **FR-018**: When the re-login prompt appears after a refresh rejection (FR-008(c)), the salesperson's e-mail MUST be pre-filled so only the password is required to resume work.
- **FR-019**: The salesperson's e-mail address MAY be persisted for UI display (home header, logout confirmation, re-login pre-fill). It is not treated as a secret; either secure-storage or regular app preferences are acceptable implementations — the choice is an implementation detail. The password, the long-lived credential, and the short-lived access credential are the only authentication materials governed by secure-storage rules (FR-003, FR-004).
- **FR-020**: The short-lived access credential MUST be held in memory only during a running app session and MUST NOT be persisted to disk in any form. Losing the access credential on app kill is expected and is recovered by a silent refresh when connectivity returns (FR-006).
- **FR-021**: The local lock feature defined by constitution §7 D6 (biometric/PIN unlock) is out of scope for this spec. This feature's behavior MUST remain valid whether or not D6 is installed — i.e., the session-authentication layer and the device-unlock layer MUST be independent.
- **FR-022**: The re-login screen triggered by FR-008(c) MUST make it unambiguous that local unsynced work is preserved, so the salesperson does not fear logging back in will erase their drafts. Exact copy is owned by the UI implementation (Portuguese, per constitution §9) but MUST communicate "your field data is safe; sign in to sync".

### Key Entities

- **Salesperson session**: the authenticated state of a device-salesperson pair. Conceptually holds the persisted long-lived credential (in the device's secure credential storage — never in the application database), the last-successful-refresh timestamp (for 90-day TTL bookkeeping), the queued-pending-sync flag (set when a refresh is rejected, cleared on successful re-login), and the salesperson's e-mail (persisted outside secure storage for UI convenience).
- **Login credential input**: the e-mail and password typed at the login screen. Ephemeral, in-memory only, discarded immediately after the token exchange completes or fails. Never appears in the salesperson-session entity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After one successful online login, a salesperson can perform 100% of the MVP's offline business operations (catalog browse, client registration, order assembly, PDF generation, payment-receipt capture) with no internet connection for up to 90 days with exactly zero additional login prompts — provided the app sees at least one connectivity window in that period.
- **SC-002**: In a 5-minute scripted offline session covering a typical store visit (open catalog, scroll through 50 products, add 10 items to an order, generate a PDF), the total number of token-validation network calls the app attempts is **zero**.
- **SC-003**: In a 100-trial test harness where connectivity is restored after each trial of offline work, the silent background refresh completes without any visible UI affordance in at least 99 of 100 trials on the happy path.
- **SC-004**: Across 100 simulated refresh-rejection events (server-side token revocation), the number of local business records lost is **zero**, the number of pending syncs silently dropped is **zero**, and the number of premature re-login prompts (prompts presented before the salesperson's next network-requiring action) is **zero**.
- **SC-005**: The password is verifiably absent from the device's persistent state after login — a filesystem and secure-storage audit conducted immediately after a successful login finds no entry holding the password, its hash, or a reversible transform of it.
- **SC-006**: Logout (online) completes end-to-end — server-side revocation requested, local secure-storage entry wiped, and the app returned to the login screen — in under 3 seconds on a mid-range Android device. Logout (offline) completes the local wipe and the navigation in under 1 second on the same device regardless of server reachability.
- **SC-007**: After logout, a re-login with the same account on the same device restores access to 100% of the local business data that existed before the logout. Zero drafts, orders, clients, or receipts are lost to the logout cycle.
- **SC-008**: A server-side session revocation applied by the admin (via the remote auth provider's admin surface) causes the next sync attempt from the affected device to be rejected within one refresh round-trip — the device MUST NOT be able to push new writes after that revocation is propagated by the server.
- **SC-009**: On a cold launch where the long-lived credential exists and is inside the 90-day window, the time from app-tap to the first business screen ready to interact does NOT include a blocking network round-trip — auth adds **0 seconds** to that budget on an offline device.
- **SC-010**: The login screen itself renders and is interactive (the salesperson can type in the e-mail field) in under 1 second from app-tap on a mid-range Android device, on a fresh install.

## Assumptions

- The remote auth provider is Supabase Auth (constitution §3 Mandatory Stack; constitution P4 — reuse free tools before building). This feature does not introduce or re-evaluate that choice.
- The device's secure credential storage is accessed via `expo-secure-store` (constitution §3 Mandatory Stack, added in constitution v0.2.0 for §7 D5). This feature does not re-evaluate that choice.
- The 90-day refresh-token TTL is configured at the Supabase project level and is enforced server-side. The client applies the same window conservatively to avoid useless round-trips but is not the source of truth on TTL.
- The short-lived access credential's lifetime (e.g., one hour) is whatever the remote auth provider issues by default. This feature does not re-configure it. The refresh mechanism tolerates any reasonable access-token lifetime.
- Connectivity change detection is provided by the platform (`@react-native-community/netinfo` or an equivalent standard library). This feature does not poll for connectivity.
- The sync block (pull-then-push per constitution D1) already exists or will land alongside this feature. This spec's FR-007 and FR-010 cross the seam by invoking "run a sync pass" without specifying how — that is the sync block's responsibility.
- The local data layer defined by feature 002 (WatermelonDB) is in place before this feature lands — so local business data survives auth events as required by FR-013.
- The local-lock feature defined by constitution §7 D6 (biometric / PIN) is a separate spec, independent of this one (FR-021). The unlock layer may gate access to the app but does NOT influence session authentication state.
- The logout flow triggers server-side revocation via the remote auth provider's standard sign-out endpoint; this feature does not engineer a custom revocation mechanism.
- Single-user-per-device is a constitution §1 invariant. The spec does not design for account switching on the same device; any such scenario is routed through logout-then-login.
- Error copy on the login and re-login screens is in Portuguese (constitution §9). Final copy is owned by the UI implementation; this spec defines the semantics (FR-016, FR-022) but not the strings.
- The salesperson's e-mail is not treated as a secret — it is persisted outside the secure store for UI display and for pre-filling the login form (FR-017, FR-018, FR-019). Only the password and the long-lived credential are subject to secure-storage rules.
- "Next network-requiring action" in FR-008(c) and US2 refers to any salesperson-initiated action that intrinsically requires server reachability — in the MVP that is the manual sync pull-to-refresh and any implicit sync the app runs on connectivity recovery. PDF generation, PDF emailing via the device's share sheet, catalog browse, client register, and order assembly are NOT network-requiring in the constitutional sense (constitution P1) and MUST NOT trigger the re-login prompt.
- The "queued sync" referenced in FR-008(b) and FR-010 is a **single boolean flag** — `_queuedSync` in the live session state (see [data-model.md §3](./data-model.md#3-session--the-live-session-state)) — that records whether a sync attempt was in flight at the moment of refresh rejection. It is **not a queue of pending writes**: the sync block owns any internal queue of writes, separately. Successful re-login clears this flag; the sync block (when it ships) reads the flag once to decide whether to retry its push after re-auth.
- Automated testing priorities follow constitution §9: business-logic coverage (token-refresh decisioning, TTL enforcement, queued-sync handoff) over UI coverage of the login screen. UI verification is manual during MVP.
