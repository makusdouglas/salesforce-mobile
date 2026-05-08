# Feature Specification: Order Assembly

**Feature Branch**: `009-order-assembly`
**Created**: 2026-04-23
**Status**: Draft
**Roles affected**: `seller`
**Input**: User description: "Implement order assembly per constitution R5, UX1, and D4. From a client profile, the salesperson starts a draft order, browses the catalog, taps products/variants to add with quantity inc/dec controls (no numeric keyboard for the primary path), applies an optional per-line discount (% or absolute), and an optional overall-order discount at the summary step. Discounts MUST be stored on order_item and order — NEVER mutate product prices. Draft orders persist locally across app restarts and appear in the home \"Drafts in progress\" list. Status transitions use only: draft, sent, canceled."

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen`

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| OrderDraft / Phone | [order-draft-phone.png](./design/order-draft-phone.png) | Cart-style draft: item cards with +/- qty steppers, line-level discount chip, footer with running total and "Continuar". |
| AddToOrder / Phone | [add-to-order-phone.png](./design/add-to-order-phone.png) | Product sheet reached from catalog: variant chips, qty stepper, optional per-line discount (`%` or `R$`), live line-total preview. |
| OrderSummary / Phone | [order-summary-phone.png](./design/order-summary-phone.png) | Review step: client header, collapsed item list, optional order-level discount, totals breakdown, "Salvar rascunho" + "Enviar pedido". |
| OrderDraft / Tablet | [order-draft-tablet.png](./design/order-draft-tablet.png) | Two-column layout: items (left) + sticky summary sidebar with "Continuar" (right). |
| AddToOrder / Tablet | [add-to-order-tablet.png](./design/add-to-order-tablet.png) | Two-column: product hero + variants (left) + stepper, line discount, preview, CTA (right). |
| OrderSummary / Tablet | [order-summary-tablet.png](./design/order-summary-tablet.png) | Two-column: client + items + order discount (left) + totals + send/save + status note (right). |

### Design decisions carried into this spec

- **+/- steppers are the primary path; numeric keyboard is a supported secondary path (UX1).** Tapping the quantity number opens the keyboard. Discount field allows direct typing only in `R$` mode; `%` mode stays stepper-only to prevent out-of-range entries.
- **Product unit price is immutable in every display.** Every screen shows catalog prices unchanged; discounts render as green chips/rows and never overwrite the product record (R5).
- **Draft status is surfaced continuously.** A yellow "Rascunho" chip is present on OrderDraft; OrderDraft topbar shows "Salvo agora" / "salvo localmente" to reinforce D4 persistence.
- **Entry from the client profile is reused.** `ClientProfile / Phone` and `ClientProfile / Tablet` already reserve a `bottomAction` region where the "Novo pedido" CTA docks. No new client-profile frame is introduced.
- **"Drafts in progress" already exists on home (008).** This feature feeds that list; it does not redesign home.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Assemble & persist a draft order from a client profile (Priority: P1)

The salesperson opens a registered client's profile in the field, taps "Novo pedido", browses the catalog, taps products and variants to add them to the order, adjusts quantities with +/- steppers, and reviews the running total. When they leave the screen, lose connectivity, or the app is killed and restarted, the draft is still there — listed in the home "Drafts in progress" section — and can be reopened at the exact same state.

**Why this priority**: This is the core field flow. Without it, the constitution's product identity ("assemble intent orders") is not delivered. Losing a draft violates P5 ("salesperson data is sacred"). Every later feature (send-as-PDF, email dispatch, payment receipts) depends on a draft existing.

**Independent Test**: From a seeded client profile, start a new order, add 3 distinct items with varying quantities, close the app, restart it, open the home screen, confirm the draft appears in "Drafts in progress" with the same line items and quantities, reopen it, verify the running total matches, and confirm product catalog prices are unchanged.

**Acceptance Scenarios**:

1. **Given** a registered client with no prior orders, **When** the salesperson taps "Novo pedido" on the client profile, **Then** a new draft is created, associated with that client, and the order-assembly flow opens with 0 items.
2. **Given** a draft is open with 2 items, **When** the salesperson taps `+` on a third product in the catalog, **Then** the product's default (or selected) variant is added with quantity 1 and the running subtotal updates immediately.
3. **Given** a draft has 3 items, **When** the app is force-closed and reopened, **Then** the draft is listed under "Drafts in progress" on home with the same client, same items, same quantities, and the same timestamp it was last saved at.
4. **Given** a draft line with quantity 3, **When** the salesperson taps `−` twice, **Then** quantity becomes 1; tapping `−` again removes the line (or prompts for removal, per edge case).
5. **Given** the salesperson is editing a draft offline, **When** they adjust qty or add/remove items, **Then** every mutation is persisted to the local database before the UI acknowledges it (no operation depends on connectivity).

---

### User Story 2 — Apply line and order-level discounts without mutating the catalog (Priority: P2)

On any draft line, the salesperson can open a discount input and set either a percentage (`%`) or an absolute amount (`R$`). At the summary step, they can additionally apply an order-level discount (percentage or absolute). Both discounts are stored on the draft itself (line and order rows), are visually summarized in totals, and never modify the product catalog.

**Why this priority**: This is the commercial lever that makes intent orders useful. Without discounts, the salesperson has no tool to close a deal in-store. Without R5's storage discipline, catalog integrity leaks and sync becomes unsafe (drift between seller devices).

**Independent Test**: On a draft with 1 item (unit price R$ 10,00, qty 2), apply a 10% line discount — verify line total becomes R$ 18,00 while the product record's `price` field in the database stays R$ 10,00. At summary, apply an additional R$ 2 order-level discount — verify final total becomes R$ 16,00 and that `products.price` is still unchanged.

**Acceptance Scenarios**:

1. **Given** a draft line for a product priced R$ 39,00 at qty 1, **When** the salesperson sets a 10% line discount, **Then** the line displays the discount chip, the line total shows R$ 35,10, and `products.price` remains R$ 39,00.
2. **Given** the salesperson is applying a line discount, **When** they switch to `%` mode, **Then** the value control is a stepper only (no keyboard); **When** they switch to `R$` mode, **Then** the value control accepts both stepper taps and direct keyboard entry.
3. **Given** a draft with mixed lines (some with line discounts, some without), **When** the salesperson sets an R$ 5 order-level discount at the summary step, **Then** the summary shows "Subtotal", "Descontos por item", "Desconto do pedido", and "Total" as distinct rows, and the order-level discount applies to the post-line-discount subtotal.
4. **Given** the salesperson removes a line that had a discount, **When** they navigate back to the summary, **Then** both the line and its discount disappear from totals and no orphaned discount record persists.
5. **Given** an order-level discount is set, **When** the salesperson changes a line's quantity, **Then** the order-level discount remains but the totals recompute deterministically.

---

### User Story 3 — Send the order or cancel it using the only allowed statuses (Priority: P3)

From the summary step, the salesperson either confirms and sends the order (triggering the existing PDF/email handoff), which transitions the draft to `sent`, or cancels it, which transitions it to `canceled`. A canceled or sent order no longer appears under "Drafts in progress". Only the three states defined in D4 are ever reachable: `draft`, `sent`, `canceled`.

**Why this priority**: P3 because the MVP can demonstrate value with just P1+P2 (local drafts) — send and cancel are closure mechanics that gate the home list from growing forever but are not required for the core "assemble an intent order" value. Still mandatory before ship: without them, P5 risks (drafts piling up indefinitely) and D4 compliance both fail.

**Independent Test**: From a valid draft, tap "Enviar pedido" and confirm the status transitions to `sent` and the draft is removed from home "Drafts in progress". From another draft, cancel it and confirm the status transitions to `canceled` and it is likewise removed from "Drafts in progress". Inspect the database and confirm no state other than `{draft, sent, canceled}` ever appears in the `orders.status` column.

**Acceptance Scenarios**:

1. **Given** a draft with at least 1 line, **When** the salesperson taps "Enviar pedido", **Then** the draft's status becomes `sent`, the home "Drafts in progress" list no longer shows it, and the order is made available to the downstream PDF/email flow.
2. **Given** a draft, **When** the salesperson cancels it (affordance per edge case), **Then** the status becomes `canceled` and the draft disappears from "Drafts in progress".
3. **Given** any order in the system, **When** its `status` is queried, **Then** the value is one of `draft`, `sent`, `canceled` — no other value is writable.
4. **Given** a `sent` or `canceled` order, **When** the salesperson tries to edit items, qty, or discounts, **Then** the app does not allow the mutation (the order is frozen post-transition).

---

### Edge Cases

- **Empty draft.** An auto-created draft with 0 items must not be sent. The "Enviar pedido" CTA must be disabled until at least 1 line exists.
- **Discount larger than line or order total.** The total never goes below R$ 0,00. Entering a discount above 100 % (`%` mode) or above the line/order subtotal (`R$` mode) is clamped and surfaced with a quiet inline warning — not blocked outright, not shown as a modal (UX4 spirit).
- **Stacking line + order discounts.** Order-level discount applies to the subtotal after per-line discounts. Both rows remain visible in totals so the salesperson understands where the money came off.
- **Multiple drafts for the same client.** Allowed. Each draft is a separate row; the home list shows them as distinct entries with their last-saved timestamp.
- **Variant not selected.** If a product has multiple variants and none is the default, adding it from the catalog opens AddToOrder with the variant selector pre-focused; no line is created until a variant is chosen.
- **Removing the last item.** A draft with 0 items is allowed but flagged visually as empty; the salesperson can still close the screen and the draft persists. Empty drafts do not block the home list (UX3).
- **Canceling a draft.** The cancel affordance lives on OrderDraft (not on the catalog/add screen) to prevent accidental loss. Confirmation is required — a soft confirmation row inline is acceptable (no modal, per UX4 style).
- **Connectivity lost mid-assembly.** No behavior change — the draft is a local entity (P1/P2) and all mutations are already local.
- **Clock skew.** `updated_at` uses the device local clock. If the device clock changes, last-write-wins sync remains eventual-consistent (D1 scope; not new to this feature).
- **Referenced product/variant deleted upstream.** If a `product_variant` referenced by a draft line is deleted upstream between add-time and the next sync, the line keeps its captured `unit_price` snapshot and its rendered name. The draft remains valid and can be sent — the order is a historical intent, not a live query against the catalog. No UI warning is required; deletion of catalog rows while a draft references them is an admin-side concern, not a salesperson-facing one.
- **Concurrent edit of the same draft on two devices.** Out of scope for MVP — the `orders` row belongs to one salesperson in the field (see P2). The plan MUST note last-write-wins still governs if it occurs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The client profile MUST expose a "Novo pedido" action that creates a new order associated with the current client, with `status = draft` and 0 items, and opens the order-assembly flow.
- **FR-002**: The system MUST persist every order mutation (add item, remove item, change qty, set line discount, set order discount, change status) to the local database before confirming the change in the UI.
- **FR-003**: Draft orders MUST survive app kill and device restart with 100 % fidelity (client reference, items, quantities, discounts, timestamps). On next launch, they MUST appear in the home "Drafts in progress" section.
- **FR-004**: The quantity control on each line MUST support both (a) `+` / `−` tap steppers as the primary path and (b) direct numeric keyboard entry by tapping the quantity number.
- **FR-005**: The line-level discount MUST support two modes — `%` and `R$`. In `%` mode, value entry is stepper-only; in `R$` mode, value entry accepts both stepper and direct keyboard input.
- **FR-006**: The order-level discount at the summary step MUST follow the same mode + entry rules as FR-005.
- **FR-007**: Discount values MUST be stored on the `order_item` (for line discounts) and `order` (for order-level discount) records. The system MUST NEVER write to the `products` or `product_variants` tables as part of this flow.
- **FR-008**: Totals displayed on the summary MUST break down as: subtotal (sum of line qty × unit price), line discounts (sum), order discount, final total. Each component MUST be independently visible.
- **FR-009**: Order status values MUST be restricted to `draft`, `sent`, `canceled`. No fourth value is accepted by writes, by sync push, or by sync pull.
- **FR-010**: Transition `draft → sent` MUST be triggered by the explicit "Enviar pedido" CTA on the summary screen and MUST fail if the draft has 0 line items.
- **FR-011**: Transition `draft → canceled` MUST be triggered by an explicit cancel affordance accessible from the OrderDraft screen, and MUST require confirmation (no silent cancel).
- **FR-012**: A `sent` or `canceled` order MUST be read-only in the client surface — no line, qty, or discount mutation is allowed once the transition has occurred.
- **FR-013**: The home "Drafts in progress" list MUST surface all orders with `status = draft`, ordered by most recently updated, and MUST NOT list `sent` or `canceled` orders.
- **FR-014**: Every order-assembly screen (OrderDraft, AddToOrder, OrderSummary) MUST be implemented for both phone (390 × 844 pt) and tablet (820 × 1180 pt) portrait viewports, per UX5.
- **FR-015**: Every mutation path MUST operate against the local database without requiring connectivity; no screen MUST block on a network request during order assembly (P1).
- **FR-016**: The system MUST clamp line totals and the order total to a minimum of R$ 0,00 — a discount that would produce a negative value is accepted but surfaces an inline warning, and the persisted/displayed total is 0,00.
- **FR-017**: The "Drafts in progress" list entry for an order MUST show the associated client name, item count, current total (with discounts applied), and last-saved timestamp.

### Key Entities

- **Order**: Represents one intent order in one of three states. Attributes: id, client reference, salesperson reference, status (`draft` | `sent` | `canceled`), order-level discount (mode + value), timestamps (created_at, updated_at, sent_at?, canceled_at?). Related to many `order_item` rows.
- **OrderItem**: A single line of an order. Attributes: id, order reference, product reference, product_variant reference, quantity, unit price captured at add-time (snapshot), line-level discount (mode + value). A line's display total is computed from these — the computed total is not persisted as a separate field.
- **Client** (pre-existing from 007): Referenced by the order; read-only in this feature.
- **Product / ProductVariant** (pre-existing from 006): Referenced by each line for catalog lookup and display; MUST NOT be mutated by this feature (R5).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the client profile, a salesperson can open a new draft, add 5 items with quantity and a line discount, apply an order-level discount, and reach the summary review in under 90 seconds on a phone, using only +/- taps for quantity.
- **SC-002**: 100 % of drafts created in the last session are recoverable on next app launch with zero data loss (items, quantities, discounts, client association, timestamps).
- **SC-003**: 0 % of orders in the database have a status other than `draft`, `sent`, or `canceled` at any point in time (constitution D4 compliance; enforced by storage-layer validation and by a repeatable database audit query).
- **SC-004**: Across all order-assembly flows, the `products` and `product_variants` tables receive 0 write operations attributable to this feature's code paths (R5 compliance; enforced by schema-level permission scoping and by a repeatable audit).
- **SC-005**: Both phone and tablet viewports pass visual review on all three screens (OrderDraft, AddToOrder, OrderSummary) before any screen is considered implementation-complete (UX5).
- **SC-006**: 95 % of quantity changes in usability testing are made via +/- taps (not the keyboard), confirming the stepper remains the primary path even though typing is available.

## Assumptions

- The home "Drafts in progress" list introduced in 008-home-dashboard already exists and will read from `orders` where `status = 'draft'`. This feature writes to that same table and does not alter home's rendering logic.
- The existing ClientProfile screens (phone + tablet) from 007-client-registration already expose a bottom action region suitable for the "Novo pedido" CTA; no redesign of ClientProfile is in scope.
- The catalog and product-detail screens from 006-product-catalog are reused as the browsing surface during order assembly. They need a minimal "in-order context" affordance (e.g., a cart badge or floating summary) but no functional rewrite.
- The post-send PDF/email handoff is a separate, already-planned feature (not in this spec). Sending here MUST only transition the status and hand off to whatever downstream flow exists (or a stub if not yet implemented).
- All business amounts are BRL (R$) only — multi-currency is out of MVP scope.
- Tax line items (ICMS/IVA) are out of scope for this feature. Totals show subtotal → discounts → total without a tax row. If tax is required later, it will be a separate spec.
- Device clock is trusted for `updated_at` timestamps on drafts; sync conflict resolution (last-write-wins, P2) governs if two drafts collide upstream.
- Role scope: this feature is `seller`-only. Admin does not need an order-editing affordance in the MVP (admins inspect orders via the Supabase dashboard).
