# Feature Specification: Orders Overview

**Feature Branch**: `013-orders-overview`
**Created**: 2026-04-24
**Status**: Draft
**Roles affected**: `seller`
**Input**: User description: "Implement an orders overview screen for the salesperson that consolidates all their orders for reconciliation per constitution UX1, UX3, and D4. Screen lists every order owned by the logged seller (any status) with tap-first filters: status chips (Rascunhos / Pendente pagamento / Pago / Cancelados), month selector (current month default, scrub prev/next), and free-text search by client name or order number. Each row shows client, total, status chip, relevant timestamp (updated for drafts, sent_at for sent, canceled_at for canceled), and a paid/pending indicator derived from payment_receipts: sum of receipts.amount ≥ order.total → 'Pago'; 0 < sum < total → 'Parcial'; sum = 0 on a sent order → 'Pendente'; canceled is its own terminal label; draft is its own terminal label. A summary band at the top of the list MUST show, aggregated over the active filter window: orders count, total billed (sum of totals of sent orders only), total received (sum of payment_receipts.amount within the month, across sent orders), and total pending (billed − received, floored at 0). Tapping a row opens OrderDraft for drafts and a new read-only OrderDetail screen for sent/canceled — same visual layout as OrderSummary but every mutation control is absent or disabled; the screen is reachable from three entry points: (a) this orders list, (b) Home 'Atividade recente' card (replaces the stub at HomeScreen.tsx:111), (c) client profile order history (feature 7). No new status enum value — 'Pago / Pendente / Parcial' are UI-only derivations, never written to orders.status. Offline-first; reads only from WatermelonDB via repositories — no Supabase calls on this surface. Add the list as a fourth entry point on Home (new QuickActionCard 'Pedidos') in addition to 'Rascunhos em andamento'"

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen`

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| OrdersList / Phone | [orders-list-phone.png](./design/orders-list-phone.png) | Top bar → month scrubber → summary band (Faturado / Recebido / Pendente + progress) → status filter chips → order rows with client, total, status chip, payment chip, timestamp. |
| OrderDetail / Phone | [order-detail-phone.png](./design/order-detail-phone.png) | Read-only mirror of OrderSummary for sent/canceled orders: client card, items list marked "Somente leitura", totals, receipts section with payment chip, footer with **Ver PDF** + **Lançar recebimento**. |
| OrdersList / Tablet | [orders-list-tablet.png](./design/orders-list-tablet.png) | Split panel: left = month scrubber + summary + filters + list; right = detail preview of the selected order. Search field lives in the top bar. |
| OrderDetail / Tablet | [order-detail-tablet.png](./design/order-detail-tablet.png) | Full-screen fallback when accessed via deep-link: two-column body with items on the left and stacked totals + receipts on a right rail. |

### Design decisions carried into this spec

- **Payment status is UI-only**. Never written back to `orders.status`; derived on read from `payment_receipts` totals. The same derivation that lives in the 012 feature powers this screen — ensuring a single source of truth.
- **Summary band aggregates only over the active filter window** (month × status × text query). `Recebido` counts receipts belonging to sent orders within the window; drafts and canceled orders contribute neither to `Faturado` nor to `Recebido`.
- **Tablet uses a split panel** so the seller can scrub rows while inspecting one. Phone pushes a standalone OrderDetail (sent/canceled) or OrderDraft (drafts) on row tap.
- **OrderDetail has no mutation controls** (no `Editar`, no `Trocar cliente`, no discount widget). It is reachable from three entry points and must behave identically on each.
- **Three entry points**: (a) OrdersOverview list (new), (b) Home "Atividade recente" card (replaces the stub), (c) client profile order history (feature 007). Drafts always open OrderDraft; sent/canceled always open OrderDetail.
- **Home gets a new `Pedidos` QuickActionCard** alongside the existing `Rascunhos em andamento` card.

## User Scenarios & Testing

### User Story 1 — See all my orders of the month at a glance and reconcile them (Priority: P1)

A field seller finishes a route and opens the app at the end of the day to check what was sold, what was paid, and what is still pending. They open the new **Pedidos** entry point from Home, land on the current month, and immediately see the summary band: total billed, total received, total pending. They skim the rows to spot any unpaid sent order or any draft they forgot to send.

**Why this priority**: This is the core value of the feature — one consolidated surface for reconciliation. Without it, the seller must hop between the client list, client profile, and each order's receipts screen to piece together the same information.

**Independent Test**: With an empty database, the screen must render the empty state + zeroed summary (0 pedidos · R$ 0,00). With a handful of sent/draft/canceled orders across two months, the summary band and list must match a hand-computed reconciliation and the month scrubber must navigate cleanly between the two.

**Acceptance Scenarios**:

1. **Given** I am logged in and own 3 sent orders totaling R$ 1.000 with R$ 600 in receipts this month, **When** I open Pedidos, **Then** the summary band shows `3 pedidos · Faturado R$ 1.000,00 · Recebido R$ 600,00 · Pendente R$ 400,00` and the progress bar is ~60% filled.
2. **Given** the list is showing April, **When** I tap the left chevron on the month scrubber, **Then** the list reloads with March's orders and the summary recomputes for March only.
3. **Given** the list shows 10 orders mixed across statuses, **When** I tap the `Pago` status chip, **Then** only sent orders whose receipts sum ≥ total remain visible, the summary recomputes over that subset, and the chip state is visually active.

---

### User Story 2 — Open a sent order read-only from three places and always see the same screen (Priority: P1)

A seller needs to answer a customer's question about an order that was delivered days ago. Whether they started from OrdersOverview, from Home's "Atividade recente" card, or from the client's profile order history, they must land on the same read-only OrderDetail screen with the same information and the same actions available — no accidental mutation, no divergent layouts.

**Why this priority**: Three entry points that render different screens would be a user-trust disaster (seller mutates a sent order thinking they are on a draft). Funneling them into one read-only surface is the single most important invariant of the feature.

**Independent Test**: Sent an order #1. From each of the three entry points, tapping that order must push the same screen component with identical rendered content. Attempting to interact with items, discount, or client controls must be impossible (not just no-op).

**Acceptance Scenarios**:

1. **Given** a sent order exists, **When** I tap it from OrdersOverview, **Then** OrderDetail opens showing the client card with `Ver cliente` (no `Trocar`), the items list labeled `Somente leitura`, totals block, receipts card, and footer with `Ver PDF` + `Lançar recebimento`.
2. **Given** the same sent order, **When** I open it from the Home "Atividade recente" card, **Then** the same OrderDetail screen renders with the same content.
3. **Given** a canceled order, **When** I open it from client profile history, **Then** OrderDetail opens with the Cancelado chip, a receipts section only if receipts exist, and the footer hides `Lançar recebimento` (nothing can be collected on a canceled order).
4. **Given** a draft order, **When** I tap it from OrdersOverview, **Then** OrderDraft opens (the existing editor), not OrderDetail.

---

### User Story 3 — Filter & search to find a specific order fast (Priority: P2)

A seller remembers they sold something to "Padaria São José" last week and needs to see whether it was paid. They open Pedidos and filter down quickly using the status chips, month scrubber, and search field.

**Why this priority**: Reconciliation benefits a lot from this but the list works without it for small catalogs. Smaller catalogs will find what they need by eyeballing the rows.

**Independent Test**: With 30 mixed-status orders across 3 clients, typing `pad` in the search must show only orders whose client name matches `pad` (case-insensitive). Combining with the `Pago` chip must further narrow to paid ones.

**Acceptance Scenarios**:

1. **Given** the list shows 20 rows, **When** I type `pad` in the search field, **Then** only rows whose client name contains `pad` (case-insensitive) remain visible.
2. **Given** I typed `#2041` in the search, **When** I finish typing, **Then** only the order whose short id ends with `2041` remains.
3. **Given** I combined `Pendente` chip + search text `mer`, **When** both are active, **Then** the visible rows satisfy both filters simultaneously and the summary reflects the intersection.

