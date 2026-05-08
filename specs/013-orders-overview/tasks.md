# Tasks: Orders Overview

**Feature**: 013-orders-overview
**Plan**: [plan.md](./plan.md)
**Total tasks**: 41

Tasks marked **[P]** can run in parallel with others in the same phase.

---

## Phase 0 — Prerequisites

- [X] **T001** ✅ Design frames exist (verified): `specs/013-orders-overview/design/{orders-list,order-detail}-{phone,tablet}.png`. No action needed.

## Phase 1 — Setup & shared helper extraction

- [X] **T002** Create directory scaffolding: `src/features/orders/{overview,detail,payment,activity}/` with `screens/`, `hooks/`, `components/`, `selectors/` subfolders as listed in plan.md § Project Structure.
- [X] **T003** Extract `derivePaymentStatus` from `src/features/clients/orders/deriveOrderHistory.ts` into `src/features/orders/payment/derivePaymentStatus.ts`. Move the `OrderPaymentStatus` type with it. Export the same semantics; do NOT change the function body beyond rename.
- [X] **T004** Update `src/features/clients/orders/deriveOrderHistory.ts` to import the helper from its new home. Delete the local copy.
- [X] **T005** [P] Write `src/features/orders/payment/derivePaymentStatus.test.ts` covering the 5 branches + EPS boundary (per contract). Port the relevant cases from `src/features/clients/tests/orderHistory.test.ts` to the new test file.
- [X] **T006** Run the existing 012 test suite to confirm ClientProfile history still passes after the move: `npm test -- --testPathPattern "features/clients/tests/orderHistory"`.

## Phase 2 — Data-layer primitives

- [X] **T007** Add `observeOrdersForMonth(sellerId, monthStartMs, monthEndMs)` to `src/data/repositories/ordersRepository.ts` per contract `contracts/observeOrdersForMonth.md`. Status-aware month bucketization (R6).
- [X] **T008** [P] Write `src/data/repositories/ordersRepository.observeOrdersForMonth.test.ts`: seed 10 orders × 2 months × 3 statuses, assert bucket correctness + mutation re-emission + empty-seller edge case.
- [X] **T009** [P] Add `observeReceiptsForOrders(orderIds: readonly string[])` to `src/data/repositories/paymentReceiptsRepository.ts` — emits a map `orderId → Receipt[]` for the given ids. Re-emits on any receipt mutation.
- [X] **T010** [P] Write `src/data/repositories/paymentReceiptsRepository.observeReceiptsForOrders.test.ts` covering standard scenarios (multiple orders, correction rows grouped with parent, empty list).

## Phase 3 — Selectors (pure functions)

- [X] **T011** [P] Implement `src/features/orders/overview/selectors/computeOrdersOverviewSummary.ts` per contract. Exports `computeOrdersOverviewSummary(rows)`.
- [X] **T012** [P] Write `src/features/orders/overview/selectors/computeOrdersOverviewSummary.test.ts` covering the 5 contract cases + the property-based test for SC-004 (100 random fixtures).
- [X] **T013** [P] Implement `src/features/orders/overview/selectors/applyFilters.ts` — `applyFilters(rows, filter)` returning the narrowed list. Handles month (already scoped by observable) + status chip + case/accent-insensitive name/short-id search.
- [X] **T014** [P] Write `src/features/orders/overview/selectors/applyFilters.test.ts` covering each chip × query combination.
- [X] **T015** [P] Implement `src/features/orders/formatting/formatShortOrderId.ts` + test (`#XXXX` uppercase suffix, R8).

## Phase 4 — Hooks

