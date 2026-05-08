# Feature Specification: Sync Engine

**Feature Branch**: `005-sync-engine`
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description: "Build the sync engine per constitution D1, R1, and UX4. Pull-then-push order: first pull server changes (catalog, clients, orders from other salespeople) from Supabase into WatermelonDB, then push local changes. Conflict resolution is last-write-wins by updated_at timestamp. Trigger points: on successful login, on manual pull-to-refresh from the home screen, and opportunistically after an order transitions to 'sent' when connectivity is available. Expose a discreet always-on sync-status indicator for the home screen (never a modal) with states: in-sync, syncing, offline, failed. No blocking spinner on any business screen."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First sync on login (Priority: P1)

After a salesperson logs in successfully (first install or after a re-login), the app pulls the latest catalog, clients, peer orders, and receipts from the server into the local database and then pushes anything that was queued locally. From the moment sync starts, the home screen shows the `syncing` state in its status indicator; once the pass completes, the indicator shows `in-sync`. The salesperson can begin browsing the catalog while the pass runs — no screen blocks on it.

**Why this priority**: Without this pass, the MVP cannot ship. The salesperson cannot see the admin-managed catalog, and any local drafts created before a re-login would be stranded. This is the minimum-viable slice of the feature.

**Independent Test**: Install the app on a clean device, log in with valid credentials while online, and verify that (a) the catalog appears in the app within the defined budget, (b) any orders the same salesperson created on another device also appear, (c) any locally queued changes land in the admin dashboard, and (d) the home-screen indicator transitions `syncing → in-sync`.

**Acceptance Scenarios**:

1. **Given** the salesperson has just logged in on a fresh install and has connectivity, **When** the login completes, **Then** the app pulls all catalog entries, clients visible to them under server authorization, peer orders, and receipts into the local database, and then pushes any locally queued changes — in that order.
2. **Given** a sync pass is running, **When** the salesperson opens the catalog, clients list, or starts assembling an order, **Then** the screen renders immediately from whatever is already local and no full-screen spinner blocks interaction.
3. **Given** the pull phase completes successfully but the push phase fails (e.g., connection lost mid-push), **When** the pass ends, **Then** no pulled data is lost, the local changes remain queued unchanged, and the indicator transitions to `failed`.
4. **Given** a sync pass is already in progress, **When** a second trigger fires (e.g., login completes while a pull is still running), **Then** the second trigger is coalesced — only one pass runs at a time.

---

### User Story 2 - Always-on sync status indicator (Priority: P1)

Wherever the home screen is shown, a small, always-visible indicator tells the salesperson the state of their data without requiring any interaction. It has exactly four states — `in-sync`, `syncing`, `offline`, `failed` — and it never opens a modal, never blocks input, and never covers business content.

**Why this priority**: UX4 of the constitution mandates that the salesperson always know whether their data is synced. Shipping the sync engine without the indicator violates the constitution and leaves the salesperson guessing.

**Independent Test**: With the app installed and connectivity controllable, verify that the indicator on the home screen reflects each of the four states within one second of the underlying condition changing: toggle airplane mode on (`offline`), off (transition back to `in-sync` or `syncing`), force a push rejection (`failed`), and trigger a manual pull (`syncing → in-sync`).

**Acceptance Scenarios**:

1. **Given** the device has connectivity and the last sync completed successfully and there are no queued local changes, **When** the home screen is visible, **Then** the indicator shows `in-sync`.
2. **Given** a sync pass is running, **When** the home screen is visible, **Then** the indicator shows `syncing`.
3. **Given** the device has no connectivity, **When** the home screen is visible, **Then** the indicator shows `offline`, regardless of whether local changes are queued.
4. **Given** the last sync attempt ended in an error (network drop mid-push, server rejection, refresh-token failure), **When** the home screen is visible and the device has connectivity, **Then** the indicator shows `failed` and the state persists until the next trigger fires or the salesperson pull-to-refreshes.
5. **Given** the indicator is in any of the four states, **When** the salesperson navigates across business screens (catalog, clients, order builder, receipts), **Then** no blocking spinner or modal appears on those screens as a side-effect of the current sync state.

