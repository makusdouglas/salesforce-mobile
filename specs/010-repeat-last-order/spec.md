# Feature Specification: Repeat Past Order

**Feature Branch**: `010-repeat-last-order`
**Created**: 2026-04-23
**Status**: Draft
**Roles affected**: `seller` — this flow lives inside the mobile salesperson surface (constitution §5 UX6). Admin-only users never see it.
**Input**: User description: "Implement 'repeat last order' as a first-class flow per constitution UX2. From a client's order history, a single tap creates a new draft cloning the last order's line items, quantities, and discounts; the salesperson lands directly on the order summary and can either send immediately or tap to edit items before sending. Maximum 2 taps from client profile to 'ready to send'. This flow MUST NOT be hidden inside a menu — it is a primary CTA on the client profile when history exists. Extension during design: the salesperson must be able to repeat *any* past order, not only the most recent one."

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen`

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| ClientProfile / Phone | [client-profile-phone.png](./design/client-profile-phone.png) | Dark primary "Repetir último pedido" hero above history; each history row has a circular ↺ icon button to repeat that specific order. |
| ClientProfile / Tablet | [client-profile-tablet.png](./design/client-profile-tablet.png) | Same model on tablet — hero card at top of the history column, per-row ↺ button on every order. |
| OrderSummary / Phone | [order-summary-phone.png](./design/order-summary-phone.png) | Existing screen reused; both repeat paths land here with the cloned draft ready to send or edit. |
| OrderSummary / Tablet | [order-summary-tablet.png](./design/order-summary-tablet.png) | Existing screen reused; same landing behavior on tablet. |

### Design decisions carried into this spec

- **Two coexisting entry points, both primary, both ≤2 taps to a sendable draft:**
  1. Hero "Repetir último pedido" card — 1-tap shortcut for the most recent sent order.
  2. Per-row ↺ icon on every history card — allows repeating *any* past order (scope expansion confirmed during design).
- **Tapping the card body opens the order for viewing; only the ↺ icon triggers cloning.** This separation preserves the ability to inspect old orders without accidentally repeating them.
- **"Novo pedido em branco" stays one tap away** but is styled as a secondary outline button so the repeat paths visually dominate when history exists.
- **No intermediate confirmation screen.** Both repeat paths route straight to the existing OrderSummary with the cloned draft already persisted locally.
- **When history is empty,** the existing `ClientProfileEmpty` screen is shown (no hero, no ↺). Repeat is never offered in a disabled state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Repeat most recent order in one tap (Priority: P1)

The salesperson opens a returning client's profile, sees the dark "Repetir último pedido" card with the last order's date, item count, and total, taps it once, lands directly on the order summary with every line cloned, and taps "Enviar" to send.

**Why this priority**: This is the repeat flow the constitution mandates as a first-class citizen (UX2). It covers the most common case (customers reorder the same thing) and delivers the full "2 taps to ready-to-send" promise. Shipping this alone already satisfies the original constitution requirement.

**Independent Test**: With a client that has at least one past sent order, open the client profile, tap the hero card, verify the summary shows the same lines/quantities/discounts as the source order, and confirm "Enviar" completes the send flow. Count taps from profile to sent: must be ≤2.

**Acceptance Scenarios**:

1. **Given** a client whose most recent sent order has 8 lines and a 5% order discount, **When** the salesperson taps the hero "Repetir último pedido" card, **Then** a new draft is created with the same 8 lines, same quantities, the same 5% order discount, and the salesperson lands on the order summary without any intermediate screen.
2. **Given** the cloned draft is open on the summary, **When** the salesperson taps "Enviar", **Then** the new order is sent and counts as a separate order (the original sent order is untouched).
3. **Given** a client has history but no *sent* order (only drafts or cancelled), **When** the salesperson opens the profile, **Then** the hero card is not shown; per-row ↺ remains available.

---

### User Story 2 - Repeat a specific older order (Priority: P1)

The salesperson needs to reorder what this client bought three orders ago (a seasonal pattern, a customer preference, etc.). They scroll the history, tap the ↺ icon on that specific card, and land on the summary with that older order cloned.

**Why this priority**: This is P1 because the user corrected scope during design: "quero poder repetir qualquer pedido do cliente, não apenas o último". Without this story, the feature fails the user's stated need even though the constitution's minimum (UX2) is met.

**Independent Test**: On a client with 4+ past orders, tap the ↺ icon on a specific non-latest order and confirm the summary is cloned from *that* order, not the most recent one.

**Acceptance Scenarios**:

1. **Given** a client with 4 sent orders (most recent = 15 apr), **When** the salesperson taps the ↺ button on the 18 mar order, **Then** the new draft is cloned from the 18 mar order (not from 15 apr).
2. **Given** a history row is tapped on the card body (not the ↺), **When** the tap lands, **Then** the salesperson navigates to view that past order, with no draft created.
3. **Given** a cancelled order in history, **When** the salesperson taps its ↺, **Then** the draft is still cloned from its lines (cancellation status does not propagate).

---

### User Story 3 - Adjust items before sending (Priority: P2)

After landing on the summary from either repeat path, the salesperson realises quantities need tweaking (customer asked for an extra crate of X) and taps into the draft to edit, then returns to the summary and sends.

**Why this priority**: P2 because it reuses the existing feature-009 editing path; it is table stakes for trust in the repeat flow but adds no new interaction — only verifies that the cloned draft behaves like any other draft.

**Independent Test**: From a repeat-landed summary, tap an item row, modify a quantity in the draft, return to the summary, and confirm the summary reflects the change before sending.

**Acceptance Scenarios**:

1. **Given** the salesperson landed on the summary via repeat, **When** they tap a line item, **Then** they enter the existing draft editor and can change quantity/line discount exactly as with any draft.
2. **Given** edits are saved, **When** the salesperson returns to the summary, **Then** the totals and line count reflect the edits and "Enviar" dispatches the edited draft.

---

### User Story 4 - Handle products no longer available (Priority: P2)

The past order contains a product that has been deactivated in the catalog since. The repeat must still produce a usable draft and make the drop visible so the salesperson can add a replacement before sending.

**Why this priority**: P2 because it's a correctness concern that would erode trust if silent, but the basic "repeat the available items" flow is still useful if a small number of items are dropped.

**Independent Test**: Deactivate one product referenced by a past order, trigger repeat on that order, confirm the dropped product is flagged on the summary and the remaining lines are intact.

**Acceptance Scenarios**:

1. **Given** a past order with 5 lines and one product since deactivated, **When** the salesperson triggers repeat, **Then** the draft contains 4 lines (the available ones) and the summary shows a non-dismissable notice naming the dropped product(s).
2. **Given** every product in the past order has been deactivated, **When** the salesperson triggers repeat, **Then** the action is blocked with a message explaining that no items remain, and no empty draft is created.

---

### Edge Cases

- **Offline**: cloning and draft creation happen fully locally against the cached order data; sending follows the same sync rules as any order (constitution §4). Repeat never requires a network round-trip to produce the draft.
- **Re-tapping the ↺ repeatedly**: each tap creates a new draft. The app does not dedupe — the salesperson may legitimately want two parallel drafts for the same source order (e.g., splitting one delivery into two).
- **Repeat of a Draft (↺ on a row whose status is Draft)**: opens that existing draft on the summary (resume) rather than cloning, to avoid draft multiplication.
- **Price changes since the past order**: the draft uses *current catalog prices*, not the prices captured at the historical order. Line and order discounts from the past order are applied on top of the current price.
- **Client profile from a deep link** (opened without going through the client list): the hero and ↺ remain functional; taps still count from the profile landing.
- **Very old orders** (> 12 months): same flow; no archival cut-off in MVP.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The client profile MUST display a primary "Repetir último pedido" call-to-action above the order history whenever the client has at least one sent order. The CTA MUST surface the source order's date, item count, and total so the salesperson knows what they are about to clone.
- **FR-002**: Every row in the order history MUST expose a repeat affordance (circular ↺ icon) that triggers cloning of *that specific order*. The affordance MUST be visible without opening a menu or long-press (constitution §5 UX2).
- **FR-003**: Tapping the hero CTA or a row ↺ MUST create a new local draft cloned from the source order and navigate directly to the OrderSummary screen. No intermediate confirmation screen is inserted.
- **FR-004**: The cloned draft MUST copy every line from the source order: product reference, quantity, and per-line manual discount.
- **FR-005**: The cloned draft MUST copy the order-level manual discount from the source order.
- **FR-006**: Line prices in the cloned draft MUST be resolved from the *current* catalog at the moment of cloning, not from the source order. Discounts (line and order) are applied on top of the resolved current price.
- **FR-007**: If a product referenced by the source order is no longer available (deactivated or deleted from the catalog), the system MUST exclude that line from the cloned draft and MUST display a visible, non-dismissable notice on the resulting OrderSummary listing the dropped product(s).
- **FR-008**: If *every* product referenced by the source order is unavailable, the system MUST NOT create a draft. It MUST instead present the inline blocking message `"Este pedido não pode ser repetido — nenhum dos itens está disponível."` (non-modal, dismissable) in place of the triggered affordance, and leave the salesperson on the client profile.
- **FR-009**: The cloned draft MUST be a new, independent order in local storage. The source order MUST NOT be mutated by the repeat operation.
- **FR-010**: Tapping the body of a history row (anywhere outside the ↺ icon) MUST open the existing view of that past order and MUST NOT trigger cloning.
- **FR-011**: If the source order status is `Draft`, the ↺ action MUST open that draft (resume) instead of cloning it, to prevent draft multiplication.
- **FR-012**: The number of taps from the client profile (already loaded) to a sendable draft MUST be ≤ 2 for both repeat paths: tap 1 = hero or ↺; tap 2 = "Enviar" on the summary.
- **FR-013**: Both phone and tablet viewports MUST render the hero CTA and the per-row ↺ (constitution §5 UX5), matching the design screenshots linked above.
- **FR-014**: The existing blank-order button MUST remain reachable from the client profile in one tap. Its label is updated to `"Novo pedido em branco"` and its visual weight is demoted to a secondary outline style (white fill, zinc-300 border) so the repeat affordances dominate visually. Navigation target is unchanged from feature 009.
- **FR-015**: When the client has no order history, the system MUST fall back to the existing `ClientProfileEmpty` layout. Neither the hero CTA nor any ↺ button is rendered; the repeat feature is effectively invisible for first-time clients.
- **FR-016**: The repeat operation MUST function with no network connectivity. The clone path MUST NOT import `fetch`, the Supabase client, or any other network module — verified by a static scan. Sending the resulting draft follows the existing sync rules (constitution §4) and is out of scope for this feature.

### Key Entities *(include if feature involves data)*

- **Order**: an existing entity from feature 009. Repeat reads: `id`, `client_id`, `status`, `lines[]`, `order_discount`, `sent_at` (to rank "most recent sent"). Repeat writes a *new* Order with `status = Draft` and a fresh `id`.
- **OrderLine**: existing entity. Cloned attributes: `product_id`, `quantity`, `line_discount`. Price is *not* cloned — it is resolved from the current catalog.
- **Product**: existing catalog entity. Lookup key at clone time; the product's `active`/`deleted` flag decides whether a line is carried over (FR-007).
- **Client**: existing entity. The repeat entry points are scoped to a specific client's profile; drafts carry the same `client_id` as the source order.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a returning client with at least one sent order, the salesperson can go from "client profile loaded" to "order sent" in ≤ 2 taps when no edits are needed — verified by a manual count on both phone and tablet builds.
- **SC-002**: For a client with 4+ past orders, the salesperson can produce a draft cloned from any chosen past order in exactly 1 tap from the profile — no scroll-and-tap menu, no long-press.
- **SC-003**: In a test client with 10 orders and three deactivated products spread across them, triggering repeat on each order produces drafts where every line corresponds to an active product and every dropped line is visibly called out on the summary (100% match, 0 silent drops).
- **SC-004**: Median time from "open client profile" to "send repeated order" drops below 10 seconds under normal connectivity — measured with a stopwatch during the quickstart §7 manual QA pass on both phone and tablet simulators, across at least 5 repeat attempts per viewport.
- **SC-005**: Zero drafts are created when the source order's products are all unavailable — verified by inspecting local storage after running the "all-unavailable" scenario.
- **SC-006**: Zero mutations to source orders are observed after repeat operations — verified by diffing the source Order row before and after the repeat in a QA harness.

## Assumptions

- **Last-order ranking**: the hero card targets the client's *most recent Sent order* (not Draft, not Cancelled). If the most recent row is a Draft or Cancelled, the hero is hidden and the salesperson uses the per-row ↺.
- **Pricing policy**: current catalog prices are authoritative. Cloning an older order never "freezes" a past price — this matches how feature 009 already handles draft creation and keeps the accounting picture consistent with the live catalog.
- **Discount policy**: in MVP all discounts are manual (line-level and order-level); there are no promotional / time-bounded discounts to filter. Therefore cloning *all* discounts verbatim is safe.
- **Draft duplication**: every ↺ tap on a non-Draft source creates a new draft, even if a prior draft already exists for the same client. The salesperson decides consolidation policy manually.
- **Offline-first**: the whole repeat flow (discover → clone → land on summary) runs against local cached data. The feature adds no new online dependency.
- **Tap accounting**: "client profile already loaded" is the starting point for the 2-tap budget, per constitution UX2. Taps to navigate *to* the client profile are not counted.
- **Role boundary**: this feature is visible only when the seller surface is active (constitution §5 UX6). Admin-only users never see the client profile and therefore never see the hero or ↺.
- **OrderSummary reuse**: the landing screen is the existing OrderSummary from feature 009; no new screen is introduced. "Sendability" inherits whatever the summary already considers valid (e.g., non-empty draft).