- [X] **T016** Implement `src/app/hooks/useResponsiveLayout.ts` (if not already present) returning `{ viewport: 'phone' | 'tablet' }` per R4. If it exists, reuse and skip.
- [X] **T017** Implement `src/features/orders/overview/hooks/useOrdersOverviewFilters.ts` — reducer-based state for `{ month, status, query }` with actions `setMonth`, `setStatus`, `setQuery`, `nextMonth`, `prevMonth`.
- [X] **T018** Implement `src/features/orders/overview/hooks/useOrdersOverview.ts` — composes `observeOrdersForMonth` + `observeReceiptsForOrders` + `derivePaymentStatus` to produce `{ rows, summary, isLoading }`. Applies `applyFilters` + `computeOrdersOverviewSummary` downstream.
- [X] **T019** [P] Write `src/features/orders/overview/hooks/useOrdersOverview.test.ts` — integration against an in-memory Watermelon instance; assert row DTO shape + summary math + live updates when a receipt is added.
- [X] **T020** Implement `src/features/orders/detail/hooks/useOrderDetail.ts` — observes one order + its items + its receipts + its client, produces `OrderDetailDTO`.
- [X] **T021** [P] Write `src/features/orders/detail/hooks/useOrderDetail.test.ts`.
- [X] **T022** Implement `src/features/orders/activity/hooks/useRecentActivity.ts` — top 5 sent/canceled orders for the logged seller, ordered by `sent_at ?? canceled_at` desc (R7).

## Phase 5 — UI components

- [X] **T023** [P] Build `src/features/orders/overview/components/{MonthScrubber,StatusFilterChips,SummaryBand,SearchField,OrdersOverviewRow}.tsx`. Pure presentational — props-in, events-out. Use design tokens, payment-chip palette from feature 012.
- [X] **T024** [P] Build `src/features/orders/activity/components/RecentActivityCard.tsx`.

## Phase 6 — Screens

- [X] **T025** Build `src/features/orders/overview/screens/OrdersOverviewScreen.tsx`. Top-level branch on `viewport`: phone variant (single column) vs tablet variant (split panel). Both consume `useOrdersOverview()`. Use `@shopify/flash-list` if available (per R5), otherwise `FlatList` with `getItemLayout`.
- [X] **T026** Build `src/features/orders/detail/screens/OrderDetailScreen.tsx`. Same visual primitives as OrderSummary but **every mutation control is hidden/disabled** (FR-011). Footer: `Ver PDF` + `Lançar recebimento` (hidden for canceled). When `viewport === 'tablet'` AND `route.params.deepLinked === true`, render the full-screen OrderDetail/Tablet layout (FR-021). On tablet without `deepLinked`, this screen is not pushed — the parent OrdersOverview renders the detail in its right pane instead. Empty receipts list on OrderDetail renders a single empty-state row with no tap-through (U1 clarification).

## Phase 7 — Navigation + Home wiring

- [X] **T027** Update `src/app/navigation/types.ts` + `src/app/navigation/OrdersStack.tsx`: add routes `OrdersOverview` (params: none) and `OrderDetail` (params: `{ orderId: string; deepLinked?: boolean }`). Home "Atividade recente" taps and ClientProfile sent/canceled taps MUST pass `deepLinked: true`; OrdersOverview's own row taps on phone push `OrderDetail` without `deepLinked` (defaults to `false`); on tablet, OrdersOverview row taps update in-screen selection state instead of navigating.
- [X] **T028** Update `src/app/screens/HomeScreen.tsx`: add `Pedidos` QuickActionCard (FR-015); replace the Atividade recente stub at ~L111 with `<RecentActivityCard />` (FR-016).
- [X] **T029** Wire `ClientProfile` history row-tap: drafts → OrderDraft (unchanged); sent/canceled → OrderDetail (R9 change). Update the existing 012 test that locked the old direct-to-OrderReceipts behavior.

## Phase 8 — Integration tests

