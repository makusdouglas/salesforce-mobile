# Feature Specification: Client Management

**Feature Branch**: `007-client-registration`
**Created**: 2026-04-22
**Status**: Draft
**Roles affected**: `seller` (VENDEDOR) — this spec covers the salesperson-side client flows defined in constitution D3. Admin-side client CRUD is deferred to a future feature (015-admin-clients) and is intentionally out of scope here.
**Input**: User description: "Implement client management per constitution D3 and UX1. Salesperson can register a new client locally (store name, CNPJ, address, contact, notes), search the client list quickly (tap-first filters), and open a client profile that shows the order history and a primary CTA 'New order'. Duplicate-CNPJ detection is NOT required in the app — conflicts are merged manually by the admin in the Supabase dashboard. Support offline creation: a brand-new client persists locally and syncs when connectivity returns."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a new client in the field, offline (Priority: P1)

The salesperson walks into a new store, introduces the product, and the owner agrees to hear a quote. Before taking an order, the salesperson needs the store registered as a client. From the home screen or the clients list they tap a clearly labeled "New client" action, fill a short form (store name, CNPJ, address, contact, notes), and save. The save is local and instantaneous — no blocking spinner, no requirement that the device be online. The new client appears at the top of the clients list immediately and is ready to accept a new order. When the device next reaches the internet, the new client is pushed to the remote database silently, without any action from the salesperson.

**Why this priority**: This is the foundational slice of the module. Without the ability to register a client in the field, the salesperson cannot onboard any store they visit for the first time — which is the single most common occurrence in their daily work. Every other story in this spec (profile, order history, search) presupposes that clients exist in the local database, and per constitution D3 the salesperson is the primary entry point for new clients.

**Independent Test**: Put the device in airplane mode, open the app, navigate to the clients list, tap "New client", fill the form with a store name, CNPJ, address, contact, and notes, and save. Confirm (a) the form closes and the new client appears at the top of the list without any error or retry dialog, (b) the client carries a visible "pending sync" indicator, and (c) turning airplane mode off eventually clears the indicator and the row becomes "synced" without any user action.

**Acceptance Scenarios**:

1. **Given** the salesperson is on the clients list and the device is offline, **When** they tap the "New client" action, fill all required fields, and confirm, **Then** the form closes, the new client appears in the list immediately, and no network error is shown.
2. **Given** a client was just created offline, **When** the salesperson views the clients list, **Then** that client row carries a discreet indicator that it is not yet synced (constitution UX4), distinct from synced rows.
3. **Given** a client was created offline and the device then regains connectivity, **When** the next sync pass runs, **Then** the pending-sync indicator on that client row is cleared automatically, with no form re-entry required from the salesperson.
4. **Given** the salesperson opens the "New client" form, **When** they view it on a phone and on a tablet, **Then** the form is legible and usable on both baseline viewports (portrait only) and the primary save action is clearly tappable.
5. **Given** the salesperson starts filling the "New client" form and then backgrounds the app or navigates away by mistake, **When** they return to the form, **Then** any data they had already typed is preserved (draft behavior) so they do not have to retype from scratch.
6. **Given** the salesperson leaves an optional field blank (e.g., notes), **When** they save, **Then** the client is created successfully without the app blocking save or showing a validation error on that field.
7. **Given** the salesperson enters a CNPJ whose format is clearly invalid (wrong digit count), **When** they attempt to save, **Then** the app surfaces an inline, salesperson-language hint on that field and does not silently discard the typed value.
8. **Given** the salesperson enters the same CNPJ that another client in the local database already carries, **When** they save, **Then** the new client is still accepted and persisted (no in-app duplicate block) — constitution D3 defers duplicate resolution to the admin.

---

### User Story 2 - Open a client profile and start a new order (Priority: P1)

From the clients list the salesperson taps a client row and lands on that client's profile. The profile shows the store identity (name, CNPJ, address, contact, notes), the order history for that client (most recent first), and a single, visually dominant call to action labeled "New order". Tapping it takes the salesperson into the order-building flow with the client already selected, so they do not have to re-pick the store.

**Why this priority**: The profile is where "a client" turns into "a client I can sell to today". Without the primary "New order" CTA on the profile, the salesperson would have to re-find the client inside the orders module, which violates UX1 (tap, not type) and adds pointless friction to the most common field action. This is P1 because it is the bridge between client management and the module's reason to exist — enabling orders.

