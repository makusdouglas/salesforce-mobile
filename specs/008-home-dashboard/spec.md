# Feature Specification: Home Dashboard & Empty States

**Feature Branch**: `008-home-dashboard`
**Created**: 2026-04-23
**Status**: Draft
**Roles affected**: `seller` (VENDEDOR)
**Input**: User description: "Design the salesperson's home screen as the hub per constitution UX3 and UX4. Surface the always-on sync-status indicator, quick-action cards to Catalog, Clients, and 'Drafts in progress', plus the most recent activity (last sent order, last sync time). Every empty state (no catalog yet, no clients, no drafts) MUST speak in the salesperson's language and point to the next concrete step, not system errors. No modal or alert for sync — only the inline indicator."

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen`

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| Home / Phone (populated) | [home-phone.png](./design/home-phone.png) | Returning seller lands on a hub: inline sync pill, greeting with last-sync age, three quick-action cards (Catálogo, Clientes, Rascunhos with count badge), last sent order. |
| HomeEmpty / Phone | [home-empty-phone.png](./design/home-empty-phone.png) | First-run seller sees the same frame, but each quick-action card explains what is missing and points to the next concrete step. |
| Home / Tablet (populated) | [home-tablet.png](./design/home-tablet.png) | Same content as phone in a 2-column quick-action grid; recent activity expanded. |
| HomeEmpty / Tablet | [home-empty-tablet.png](./design/home-empty-tablet.png) | 3-column empty-state variant. |

### Design decisions carried into this spec

- Sync status is **inline only** in the top bar. No modal, alert, or toast for sync events.
- The sync pill has three visual states: synced (green, with "há N min"), syncing (amber), and offline (neutral). The pill is always visible on Home.
- Empty states speak in the salesperson's voice and each one offers a concrete next step — except the drafts empty state, which is intentionally inert because drafts are produced as a side-effect of using the catalog.
- Recent Activity shows exactly one item: the last sent order (store, total, relative time). In the empty state it is a dashed-border placeholder.
- Home is a **hub**, not a feed: it never grows into a scrolling activity list.
- Tablet is a layout variant only; copy is identical to the phone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Returning seller navigates from the hub (Priority: P1)

The salesperson opens the app after unlocking it and lands on Home. Within the first glance they can tell whether their data is current (sync pill), what was the last thing they did (recent activity), and tap into the three destinations they use every day (Catálogo, Clientes, Rascunhos).

**Why this priority**: Home is the hub per constitution §5 UX3 — if this flow doesn't work, every seller session starts in friction.

**Independent Test**: With a seeded catalog, at least one client, and one previously sent order, launch the app from a locked state; verify the Home screen renders the three cards, the recent activity row, and a green "Sincronizado · há N min" pill without any modal/toast appearing.

**Acceptance Scenarios**:

1. **Given** the seller is signed in and the app has a successful recent sync, **When** they unlock the app, **Then** Home is the first screen rendered and the sync pill reads "Sincronizado" with the last-sync age in minutes/hours.
2. **Given** the seller is on Home, **When** they tap the Catálogo card, **Then** they are taken to the catalog screen in a single tap.
3. **Given** the seller has 2 drafts in progress, **When** Home renders, **Then** the Rascunhos card shows a count badge of "2" and its subtitle reads "2 pedidos em andamento".
4. **Given** the seller has sent at least one order, **When** Home renders, **Then** the Atividade recente row shows the last sent order's store name, total, and relative time.

---

### User Story 2 - First-run seller is guided to the next step (Priority: P1)

A newly onboarded seller opens the app for the first time with no catalog synced, no clients registered, and no drafts. Every card tells them, in their own words, what's missing and what to tap next — never a technical error, never "No data available".

**Why this priority**: Constitution §5 UX4 — empty states are a pedagogical surface, not a failure surface. Without this, first-run sellers are stuck guessing.

**Independent Test**: Fresh install, seeded account with an empty catalog and no clients; open the app; verify each of the three cards carries salesperson-language copy and that Catálogo and Clientes offer CTAs ("Sincronizar agora" / "Nova loja"), while Drafts explains the next step without a CTA.

**Acceptance Scenarios**:

1. **Given** no products have been synced yet, **When** Home renders, **Then** the Catálogo card reads "Seu catálogo ainda está vazio" with a primary CTA "Sincronizar agora".
2. **Given** no clients exist, **When** Home renders, **Then** the Clientes card reads "Cadastre sua primeira loja" with a secondary CTA "Nova loja" that opens the client registration flow.
3. **Given** no drafts exist, **When** Home renders, **Then** the Rascunhos card reads "Nenhum rascunho por enquanto" and explains that drafts appear after starting a pedido in the catalog (no button).
4. **Given** no orders have been sent, **When** Home renders, **Then** the Atividade recente slot reads "Seu último pedido enviado aparecerá aqui" in a dashed placeholder.
5. **Given** any empty state, **When** the seller reads the card, **Then** the text is in Portuguese salesperson voice and never contains words like "erro", "falha", "null", or "sem dados".

---

### User Story 3 - Seller checks sync status without interruption (Priority: P1)

During a field visit, the seller glances at Home between actions to confirm the app is still up to date, or to see that a sync is in flight. The sync indicator never blocks the screen, never shows a spinner modal, and never pops a toast. It sits inline in the top bar and changes state silently.

**Why this priority**: Constitution §2 P1 (offline-first, no blocking spinner) and UX3 (home is the hub). A violation here breaks the offline-first promise.

**Independent Test**: While online, observe Home during a sync cycle; verify the pill transitions synced → syncing → synced with no modal, alert, or toast. Then toggle airplane mode and verify the pill shows an offline state without any dialog.

**Acceptance Scenarios**:

1. **Given** the seller is on Home and a sync begins, **When** the sync is in progress, **Then** the pill changes to the amber "Sincronizando…" state and no modal/toast appears.
2. **Given** the sync completes, **When** the success is observed, **Then** the pill returns to green "Sincronizado" and the "há N min" timestamp resets.
3. **Given** the device loses connectivity, **When** Home is visible, **Then** the pill switches to an offline state ("Sem conexão") without blocking interaction.
4. **Given** a sync fails, **When** Home is visible, **Then** the pill surfaces the failure inline (e.g. "Falha ao sincronizar — tocar para tentar"), still without a modal.

---

### User Story 4 - Seller resumes a draft from Home (Priority: P2)

The seller left one or more pedidos half-built on a previous visit. From Home they can see the count on the Rascunhos card and jump straight into the drafts list.

**Why this priority**: Drafts are constitution §2 P5 "sacred" data. Making them one tap from Home reduces the risk that the seller forgets a draft exists.

**Independent Test**: With 2 saved drafts, open Home; tap Rascunhos; verify the drafts list opens and the count badge matches.

**Acceptance Scenarios**:

1. **Given** the seller has drafts saved locally, **When** Home renders, **Then** the Rascunhos card displays an accurate integer count badge.
2. **Given** the seller taps the Rascunhos card, **When** the tap is registered, **Then** they are routed to the drafts list in a single transition.

---

### Edge Cases

- **Very old sync**: when the last sync is more than 24 hours ago, the pill still reads "Sincronizado" but the age reads "há N h" or "há N d" instead of minutes; it MUST NOT flip to an error state just because of age.
- **Exactly 0 drafts**: the Rascunhos count badge is hidden (not rendered as "0").
- **Very long store name in Atividade recente**: the store name truncates with ellipsis; the total and timestamp stay visible.
- **Sync pill visible during scroll**: Home is short enough that it does not scroll on phone; if future content pushes it past the viewport, the top bar (and pill) MUST remain anchored.
- **Device rotated to landscape**: out of scope — portrait-only per constitution §5 UX5 scoping decisions.
- **Tablet layout**: when the phone layout's three cards become a 2-column grid on tablet, the drafts card remains on the second row; the empty cell is a neutral spacer, not an interactive card.
- **First-run while syncing**: Home shows the empty-state copy with the amber "Sincronizando…" pill simultaneously — copy and pill are independent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Home MUST be the first screen the seller sees after unlocking the app while signed in.
- **FR-002**: Home MUST render an always-visible inline sync indicator (the "sync pill") at the top of the screen.
- **FR-003**: The sync pill MUST support at least four states — synced, syncing, offline, sync-failed — each distinguishable by color and label without needing to tap.
- **FR-004**: The synced state MUST include a relative timestamp of the last successful sync (e.g. "há 2 min", "há 3 h", "há 1 d").
- **FR-005**: The system MUST NOT display any modal, alert, toast, or full-screen spinner for sync events. Sync state changes MUST happen only through the inline pill.
- **FR-006**: Home MUST display exactly three quick-action cards in a fixed order: Catálogo, Clientes, Rascunhos.
- **FR-007**: Each quick-action card MUST be a single tap target that navigates to its destination screen.
- **FR-008**: The Catálogo card MUST show, in the populated state, the current count of products available locally (e.g. "324 produtos disponíveis").
- **FR-009**: The Clientes card MUST show, in the populated state, the current count of registered stores (e.g. "48 lojas cadastradas").
- **FR-010**: The Rascunhos card MUST show, in the populated state, the current count of drafts in progress and a count badge with the same integer; when the count is zero, the badge MUST be hidden.
- **FR-011**: Home MUST display an "Atividade recente" slot that surfaces the single most recent sent order, including store name, total amount, and relative time since send.
- **FR-012**: When the catalog is empty, the Catálogo card MUST display salesperson-language copy explaining the next step and a primary CTA that triggers a sync ("Sincronizar agora").
- **FR-013**: When no clients exist, the Clientes card MUST display salesperson-language copy and a secondary CTA that opens the client registration flow ("Nova loja").
- **FR-014**: When no drafts exist, the Rascunhos card MUST display salesperson-language copy explaining how drafts are created, and MUST NOT display a CTA button.
- **FR-015**: When no orders have been sent, the Atividade recente slot MUST show a salesperson-language placeholder indicating where the last sent order will appear.
- **FR-016**: Empty-state copy MUST NOT contain the words "erro", "falha", "null", "undefined", "sem dados", or any technical error language.
- **FR-017**: Home MUST render on both phone (390×844 reference) and tablet (820×1180 reference) viewports, with the tablet laying quick actions out in a two-column grid and keeping identical copy.
- **FR-018**: The sync indicator state and the empty-state copy MUST be independent: a sync in progress does not hide or replace empty-state cards.
- **FR-019**: Counters on the three quick-action cards (products, clients, drafts) MUST update without requiring the seller to leave and re-enter Home.
- **FR-020**: Home MUST NOT scroll under normal conditions on the reference phone viewport; all cards and the recent-activity slot fit within one screen.

### Key Entities

- **Sync Status**: Last successful sync timestamp, current sync state (idle/in-progress/offline/failed), surfaced entirely through the inline pill.
- **Catalog Summary**: Count of products currently available on the device.
- **Client Summary**: Count of clients (stores) registered on the device.
- **Draft Summary**: Count of drafts in progress on the device.
- **Last Sent Order**: Reference to the most recently sent order, reduced to store name, total amount, and send timestamp for display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A returning seller can reach Catálogo, Clientes, or Rascunhos from Home in a single tap (one interaction, no intermediate screen).
- **SC-002**: A first-run seller (empty catalog, no clients, no drafts) can identify at least one concrete next step within 10 seconds of landing on Home, without asking for help, in usability testing with 5 sellers.
- **SC-003**: Across a full sync cycle (synced → syncing → synced, or synced → offline → synced), zero modals, toasts, or full-screen spinners appear on Home.
- **SC-004**: Whenever the sync pill is in its synced state, the last-sync age is visible to the seller without any interaction (never hidden behind a tap, a hover, or a toggle). When no successful sync has happened yet in the current session, the pill reads "Sincronizando…" instead — this is the only condition under which the age is absent.
- **SC-005**: Empty-state review: 100% of empty-state copy strings pass a linguistic review confirming they use salesperson voice and contain no error/system vocabulary (see FR-016 blocklist).
- **SC-006**: When the number of products, clients, or drafts changes on the device, the corresponding Home counter reflects the new value within 2 seconds without the seller leaving Home.
- **SC-007**: On the reference phone viewport, Home renders without vertical scrolling in every combination of populated/empty states.

## Assumptions

- The app already knows which user is signed in and their role is VENDEDOR; ADMIN has a separate home (out of scope here).
- The offline sync state ("Sem conexão") is a required fourth state of the pill; it was not named in the original description but is a direct consequence of constitution §2 P1 (offline-first).
- The empty Rascunhos card is **inert** (no CTA). Drafts are produced as a side-effect of starting a pedido in the catalog, so a "Novo rascunho" button would create a dangling empty draft and misrepresent how the data model works.
- "Atividade recente" shows **exactly one** item — the last sent order — and is not expected to grow into a multi-item feed. If that need appears later, it becomes a separate feature, not a reinterpretation of this one.
- The relative-time vocabulary on the pill and the activity row uses Portuguese short forms ("há N min", "há N h", "há N d") without localization variants.
- The greeting line ("Olá, <name>") uses the signed-in user's first name; falls back to "Olá" if no name is available.
- Tapping the sync pill is not a required interaction in this spec. A future feature may make it trigger a manual re-sync; for v1 it is informational only, except when in the failed state, where tapping retries.
- Catalog sync, client registration, draft creation, and order sending are existing capabilities owned by prior features (006, 007, 005); this spec only consumes their state to build the hub.
- The palette and component language follow the existing neutral/zinc system already shipped in `layout.pen` for other seller screens (ClientList, Login, Lock). The `pencil-config.yml` style guide ("Lavender Cream / Fluid Ribbon Gradients") is aspirational and has not been adopted anywhere else in the seller app yet; adopting it is tracked separately, not in this feature.