- [ ] **T030** [P] Integration test: SC-002 — from each of the three entry points, navigate to the same sent order; assert the rendered screen component is identical. _Deferred per §9 (no in-repo RN test renderer). Locked instead by (a) single `OrderDetail` route in the stack, (b) T030b parity, (c) navigation call sites reviewed in code review._
- [X] **T030b** [P] Cross-surface parity test: SC-003 — for 100 seeded random (total, receipts[]) fixtures, asserts `paymentStatus` from `derivePaymentStatus` matches the value produced by `deriveOrderHistoryRow` (ClientProfile pipeline). Locks that both surfaces consume the shared helper identically. File: `src/features/orders/payment/crossSurfaceParity.test.ts`.
- [ ] **T031** [P] Integration test: SC-006 — Supabase-spy + 30 s airplane-mode interaction → 0 calls. _Deferred per §9 (no in-repo RN renderer). Enforced at code-review time: OrdersOverviewScreen / OrderDetailScreen import only from `@/data/repositories/*` and use no `@/data/sync/supabase` symbol; grep-audited at tasks-complete time._
- [ ] **T032** [P] Integration test: R9 — ClientProfile sent-row tap routes to OrderDetail. _Deferred per §9; behavior locked by the change in `ClientProfileScreen.tsx:209` and the T030b parity test covering the shared derivation._

## Phase 10 — Month picker + report export (FR-022..025)

- [X] **T035** Build `src/features/orders/overview/components/MonthYearPicker.tsx`. Modal with a year stepper (left/right chevrons + current year) + 3×4 grid of month buttons (jan..dez, pt-BR abbreviations) + "Este mês" shortcut. Pure component; emits `onChange(monthKey)` + `onClose()`. The active month is visually highlighted.
- [X] **T036** Make `MonthScrubber` title tappable → opens the picker. Selecting a month calls `filters.setMonth(monthKey)` (reusing the existing reducer action).
- [X] **T037** Implement `src/features/orders/overview/report/buildReportData.ts` — pure async function that reads every order + items + receipts owned by the seller (via existing repos), buckets them by month (YYYY-MM, status-aware timestamp per R6), and returns `{ generatedAtMs, monthlyBuckets: Array<{ monthKey, summary, rows }> }` ordered newest-first. Add a unit test with seeded fixtures.
- [X] **T038** [P] Implement `src/features/orders/overview/report/renderReportHtml.ts` (HTML template for the PDF, one `<table>` per month) + `buildReportCsv.ts` (pt-BR semicolon, BRL comma). Both pure. Tests lock the byte-exact first 20 lines of each format.
- [X] **T039** Implement `src/features/orders/overview/report/exportReport.ts` — dispatcher: `{ format: 'pdf' | 'csv', data }` → writes to `<cacheDir>/reports/<filename>` → `Sharing.shareAsync`. Mirrors the pattern in `orderSendService.ts`. No tests (side-effectful + locked by shared infra).
- [X] **T040** Wire OrdersOverviewScreen: add a download icon button top-right → opens a small chooser modal (`Exportar como PDF` / `Exportar como CSV` / `Cancelar`). Calls `buildReportData` then `exportReport`. Show a toast / alert on failure.

## Phase 9 — Polish & docs

- [X] **T033** Update `SPECS.md` — add item 013 status row (Draft → In progress).
- [X] **T034** Manual smoke test per `quickstart.md` matrix. Confirm every row behaves as tabled. Fix any drift.

---

## Dependency ordering

- Phase 1 (T002–T006) before Phase 2–7.
- Phase 2 (T007–T010) before T018–T022.
- Phase 3 (T011–T015) before T018 + T025.
- Phase 4 (T016–T022) before Phase 5–6.
- Phase 5 (T023–T024) before T025 + T028.
- Phase 6 (T025–T026) before Phase 7.
- Phase 7 (T027–T029) before Phase 8.
- Phase 8 before Phase 9.

## Parallel sets (within phase)

- {T005} with T003/T004.
- {T008, T009, T010} parallel (different files).
- {T011+T012, T013+T014, T015} parallel.
- {T019, T021} parallel.
- {T023, T024} parallel.
- {T030, T030b, T031, T032} parallel.