**Independent Test**: With a client in the local database (either registered locally from US1, or pulled from a prior sync, or seeded for the test), open the clients list, tap the client row, and confirm (a) the profile shows the store's fields and its order history, (b) a clearly dominant "New order" button is visible without scrolling on both phone and tablet viewports, and (c) tapping it routes into the order-building flow with the client pre-selected.

**Acceptance Scenarios**:

1. **Given** a client exists in the local database, **When** the salesperson taps that client's row in the list, **Then** the profile screen opens and displays store name, CNPJ, address, contact, notes, and an order-history area.
2. **Given** a client profile is open, **When** the salesperson looks for the next action, **Then** a single primary "New order" call to action is visible above the fold on both phone and tablet baseline viewports and is clearly the screen's dominant action.
3. **Given** a client profile is open, **When** the salesperson taps "New order", **Then** the app navigates into the order-building flow and the client is pre-selected without the salesperson needing to re-pick it.
4. **Given** a client has at least one prior order, **When** the salesperson opens the profile, **Then** the order history lists orders most recent first with, at minimum, a date indicator, the order's status (draft / sent / canceled per constitution D4), and a total.
5. **Given** a client has no prior orders, **When** the salesperson opens the profile, **Then** the order-history area shows a salesperson-language empty state (constitution UX3) that points to the "New order" CTA as the next step — no system jargon, no "empty set" wording.
6. **Given** the device is offline, **When** the salesperson opens a client profile, **Then** the profile and the order history render from the local database with no blocking network wait (constitution P1).
7. **Given** a client was registered locally and has not yet synced, **When** the salesperson opens that client's profile, **Then** the profile is fully usable and the "New order" CTA works — offline registration does not gate the ability to start an order for that client.

---

### User Story 3 - Find a client quickly with tap-first search (Priority: P2)

The salesperson arrives at a store they have visited before. They need to open that client's profile fast, while standing and holding the phone in one hand. They open the clients list and tap a filter affordance — for example, a "Recent" chip, or an initial-letter chip — to narrow the list immediately. If tap filters are not enough (the list is still long, or the client's name starts with a common letter), they fall back to typing a few characters into a search field. The list updates live as they tap or type.

