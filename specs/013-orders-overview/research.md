# Research: Orders Overview

**Feature**: 013-orders-overview
**Date**: 2026-04-24

## R1 — Payment-status derivation: reuse vs re-implement

**Decision**: Extract the existing derivation from `src/features/clients/orders/deriveOrderHistory.ts` into a dedicated helper at `src/features/orders/payment/derivePaymentStatus.ts` and import it from both ClientProfile history and the new OrdersOverview/OrderDetail surfaces.

**Rationale**: Feature 012 already nailed the semantics — paid / partial / pending / adjust — with an EPS tolerance of 0.005 BRL. SC-003 mandates zero drift across surfaces. Duplicating the logic would create two paths that must be kept in sync; extracting locks them to one implementation and makes the helper independently testable.

**Alternatives considered**:

- **Leave it inside `deriveOrderHistory.ts` and re-import from there.** Rejected — it would bleed the clients/ namespace into orders/ and create a circular dependency footprint over time.
- **Re-implement with slightly different semantics (e.g. rounding).** Rejected — creates divergence risk; SC-003 explicitly calls this out.

## R2 — Month scrubber range

**Decision**: Cap the scrubber at the month of the earliest order the seller owns. Forward scrubbing allowed up to the current month only. Months with zero orders render an empty-state body but the summary shows `0 pedidos · R$ 0,00` and the chevrons remain enabled (user can keep scrubbing).

**Rationale**: Avoids infinite empty-month scrolling. Matches how the client profile history already behaves.

**Alternatives considered**:

- **Allow arbitrary backward scrolling.** Rejected — confusing UX; no signal that there are no more months.
- **Show only months that have orders.** Rejected — creates a discontinuous calendar, harder to reason about.

## R3 — Search scope

**Decision**: Search matches client name (case-insensitive, normalized for accents) and order number (`#XXXX` suffix). Does **not** match item descriptions.

**Rationale**: Item-level search would require joining `order_items` into the list observable, which ~10x's the per-row data and kills the performance budget (SC-001). The seller's mental model for finding an order is "whose order was it" or "which order number was it", not "which order had X item".

**Alternatives considered**:

- **Include item descriptions.** Rejected for the perf reason above.
- **Add a separate "search items" surface later.** Deferred — out of scope.

## R4 — Responsive layout strategy

**Decision**: A single `useResponsiveLayout()` hook returns `{ viewport: 'phone' | 'tablet' }` based on `Dimensions.get('window').width >= 820`. The hook subscribes to orientation changes via `Dimensions.addEventListener('change', …)` so rotating the device re-renders. Screens branch at the top level between a phone variant and a tablet variant, both fed by the same hook + selector output.

**Rationale**: Matches the pattern already used in feature 005's catalog and feature 011's OrderSent. No new library. One hook, one threshold, zero props plumbing.

**Alternatives considered**:

- **Media-query-like approach via `useWindowDimensions`.** Equivalent; we use the more explicit hook wrapper so the threshold lives in one place.
- **Separate routes for phone vs tablet.** Rejected — breaks deep-linking and complicates navigation types.

## R5 — List virtualization

**Decision**: Use `@shopify/flash-list` (already a transitive dep via feature 005) if available; otherwise `FlatList` with `initialNumToRender=12`, `windowSize=5`, and `getItemLayout`.

**Rationale**: SC-005 requires 55+ fps at 500 rows. Flash-list is strictly better for heterogeneous rows; FlatList suffices if flash-list isn't already wired. We check at task time to keep dependencies boring.

**Alternatives considered**:

- **ScrollView.** Rejected — no virtualization, breaks SC-001.

## R6 — Month bucketization for the observable

**Decision**: `observeOrdersForMonth(sellerId, monthStartMs, monthEndMs)` queries orders where `(status = 'draft' AND updated_at ∈ [start, end))` OR `(status = 'sent' AND sent_at ∈ [start, end))` OR `(status = 'canceled' AND canceled_at ∈ [start, end))`. The payment-status-dependent summary is computed downstream by combining with `observeReceiptsForOrders(orderIds)`.

**Rationale**: Picks each order into the month where the seller *acts on* it (not where it was first created). This matches the user's mental model on reconciliation — "what did I do in April?" not "which orders were born in April?".

**Alternatives considered**:

- **Bucket by `created_at` only.** Rejected — a draft created in March but sent in April should appear in April's summary.
- **Bucket by status-specific rules but still fall back to `created_at` for nulls.** Kept — canceled-before-sent edge case uses `canceled_at` with `created_at` fallback; applied the same way to drafts with no updates.

## R7 — Home "Atividade recente" replacement

**Decision**: Replace the current stub (at `HomeScreen.tsx:111`) with a `<RecentActivityCard />` that renders the 5 most recent sent/canceled orders (ordered by `sent_at ?? canceled_at` desc) owned by the current seller. Each row taps through to OrderDetail. When there are zero sent/canceled orders, the card shows a friendly empty state.

**Rationale**: Kills a stubbed placeholder and unlocks FR-016. The card is small and bounded (max 5 rows), so it fits the Home visual budget.

**Alternatives considered**:

- **Show drafts too.** Rejected — there's already a dedicated "Rascunhos em andamento" card.
- **Show top 3 with a "Ver todos" link.** Kept as fallback — if screen real estate is tight, drop to 3 rows + link.

## R8 — Short order id format

**Decision**: The short id is the last 4 hex characters of the order UUID, uppercased and prefixed with `#` (e.g. `#2041`). A utility `formatShortOrderId(id: string): string` lives in `src/features/orders/formatting/formatShortOrderId.ts`.

**Rationale**: No existing helper covers this. 4 hex chars gives 65k unique suffixes — enough collision headroom for a seller's practical catalog of orders.

**Alternatives considered**:

- **Show the full UUID.** Rejected — unusable in UI and search.
- **Add a separate numeric `short_id` column.** Deferred — introduces schema churn for cosmetic gain.

## R9 — Client profile row-tap behavior change

**Decision**: Change the existing ClientProfile history tap-through: drafts still open OrderDraft, but **sent/canceled rows now open the new OrderDetail screen** instead of OrderReceiptsScreen directly. The receipts card on OrderDetail continues to expose the "Ver todos" affordance that pushes OrderReceiptsScreen.

**Rationale**: Unifies the three entry points on one destination (FR-014, SC-002). The 012 feature explicitly flagged this navigation as a deviation from its design; fixing it here is the cleanest moment.

**Alternatives considered**:

- **Keep the direct-to-receipts behavior on ClientProfile and spread the inconsistency.** Rejected — fails SC-002.

## R10 — Offline PDF fallback for `Ver PDF`

**Decision**: When tapping `Ver PDF` on an order whose PDF has not been materialized yet (legacy sent orders, or orders sent while the sync queue still holds the upload), show a toast `PDF disponível após a próxima sincronização` and stay on the screen. Never block the UI waiting for the PDF.

**Rationale**: Aligns with P1 — no blocking spinners waiting on the network. The 011 feature already materializes PDFs on next sync; this is the known-case fallback.