---

### User Story 3 - Manual pull-to-refresh from the home screen (Priority: P2)

The salesperson pulls down on the home screen to force an immediate sync pass. This is the escape hatch for the case where they *know* something changed on the server (the admin added a product, a peer registered a shared client) and they do not want to wait for a natural trigger.

**Why this priority**: Not required for the first login flow to work, but it is the only way for the salesperson to fix a `failed` state without restarting the app, and the only way to pick up admin-side changes mid-session.

**Independent Test**: With the app in `in-sync` state, change a product in the admin dashboard, then pull-to-refresh on the home screen and confirm (a) the indicator goes `syncing → in-sync` and (b) the updated product appears in the catalog.

**Acceptance Scenarios**:

1. **Given** the home screen is visible and the device is online, **When** the salesperson performs the pull-to-refresh gesture, **Then** a full pull-then-push pass runs and the indicator transitions `syncing → in-sync` (or `failed` on error).
2. **Given** the indicator shows `failed`, **When** the salesperson performs pull-to-refresh, **Then** the engine retries the full pass.
3. **Given** the device is offline, **When** the salesperson performs pull-to-refresh, **Then** the gesture completes without error, the indicator remains `offline`, and no sync attempt is queued solely because of this gesture.

---

### User Story 4 - Opportunistic sync after order sent (Priority: P3)

When the salesperson confirms that a quote email has been sent and the order's status transitions to `sent`, the app opportunistically starts a sync pass in the background so the new order mirrors to the server promptly — if (and only if) connectivity is available at that moment.

**Why this priority**: Reduces the gap between the field action ("I just sent the quote") and the admin's visibility of it, without forcing the salesperson to think about sync. If offline, the order still sits locally and will be picked up by the next trigger — so this story is a nice-to-have for freshness, not a correctness requirement.

**Independent Test**: With the device online, assemble an order, send the quote (status → `sent`), and verify the indicator briefly shows `syncing` and the order appears in the admin dashboard without the salesperson performing any explicit sync action.

**Acceptance Scenarios**:

1. **Given** an order transitions from `draft` to `sent` and the device has connectivity, **When** the transition completes, **Then** a sync pass is scheduled and runs — the indicator transitions `in-sync → syncing → in-sync`.
2. **Given** an order transitions to `sent` and the device is offline, **When** the transition completes, **Then** no sync pass is attempted, the order remains locally queued, and the indicator shows `offline`.
3. **Given** the salesperson sends several quotes in rapid succession, **When** multiple transitions happen within a short window, **Then** the engine coalesces them into at most one in-flight pass plus at most one queued follow-up pass.

---

### Edge Cases

- **Trigger while already syncing**: overlapping triggers collapse into a single in-flight pass; at most one queued follow-up pass.
- **Network drops mid-pull**: data already pulled is kept, the pass ends in `failed`, local changes stay queued untouched, indicator shows `failed`.
- **Network drops mid-push**: already-pushed records are not re-pushed on the next pass (idempotency by record id); the remainder stays queued. Indicator shows `failed`.
- **Refresh token rejected during sync**: the pass aborts, local data is preserved, indicator shows `failed`, and the authentication flow takes over on the next network-requiring action (per constitution D5).
- **Row-level conflict (same record updated on device and server since last pull)**: resolved by last-write-wins on `updated_at`. The record with the older `updated_at` loses; content of the losing side is discarded.
- **Clock skew between device and server**: `updated_at` on push is stamped server-side so ties are broken authoritatively; purely local edits that never reached the server still use the device clock until reconciled.
- **Server deletes a record the device has a queued update for**: the incoming server tombstone wins under last-write-wins; the local queued update is dropped silently. Acceptable under P2 and D2 — salespeople don't edit catalog, and admin-authored corrections supersede.
- **Very first login on a device with a large catalog**: sync runs in the background on the post-login screen; the home screen is immediately usable and progress is visible via the indicator's `syncing` state.
- **Device offline at login**: login itself requires internet (constitution D5), so this case is prevented upstream. If the silent refresh re-enters later while offline, the indicator shows `offline` and no pass runs.
- **App backgrounded during a sync pass**: the in-flight pass is allowed to finish best-effort; if the OS suspends the process, the pass ends in `failed` and the next trigger resumes.