**Why this priority**: Without fast search, larger client rosters (dozens to hundreds of stores per salesperson) become impractical to navigate in the field. But the module is still usable at small scale without it (scrolling a short list is acceptable for the first few weeks of a salesperson's work), so this is P2 — valuable but not a blocker for the MVP.

**Independent Test**: With at least ten clients in the local database across at least two distinct initial letters and one of them flagged as "recently visited" (e.g., registered or ordered in the last seven days), open the clients list and (a) tap a "Recent" chip and confirm only the matching subset remains, (b) clear the chip and confirm the full list returns, (c) type a few characters into the search field and confirm the list filters live, and (d) confirm both mechanisms compose (chip active + text typed = intersection).

**Acceptance Scenarios**:

1. **Given** the clients list has more than a handful of clients, **When** the salesperson taps a filter chip (recency or initial letter), **Then** the list updates immediately to show only matching rows, and a visible indicator confirms the active filter.
2. **Given** a filter chip is active, **When** the salesperson taps the same chip again or a clearly labeled clear control, **Then** the filter is removed and the full clients list returns.
3. **Given** the clients list is visible, **When** the salesperson types characters into the search field, **Then** the list filters in real time by store name (and optionally CNPJ as a secondary match) without requiring a separate "search" button press.
4. **Given** a tap filter and a typed query are both active, **When** the salesperson views the list, **Then** both are applied (intersection) and the result summary reflects that.
5. **Given** the salesperson types a query that matches no client, **When** they view the result, **Then** a salesperson-language "no matches" state appears with a clearly labeled way to reset the query (distinct from the list-is-empty state for a brand-new install).
6. **Given** the salesperson's query contains accents or the client's name does (e.g., "São Paulo Mercadinho"), **When** they search using plain ASCII characters, **Then** the client matches — search is diacritic-insensitive.
7. **Given** the search/filter row renders on a tablet, **When** the salesperson views it, **Then** the wider viewport shows more chips inline without needing horizontal scroll compared to the phone layout.

---

### Edge Cases

- **Offline registration fails mid-flow** (storage full, app crash during save): the partially typed form MUST NOT silently vanish. Either the client is saved completely or the draft form is recoverable; the salesperson MUST NOT lose their input.
- **Two offline devices register the same CNPJ before either syncs**: both rows reach the server as separate clients. The salesperson sees both in their own list until the admin merges them via the Supabase dashboard (constitution D3). The app MUST NOT hide, rename, or silently alter either row pre-merge.
- **Client registered offline, device lost before sync**: the unsynced client is lost — constitution P5 places this risk on the sync engine (feature 005) and on the backup/export capability (out of scope for this spec). This module MUST NOT claim a client is safely stored when it is only local and unsynced; the pending-sync indicator is the honest signal.
- **Very long store name / address / notes**: list rows truncate with ellipsis; the profile shows the full text.
- **CNPJ copy-pasted with formatting characters** (e.g., `12.345.678/0001-99`): the app MUST accept and normalize the input without asking the salesperson to strip punctuation.
- **Order history empty on a client that was just pulled from sync**: the profile renders the "no prior orders" empty state with the same "New order" CTA and no error.
- **Order history contains canceled orders**: canceled orders appear in history with a clear visual distinction (per D4) and are not hidden.
- **Client removed by the admin between syncs while a salesperson has the profile open**: the next sync removes the row locally; the next navigation back to the profile surfaces a salesperson-language "client not available" state rather than a crash.
- **Orientation rotated to landscape on tablet**: landscape is out of scope per constitution UX5; the app is portrait-only in the MVP.

## Requirements *(mandatory)*

### Functional Requirements

**Client registration (US1)**

- **FR-001**: The app MUST expose a "New client" action from the clients list (and, optionally, from the home screen) that opens a registration form.
- **FR-002**: The registration form MUST accept the following fields: store name, CNPJ, address, contact, and notes. The salesperson MUST be able to save the client with a minimal subset (defined in Assumptions) and leave the remaining fields blank.
- **FR-003**: Saving the form MUST persist the new client to the local database synchronously and MUST NOT require network connectivity (constitution P1).
- **FR-004**: After a successful save, the new client MUST appear in the clients list immediately (same session, without a manual reload) and MUST be immediately openable from US2 and selectable by downstream order flows.
- **FR-005**: While a locally created client has not yet been pushed upstream, the clients list MUST render a discreet "pending sync" indicator on that row (constitution UX4). The indicator MUST be distinct from synced rows and MUST NOT require a modal or alert.
- **FR-006**: When connectivity returns and a sync pass succeeds, the pending-sync indicator on previously local clients MUST clear automatically, without any salesperson action beyond normal app use.
- **FR-007**: The app MUST NOT perform any in-app duplicate-CNPJ detection or block save on a duplicate. Saving a CNPJ that already exists locally or upstream is explicitly allowed; conflict resolution is deferred to the admin per constitution D3.
- **FR-008**: The registration form MUST validate the *format* of the CNPJ when provided (digit count / structural shape) and surface an inline, salesperson-language hint on invalid input. Format validation MUST NOT block save when the CNPJ field is left empty (see Assumptions on which fields are required).
- **FR-009**: The registration form MUST accept CNPJ input with or without standard formatting characters (dots, slashes, dashes) and normalize it for storage. The salesperson MUST NOT be asked to strip or re-type punctuation.
- **FR-010**: If the salesperson navigates away from an in-progress form without explicitly canceling, the typed values MUST be preserved as a draft so returning to the form restores what was typed.
- **FR-011**: The form MUST NOT show a blocking full-screen spinner at any point during save (constitution P1).

**Client profile and order CTA (US2)**

- **FR-012**: Tapping a client row in the list MUST open that client's profile screen.
- **FR-013**: The client profile MUST display the full value of each registered field (store name, CNPJ, address, contact, notes), using neutral placeholders for fields that were left blank at registration.
- **FR-014**: The client profile MUST include an order-history area listing that client's orders, sorted most recent first.
- **FR-015**: Each order-history row MUST display, at minimum: the order date, the order status (`draft` / `sent` / `canceled` per constitution D4), and the order total. Canceled orders MUST be visually distinguishable from sent and draft orders.
- **FR-016**: When the order history is empty, the profile MUST render a salesperson-language empty state (constitution UX3) that points to the "New order" call to action as the next step. System or developer jargon ("no records", "empty set", "null", stack traces) MUST NOT appear.
- **FR-017**: The client profile MUST display a single, visually dominant "New order" call to action. Dominance is defined by visual hierarchy (size, color, position above the fold) on both baseline viewports (UX5).
- **FR-018**: Tapping "New order" MUST invoke the order-building flow with the current client pre-selected so the salesperson does not re-pick the store. The order-building flow itself is owned by the orders module (separate feature) — this requirement only concerns the hand-off boundary.
- **FR-019**: The client profile MUST read from the local database only and MUST render fully offline without a blocking network wait (constitution P1), including for clients whose server-side row has not been pulled yet because they were created on the same device.

**Client list search and filter (US3)**

- **FR-020**: The clients list MUST expose tap-first filter controls as the primary narrowing mechanism (constitution UX1). The specific filter dimensions are defined in Assumptions and MUST degrade gracefully when a dimension has too little data (e.g., fewer than two distinct initials) instead of rendering empty chips.
- **FR-021**: The clients list MUST expose a text search field as a secondary, fallback narrowing mechanism.
- **FR-022**: Tap filters and typed search MUST compose (intersection) and the result summary MUST reflect both when active.
- **FR-023**: Text search MUST be diacritic-insensitive so the salesperson does not have to type accents on a mobile keyboard.
- **FR-024**: Text search MUST match against store name AND against CNPJ on a digits-only basis (so typing `12345` matches a stored `12.345.678/0001-99`).
- **FR-025**: When search and/or filter produce zero results, the list area MUST show a "no matches" state distinct from the "no clients registered yet" first-launch state, with a clearly labeled reset control.

**First-launch empty state**

- **FR-026**: When the local database has zero clients and no client has ever been registered on this device, the clients list MUST show a first-launch empty state in salesperson language pointing to the "New client" action as the next step (constitution UX3).
- **FR-027**: The first-launch empty state MUST be visually distinct from the search/filter "no matches" state (FR-025) so the salesperson cannot confuse "the list is empty" with "my filter hid everything".

**Responsiveness (UX5)**

- **FR-028**: Every screen introduced by this module (clients list, registration form, client profile, search/filter state, empty states, "no matches" state) MUST render correctly on the phone baseline viewport (390 × 844 pt portrait) AND the tablet baseline viewport (820 × 1180 pt portrait).
- **FR-029**: The tablet layout MUST use the wider viewport meaningfully (for example, a side-by-side list + detail split on the profile, or more filter chips inline) rather than being a stretched phone layout.
- **FR-030**: Landscape orientation is out of scope per constitution UX5 and MUST NOT be targeted by this module.

**Role visibility (UX6, D7)**

- **FR-031**: All clients-module screens (list, registration form, profile) MUST be visible only to users whose session carries the `seller` role. Users carrying only the `admin` role MUST NOT see these screens as primary navigation. Users carrying both roles see them as part of the VENDEDOR surface (constitution UX6).
- **FR-032**: This module MUST NOT expose any admin-style affordances (bulk import, admin-only edit, CNPJ merge) — those belong to the future admin-clients feature (015) per constitution D3.

**Language (constitution §9)**

- **FR-033**: All user-visible copy introduced by this module MUST be in Portuguese. Internal identifiers (components, hooks, utilities, database columns) MUST be in English.

### Key Entities *(include if feature involves data)*

- **Client**: A store the salesperson sells to. Key attributes referenced by this module: store name, CNPJ (optional, format-validated when provided, not deduplicated in-app), address, contact, notes, created-at timestamp, and a local-only "sync state" that distinguishes "created on this device and not yet pushed" from "synced with remote". A client owns zero or more orders. This module creates and reads clients; it does not delete them (admin responsibility, out of scope here).
- **Order (read-only reference)**: An order owned by a client, listed in the client profile's history area. This module only reads order date, status (per D4), and total for display; the orders module owns the full lifecycle.
- **Salesperson (implicit)**: The signed-in user whose `seller` role unlocks this module (constitution UX6 and D7). Clients this salesperson creates are associated with their account via the existing sync/auth pipeline; this module does not introduce new salesperson-level data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A salesperson can register a new client from an empty form in under 90 seconds on the phone baseline viewport, with only the required fields typed, in a first-time usability test.
- **SC-002**: The "New client" save action persists and returns control to the salesperson in under 300 ms on both baseline viewports, measured offline on a local database containing up to 200 existing clients.
- **SC-003**: A new client created offline appears in the clients list immediately (same interaction frame, no polling, no reload) in 100% of acceptance-test runs.
- **SC-004**: An offline-created client is visible on at least one other salesperson's device after a single successful sync pass on both devices, in at least 95% of sync-engine integration runs (the remaining 5% accounts for genuine network/server failures, not app-local bugs).
- **SC-005**: A salesperson can locate a known existing client in a list of 200 clients in under 10 seconds using only tap filters (no typing) in a usability test — constitution UX1 benchmark.
- **SC-006**: From the clients list, a salesperson can open a specific client's profile and tap "New order" to reach the order-building flow in at most three taps total, on both baseline viewports.
- **SC-007**: Every screen in this module passes visual review on both the phone baseline viewport and the tablet baseline viewport before the module is considered complete — constitution UX5 compliance gate.
- **SC-008**: No business screen in this module renders a blocking full-screen spinner at any point during normal operation, whether online, offline, or mid-sync — constitution P1 compliance check, verifiable by inspection of each screen.
- **SC-009**: The module ships with zero in-app duplicate-CNPJ detection logic and zero admin-style affordances (bulk import, merge, admin-only edit) — constitution D3 and D7 compliance check, verifiable by code review and UI walkthrough.

## Assumptions

- **Required vs optional fields on the "New client" form**: store name is the only required field. CNPJ, address, contact, and notes are all optional but, when present, CNPJ is format-validated (FR-008, FR-009). Rationale: many corner-store owners in the MVP target segment operate without a CNPJ or will not share it until trust is built. Forcing CNPJ as required would block legitimate field registrations and force the salesperson to invent placeholder values — worse for data quality than optional. The admin can fill missing CNPJs later via the Supabase dashboard (D3).
- **Contact shape**: the "contact" field is a single free-text block (typical content: owner name + phone number, sometimes an email). A structured contact sub-form (separate name / phone / email fields) is deferred — the single-field approach matches P3 (simplicity) and keeps registration typing to a minimum (UX1). When the orders module needs phone-number-specific logic (e.g., WhatsApp linking), a structured upgrade can be revisited.
- **Address shape**: the "address" field is a single free-text block in the MVP. Structured CEP lookup + address breakdown (common in Brazilian forms) is deferred — P3 wins here, and the salesperson types far less this way on a phone keyboard. The admin can normalize addresses later via the dashboard if needed for PDF formatting.
- **Tap-filter dimensions for the clients list**: the MVP primary tap dimensions are (1) a "Recent" chip (clients registered or ordered in the last N days — exact N to be tuned in the plan) and (2) an alphabetic initial-letter index or chip row for the first letter of the store name. These two cover the two most common "which client do I need right now" mental queries: "the one I just saw" and "the one starting with S…". If either dimension has fewer than two useful values in the local dataset, the chip row degrades to text search only rather than rendering empty chips.
- **Text search scope**: text search matches against store name (diacritic- and case-insensitive per FR-023) AND against CNPJ on a digits-only substring basis (FR-024). A user who types `12345` matches a stored `12.345.678/0001-99`.
- **Order history source and scope**: the order history on the profile is the list of all orders this client owns that are visible to the signed-in salesperson under the orders module's existing scoping rules (not redefined here). This module reads order rows from the local database only — the sync engine (feature 005) is responsible for populating them.
- **"New order" CTA hand-off**: tapping "New order" routes into the orders module's draft-creation entry point with the current client pre-selected. The exact hand-off API (navigation parameter, shared state, etc.) is a plan-level concern owned by the orders module, not this spec.
- **Pending-sync UI treatment**: "pending sync" is a single discreet per-row indicator (for example, a small dot or label), not a modal, not a banner, not an alert. Existing sync-engine feedback on the home screen (UX4) remains the global sync-status indicator; this module only adds the per-row complement.
- **Offline draft persistence window**: the in-progress "New client" form draft (FR-010) is preserved across app backgrounding within the same session. Long-term draft recovery (across full app restarts, after a crash) is not required in the MVP — the risk scope is "I tabbed away for 20 seconds", not "I lost my phone for a week".
- **No in-app client deletion or edit-after-save in this module**: the MVP salesperson flow is create + read. Edit and delete for existing clients are not required for the field workflow and are deferred to the admin module (future 015). If a store's name changed after registration, the admin updates it via the dashboard. This keeps constitution D3 and R1 clean — the seller-side data layer is append-mostly.
- **Sync infrastructure exists**: the sync engine (feature 005) already runs pull + push per constitution D1 and already emits sync-status signals (UX4). This module hooks into the existing pipeline — it does not re-implement sync, does not define its own conflict-resolution policy, and inherits the engine's last-write-wins semantics (P2) for any future update path.
- **Role enforcement is local UI + server RLS**: per constitution UX6 and D7, hiding the clients module from a pure-admin user is a UI concern. The authoritative authorization remains Supabase RLS on `clients` for any sync push. This spec does not redefine RLS policies — any admin-side CRUD policies belong to 015.