---

### User Story 4 — Home gets a dedicated Pedidos card and a live "Atividade recente" (Priority: P2)

The seller lands on Home first thing in the morning. They should see a new `Pedidos` QuickActionCard alongside `Rascunhos em andamento`, and the existing "Atividade recente" stub card must now actually show the most recent sent/canceled orders and tap through to OrderDetail.

**Why this priority**: This elevates the new surface to a first-class Home entry point and kills a stubbed card. Without it, users would need to learn the new surface exists.

**Independent Test**: Home renders both cards. Tapping `Pedidos` pushes OrdersOverview; tapping an activity card row pushes OrderDetail for the corresponding sent/canceled order.

**Acceptance Scenarios**:

1. **Given** I am on Home, **When** the screen renders, **Then** I see a `Pedidos` QuickActionCard alongside `Rascunhos em andamento`.
2. **Given** 3 recent sent orders exist, **When** Home renders, **Then** the "Atividade recente" card lists them and tapping one opens OrderDetail.
3. **Given** there are zero sent or canceled orders, **When** Home renders, **Then** the "Atividade recente" card shows an empty-state message rather than the current stub.

### Edge Cases

- **Empty state (no orders)**: `0 pedidos · R$ 0,00`, empty-state art or copy in the list area, chevrons on the month scrubber still work.
- **Month with only drafts**: `Faturado = R$ 0,00` (drafts don't count), `Recebido = R$ 0,00`, list shows only draft rows; summary progress bar sits at 0.
- **Overpayment / negative correction**: A sent order whose receipts sum > total shows `Ajuste` (reusing the 012 palette). It counts into `Recebido` capped at `order.total` so `Pendente` cannot go negative.
- **Canceled order with receipts**: Shown in list with `Cancelado` chip only — the payment chip hides. Receipts are still visible on OrderDetail for audit.
- **Large catalog**: 500 orders in the active month must render smoothly. The list is virtualized and the month-level aggregation happens incrementally via the repository observable, not by reloading everything on every filter change.
- **Offline**: All data comes from WatermelonDB. No Supabase calls. A pull sync can update the list in the background without tearing the UI (same pattern as feature 007).
- **Deep-link while the seller has no network**: OrderDetail still renders from local WatermelonDB state. `Ver PDF` uses the cached PDF from feature 011 when available; when the PDF has not been materialized yet, a toast explains that it will be available after the next sync.

## Requirements

### Functional Requirements

**Orders list surface**

- **FR-001**: System MUST render an OrdersOverview screen that lists every order owned by the currently logged seller, regardless of status (draft / sent / canceled).
- **FR-002**: The list MUST default to the **current month** and MUST provide chevron controls to scrub to previous / next months.
- **FR-003**: The list MUST provide a **status chip row** with these options: `Todos` (default), `Rascunhos`, `Pendente pagamento`, `Pago`, `Cancelados`. Chips are single-select; tapping a second chip replaces the active filter.
- **FR-004**: The list MUST provide a **free-text search** that filters by client name (case-insensitive **and accent-insensitive**) and order number (match against the short id suffix).
- **FR-005**: Each row MUST show: client name, order total, primary status chip (Enviado / Rascunho / Cancelado), payment chip when applicable, and a single timestamp — `atualizado` for drafts, `enviado` for sent, `cancelado` for canceled.

**Payment status derivation (reuse from feature 012)**

- **FR-006**: Payment status MUST be derived on read from `payment_receipts.amount` against `orders.total`, with EPS tolerance of 0.005 BRL (identical to the 012 helper). Possible values: `Pago`, `Parcial`, `Pendente`, `Ajuste`. Never persisted.
- **FR-007**: The `Ajuste` state MUST apply when receipts sum > total (overpayment) OR < 0 (over-correction), matching the 012 logic.
- **FR-008**: Payment status MUST be `null` / hidden for drafts and canceled orders (no payment expectation).

**Summary band**

- **FR-009**: Above the list, the system MUST show a summary aggregated over the **active filter window** (month × status chip × text query). The band MUST include: orders count, `Faturado` (sum of totals of **sent** orders in the window), `Recebido` (sum of receipt amounts belonging to sent orders in the window, capped at each order's total to prevent negative Pendente), `Pendente` (`Faturado − Recebido`, floored at 0).
- **FR-010**: The summary MUST recompute live when any filter changes — there is no "apply" button.

**OrderDetail read-only screen**

- **FR-011**: A new OrderDetail screen MUST render for sent and canceled orders. It MUST reuse the visual layout of OrderSummary but MUST disable / hide every mutation control: no `Trocar cliente`, no `Editar itens`, no quantity stepper, no discount widget, no `Salvar rascunho` / `Enviar` buttons.
- **FR-012**: OrderDetail MUST show a receipts section when receipts exist, with the same payment chip as in the list row. Tapping the section (or a `Ver todos` affordance) MUST navigate to the existing OrderReceipts screen (feature 012).
- **FR-013**: OrderDetail's footer MUST show `Ver PDF` (opens the cached PDF from feature 011) and, for sent orders only, `Lançar recebimento` (navigates to PaymentReceiptForm from feature 012). Canceled orders hide `Lançar recebimento`.
- **FR-014**: OrderDetail MUST be reachable from three entry points: (a) OrdersOverview row tap for sent/canceled rows, (b) Home "Atividade recente" card tap, (c) client profile order history row tap for sent/canceled rows. Drafts MUST open OrderDraft from all entry points (existing behavior from feature 003).

**Home integration**

- **FR-015**: Home MUST add a new `Pedidos` QuickActionCard alongside `Rascunhos em andamento` that pushes OrdersOverview.
- **FR-016**: Home's existing "Atividade recente" stub (current placeholder at `HomeScreen.tsx:111`) MUST be replaced with a live card showing the seller's most recent sent and canceled orders (up to 5), with tap-through to OrderDetail.

**Data contract**

- **FR-017**: The screen MUST read data exclusively from WatermelonDB via the existing repositories (orders, order_items, payment_receipts). No direct Supabase calls.
- **FR-018**: `orders.status` enum MUST remain unchanged (`draft` / `sent` / `canceled`). `Pago` / `Parcial` / `Pendente` / `Ajuste` are UI-derived and never written back.
- **FR-019**: The list MUST update reactively when new receipts are added, when an order is sent, or when an order is canceled — via the same RxJS/WatermelonDB observable plumbing that feature 012 already uses for ClientProfile.

**Tablet split panel**

- **FR-020**: On tablet viewports, OrdersOverview MUST render a split panel: left = month scrubber + summary + filter chips + list, right = detail preview of the currently selected row (empty state when nothing is selected).
- **FR-021**: When OrderDetail is deep-linked on tablet (e.g. from Home "Atividade recente" or ClientProfile history), the full-screen OrderDetail/Tablet layout MUST be used instead of the split panel. The entry path is captured via a `deepLinked: true` route param; OrdersOverview's own row taps on tablet do NOT set this param and the detail renders in the right pane instead of pushing a new screen.

**Month selection**

- **FR-022**: The month label on the scrubber MUST be tappable. Tapping it opens a **month + year picker** (bottom sheet / modal) with: a year row (prev/next arrows + current year), a 3×4 grid of month buttons (jan..dez), and an "Este mês" shortcut. Selecting a month + year updates the active filter (same code path as chevron scrub).

**Full-period report export**

- **FR-023**: The OrdersOverview top bar MUST expose an export action (download icon, top-right). Tapping it opens a format chooser (PDF, CSV, Cancelar). The export covers **every month the seller has at least one order in** (not just the currently active month), grouped by month descending. For each month the report includes: orders count, `Faturado`, `Recebido`, `Pendente`, and then one detailed row per order (short id, client, status, total, received, payment status, effective timestamp). The generated file is shared via the OS share sheet (same pipeline feature 011 uses for order PDFs).
- **FR-024**: CSV export MUST use pt-BR semicolon separator + BRL decimals with comma (Excel-friendly in Brazil locale) and include a month header row before each month's detail rows so the file is human-skimmable.
- **FR-025**: PDF export MUST render server-agnostic HTML (reusing the existing `expo-print` pipeline) with a document title including the seller name + the export timestamp, then one table per month.

### Key Entities

- **Order (existing)**: id, seller_id, client_id, status (draft | sent | canceled), total, subtotal, discount_amount, created_at, updated_at, sent_at, canceled_at. No schema changes.
- **Order Item (existing)**: read to show item count on list rows; displayed in OrderDetail.
- **Payment Receipt (existing, from feature 012)**: read to compute the per-order payment status and the summary `Recebido`; surfaced in OrderDetail's receipts section.
- **OrdersOverviewFilter (new, UI state only)**: active month (YYYY-MM), active status chip, search text. Lives in screen state, not persisted.

## Success Criteria

### Measurable Outcomes

- **SC-001**: From cold-open to a fully rendered OrdersOverview with the current month's orders, the seller sees data within **1 second** on a mid-range Android device when the local DB holds ≤ 500 orders for the month.
- **SC-002**: 100% of sent/canceled order rows opened from any of the three entry points render the same OrderDetail component (verified by component identity in tests — not by visual regression only).
- **SC-003**: The payment-status derivation on this surface matches the derivation on ClientProfile (feature 012) for the same order and receipts — zero drift, locked by a shared helper.
- **SC-004**: The summary band's `Faturado − Recebido` equals `Pendente` for every filter combination in a property-based test over ≥ 100 random fixtures.
- **SC-005**: Scrolling through 500 rows on a mid-range Android device maintains a steady ~55+ fps (subjective: no visible jank), matching feature 007's list baseline.
- **SC-006**: Zero Supabase calls are issued by OrdersOverview or OrderDetail during a 30-second airplane-mode session — enforced by a jest spy in the integration test.

## Assumptions

- **Existing repositories cover our needs.** `ordersRepository`, `orderItemsRepository`, and `paymentReceiptsRepository` already expose observables that emit on change. We add a new `observeOrdersForMonth(sellerId, month)` if the closest equivalent doesn't fit.
- **Payment-status helper is shared with feature 012.** The derivation implemented in `src/features/clients/orders/deriveOrderHistory.ts` gets factored into a shared helper under `src/features/orders/payment/derivePaymentStatus.ts` and both surfaces consume it. This replaces the local helper the 012 feature introduced rather than duplicating it.
- **No new sync flow.** The existing pull/push sync already brings orders and receipts down to the device. OrdersOverview reads whatever is already there.
- **Short order id format** already exists (last 4 chars of the UUID, prefixed with `#`). If it does not, we display the full id truncated.
- **Tablet detection** uses the existing responsive hook (viewport width ≥ 820 px → tablet). If one does not exist, a new hook lands here.
- **No role matrix impact.** The feature is seller-only; admin surfaces are unaffected.
- **No server-side work.** Every field read exists in the current schema — this feature is pure client composition.

## Deviations from existing conventions

- The **OrderDetail screen is net-new** (vs. reusing OrderSummary's route). OrderSummary remains the pre-send review surface for drafts; OrderDetail is the post-send read-only surface. They share visual primitives but are distinct components.
- The existing **client profile row tap for sent orders** currently navigates to `OrderReceiptsScreen` directly (deviation noted in feature 012 T037). This feature changes that behavior so **sent/canceled rows on client profile history navigate to OrderDetail** (which itself exposes the receipts section), unifying the three entry points. Drafts continue to open OrderDraft.