## Requirements *(mandatory)*

### Functional Requirements

#### Sync orchestration

- **FR-001**: The sync engine MUST perform every pass in the order *pull-then-push*: first pull server-side changes into the local database, then push locally queued changes. (Constitution D1.)
- **FR-002**: The engine MUST run against the local database as the client data layer; UI components MUST NOT call the server directly as a side-effect of a sync pass. (Constitution R1.)
- **FR-003**: The engine MUST allow at most one pass to be in-flight at any time. Overlapping triggers MUST be coalesced into a single in-flight pass plus at most one queued follow-up pass.
- **FR-004**: The engine MUST fire a pass on each of the following triggers, and ONLY these triggers (no periodic timer-based sync in the MVP):
  - after a successful login,
  - when the salesperson performs pull-to-refresh on the home screen,
  - opportunistically when an order transitions to `sent` AND the device has connectivity.
- **FR-005**: When a pass is attempted while the device has no connectivity, the engine MUST NOT produce an error visible to the salesperson; it MUST set the status indicator to `offline` and defer work to the next trigger.
- **FR-006**: When a pass fails after an attempt (server error, network drop mid-pass, auth rejection), the engine MUST preserve all local data unchanged, record the failure, set the indicator to `failed`, and leave the failure state until the next trigger fires.

#### Data coverage and conflict resolution

- **FR-007**: The pull phase MUST bring down server-side changes for the catalog (products and product variants), clients visible to the salesperson under server authorization, orders and order items (including those created by other salespeople whom the salesperson is authorized to see), and payment receipts.
- **FR-008**: The push phase MUST send all locally created or modified records that have not yet been acknowledged by the server: clients registered by the salesperson, orders and order items, and payment receipts. The catalog MUST NOT be pushed from the device. (Constitution D2.)
- **FR-009**: Row-level conflicts MUST be resolved by last-write-wins using the `updated_at` timestamp. The record with the larger `updated_at` is kept; the losing side is discarded. (Constitution P2.)
- **FR-010**: On push, the server MUST be the authority for stamping `updated_at` on the resulting record, so that subsequent conflict resolution uses a consistent clock.
- **FR-011**: Deletions are server-authoritative: the server signals deletion via a tombstone (or equivalent soft-delete marker) on pull, and the local row is removed accordingly. The client MUST NOT initiate hard deletes of shared data during sync.
- **FR-012**: Push MUST be idempotent per record: a record already acknowledged by the server in a previous pass MUST NOT be re-pushed.

#### Status indicator

- **FR-013**: The app MUST expose a sync-status indicator on the home screen that is always visible, never a modal or alert. (Constitution UX4.)
- **FR-014**: The indicator MUST support exactly four states: `in-sync`, `syncing`, `offline`, `failed`. No other states.
  - `in-sync`: last pass completed successfully, device has connectivity, and no locally queued changes are pending push.
  - `syncing`: a pass is currently in-flight (either pull or push phase).
  - `offline`: the device currently has no connectivity.
  - `failed`: the most recent completed pass ended in an error AND the device currently has connectivity (otherwise `offline` takes precedence).
- **FR-015**: The indicator MUST update within one second of the underlying state changing (pass start, pass end, connectivity change).
- **FR-016**: The indicator MUST NOT open a modal, cover business content, or block any input on any screen.

#### Non-blocking UX

- **FR-017**: No business screen (catalog, clients, client history, order builder, receipts, PDF preview) MUST block on a sync pass. Screens MUST render immediately from local data. (Constitution P1, UX4.)
- **FR-018**: Pull-to-refresh on the home screen is the only user-facing sync-trigger affordance in this feature. Other business screens MUST NOT expose sync buttons in the MVP.

#### Resilience

- **FR-019**: If the refresh token is rejected during a sync pass, the engine MUST abort the pass, preserve local data, set the indicator to `failed`, and hand off to the authentication flow on the next network-requiring action. (Constitution D5.)
- **FR-020**: Local changes queued for push MUST survive app restarts, OS-suspension mid-pass, and sync failures. (Constitution P5.)

### Key Entities *(include if feature involves data)*

- **Sync pass (ephemeral)**: A single pull-then-push attempt. Carries a start timestamp, a phase (`pull` or `push`), an outcome (`success`, `failed`, `aborted`), and optionally an error summary for logging. Not persisted as a domain entity; transient state sufficient to drive the indicator.
- **Sync cursor (per table)**: The server-side high-water mark the device has already pulled. Used to request only records changed since the last successful pull. One cursor per synced table.
- **Push queue**: The set of locally created/modified records not yet acknowledged by the server. Derived directly from the local database's change-tracking — not a separate entity. Relevant here only to assert it survives restarts (FR-020).
- **Sync status (singleton)**: The current state exposed to the home-screen indicator. Exactly one of `in-sync`, `syncing`, `offline`, `failed`. Derived from the last pass outcome plus live connectivity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a successful login with connectivity, the salesperson sees the full catalog available in the app within 15 seconds, for a catalog of up to 500 products with variants.
- **SC-002**: After an order transitions to `sent` with connectivity present, the order appears in the admin dashboard within 30 seconds, without any explicit action from the salesperson.
- **SC-003**: The sync-status indicator reflects any change in underlying state (pass start, pass end, connectivity change) within 1 second, 95% of the time.
- **SC-004**: No business screen (catalog, clients, order builder, receipts) presents a blocking spinner or full-screen overlay during a sync pass — verifiable by observation across all four indicator states.
- **SC-005**: Zero local-data loss across 100 simulated sync failures (network drop, server error, auth rejection). Every locally queued change that was present before the failure is still present and pushable after recovery.
- **SC-006**: Given two devices editing the same record, 100% of passes converge to the record with the larger `updated_at` — deterministically, regardless of which device synced first.
- **SC-007**: When the device is offline, manual pull-to-refresh completes without error feedback and leaves the indicator in the `offline` state.

## Assumptions

- **Authentication is handled upstream**: The sync engine relies on the access/refresh token flow defined by constitution D5. Token acquisition, biometric/PIN unlock (D6), and re-login prompts are out of scope for this feature; the engine consumes an already-valid session and reports failure if the token is rejected.
- **Server-side authorization is the source of truth for pull scope**: Which clients, orders, and receipts a given salesperson can pull — including "orders from other salespeople" — is defined by the admin in server-side authorization policies. The app does not filter or negotiate scope beyond what the server returns.
- **Image files are not part of this feature's sync**: Product photos and receipt images live in object storage and are loaded on-demand via the local cache defined in constitution R3. This engine synchronizes relational records only.
- **No periodic background sync**: Sync only fires on the three stated triggers. There is no timer-based poll and no OS-level background fetch in the MVP.
- **Deletes are server-authoritative soft deletes**: The admin removes or disables records via the admin dashboard; the server exposes tombstones (or an equivalent "deleted" flag on pull). The device never initiates hard deletes of shared data.
- **Home screen exists or will exist as a host for the indicator**: This spec defines the indicator's behavior and visual states, not the home-screen layout. Integration of the indicator into the home screen is a small placement decision carried out when the home screen is specified/implemented. This feature does not ship a full home-screen design.
- **Clock source for conflict resolution**: `updated_at` on records coming from the server is authoritative. On push, the server stamps `updated_at`; on purely local edits that have not yet synced, the device clock is used and reconciled at push time.
- **Single-pass ordering is strict**: Pull fully completes (or fails) before push begins. There is no interleaving of pull and push phases within a single pass.
- **Catalog and order volumes fit a single pass at MVP scale**: 1–2 salespeople, low hundreds of products, low hundreds of orders. Pagination strategy, if any, is an implementation detail and not a spec concern at this scale.
- **Connectivity detection is best-effort**: The engine uses the platform's connectivity signal to decide between attempting a pass and entering the `offline` state. Transient fluctuations are tolerated — a pass that starts optimistically and loses connectivity mid-flight ends in `failed`.
