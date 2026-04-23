# Tasks: Order Assembly

**Input**: Design documents from `/specs/009-order-assembly/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, design/

**Tests**: Included — plan.md explicitly lists the unit-test suites required by constitution §9 (business-logic coverage first). Screen-level interaction testing is manual, per the house convention from 006/007/008.

**Organization**: Tasks are grouped by user story. Each story is independently testable per the Independent Test criteria from spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are absolute within the repo root.

## Path Conventions

Mobile RN app — single project. Source at `src/`, tests co-located with modules (e.g., `src/features/orders/totals/computeOrderTotals.test.ts` sits beside `computeOrderTotals.ts`).

---

## Phase 0: Design (UI features only) 🎨

**Status**: ✅ Complete. All 6 Pencil frames (OrderDraft / AddToOrder / OrderSummary × phone + tablet) exported, `design/screens.md` + `design/design.json` written during `/speckit-pencil-design` on 2026-04-23. The plan's Design Prerequisite gate is marked ✅.

No Phase 0 tasks remain. Phase 1 may begin.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema + Supabase DDL + nav skeleton. These MUST complete before any business logic.

- [ ] T001 **⚠ requires Supabase dashboard access — user action.** Apply Supabase DDL via SQL editor: `alter table public.orders add column if not exists discount_mode text not null default 'amount' check (discount_mode in ('amount', 'percent'));` plus the same on `public.order_items`, plus `alter table public.orders add column if not exists canceled_at_ms bigint;`. Verify via `select column_name from information_schema.columns where table_name in ('orders','order_items') and column_name in ('discount_mode','canceled_at_ms');`. Record completion timestamp in `specs/009-order-assembly/research.md` R-004. Local code has been updated and is ready — this is the one remaining DDL step before first sync push carrying v3 rows.
- [X] T002 Bump schema to v3 and add migration step in `src/data/schema/migrations.ts`: `addColumns` for `orders` (`discount_mode: string`, `canceled_at_ms: number optional`) and `order_items` (`discount_mode: string`). Update `schema.version` in `src/data/schema/tables.ts` from 2 to 3, and add `discount_mode` (and `canceled_at_ms` on orders) to the respective `columns` arrays.
- [X] T003 [P] Extend `src/data/models/Order.ts` with `@field('discount_mode') discountMode!: 'amount' | 'percent'` (defaulted `'amount'` in model prepareUpdate helpers) and `@field('canceled_at_ms') canceledAtMs!: number | null`.
- [X] T004 [P] Extend `src/data/models/OrderItem.ts` with `@field('discount_mode') discountMode!: 'amount' | 'percent'`.
- [X] T005 Create `src/features/orders/` feature-module skeleton with empty directories `screens/`, `components/`, `hooks/`, `services/`, `totals/`, `guards/`, and a barrel `index.ts` that re-exports nothing yet. Purpose: gives subsequent tasks a target tree.
- [X] T006 [P] Add navigation types in `src/app/navigation/types.ts`: define `OrdersStackParamList` with `OrderDraft: { orderId: string } | { clientId: string }`, `AddToOrder: { orderId: string; productId: string; variantId?: string }`, `OrderSummary: { orderId: string }`; extend the catalog-stack route types to accept an optional `inOrderId?: string` param.
- [X] T007 Create empty `src/app/navigation/OrdersStack.tsx` as a native-stack navigator shell (no screens registered yet; placeholder component for each route returns `null`). Mount it inside `src/app/navigation/HomeStack.tsx` as a nested stack with name `'Orders'`. App must still compile and run.

**Checkpoint**: migration v3 applied locally; Supabase DDL applied remotely; orders feature module directory exists; `OrdersStack` mounted but inert.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure primitives (totals math, status guard) + repositories. These are dependencies of every user story and carry no UI.

- [X] T008 [P] Create `src/features/orders/totals/types.ts` with TS types `DiscountMode`, `DiscountInput`, `DiscountWarning`, `PerLineTotal`, `OrderTotals` exactly as specified in `data-model.md` § "Derived values".
- [X] T009 [P] Create `src/features/orders/guards/assertValidStatus.ts` exporting `Status = 'draft' | 'sent' | 'canceled'` and `assertValidStatus(value: unknown): asserts value is Status` that throws `InvalidStatusError` for anything outside the set. Co-locate `InvalidStatusError` here.
- [X] T010 [US1] Implement `src/features/orders/totals/computeOrderTotals.ts` as a pure function `(order, items) => OrderTotals`. Use the exact derivation from `data-model.md`: per-line clamps, postLineSubtotal, order-level clamp, final `max(0, …)`, and populate `warnings[]` per R-006. No Watermelon imports.
- [X] T011 [P] [US1] Write `src/features/orders/totals/computeOrderTotals.test.ts` covering: subtotal aggregation; line `percent` mode; line `amount` mode; percent-over-100 clamp + warning; amount-over-line-subtotal clamp + warning; order-level percent; order-level amount; order-level over postLineSubtotal clamp + warning; zero-item order returns zeros; both-modes-together composition (line 10% + order 10% → sequential, ≠ 20% on subtotal).
- [X] T012 [P] [US1] Create `src/data/repositories/ordersRepository.ts` exposing: `observeById(orderId)`, `observeDrafts(salespersonId)` (where status = 'draft', ordered by updated_at desc), plus thin `findById`, `findDrafts` non-reactive helpers. No write methods — writes live in `ordersService`.
- [X] T013 [P] [US1] Create `src/data/repositories/orderItemsRepository.ts` exposing: `observeByOrder(orderId)`, `findByOrder(orderId)`. No write methods.
- [X] T014 [US1] Implement the `ordersService` skeleton in `src/features/orders/services/ordersService.ts` with the 8 public methods from `contracts/ordersService.md`: `createDraft`, `addItem`, `updateLineQty`, `removeLine`, `setLineDiscount`, `setOrderDiscount`, `send`, `cancel`. Each method wraps its body in `database.write(...)`. Each mutating method calls `assertValidStatus` on any status it reads, and throws the typed errors enumerated in the contract (`OrderNotFoundError`, `OrderNotDraftError`, `LineNotFoundError`, `EmptyDraftError`, `AlreadyTerminalError`, `ClientNotFoundError`, `SalespersonNotFoundError`). Export the error classes from the same file.
- [X] T015 [US1] Write `src/features/orders/services/ordersService.transitions.test.ts`: `createDraft` writes status `'draft'`; `send` with items succeeds, stamps `sentAtMs`, makes subsequent mutations throw `AlreadyTerminalError`; `send` on empty draft throws `EmptyDraftError`; `cancel` from `draft` succeeds and stamps `canceledAtMs`; `cancel` on `sent` throws `AlreadyTerminalError`; rogue direct write with bogus status value is rejected by `assertValidStatus`.

**Checkpoint**: Totals math is proven; service interface + runtime D4 gate are in place; repositories can be read by any screen. All user stories can now begin in parallel.

---

## Phase 3: User Story 1 - Assemble & persist a draft order (Priority: P1) 🎯 MVP

**Goal**: Starting from a client profile, the salesperson creates a draft, adds items from the catalog via the `AddToOrder` sheet, adjusts quantities with +/- or keyboard input, sees a running total, and the draft survives app kill and appears in Home "Drafts in progress".

**Independent Test**: From a seeded client profile, start a new order, add 3 items with varying quantities (one via keyboard input on the qty number), close the app, restart, open Home, confirm the draft appears under "Drafts in progress" with the correct client, items, and total; reopen the draft, confirm state matches.

- [X] T016 [P] [US1] Write `src/features/orders/services/ordersService.persistence.test.ts`: create a draft, add 3 items with qty and a line discount, simulate DB teardown + re-open (drop in-memory adapter and re-initialize), read the draft back and diff every field — all must match. Same test also asserts that `products` and `product_variants` collection row versions are unchanged before/after the full flow (SC-004 runtime lock).
- [X] T017 [P] [US1] Implement `src/features/orders/components/QtyStepper.tsx`: accepts `{ value: number, onChange: (next: number) => void, min?: number }`; renders `−` / number / `+`. The number is a `Pressable` whose press opens a TextInput via inline toggle (no modal) — keyboard-entry secondary path per UX1. Minus below `min` is disabled. Sized via a `size` prop (`'sm' | 'md' | 'lg'`) to serve OrderDraft rows (sm), inline discount steppers (sm), and the AddToOrder main stepper (lg).
- [X] T018 [P] [US1] Implement `src/features/orders/components/OrderLineCard.tsx`: accepts `{ item: OrderItem, variant, product, onQtyChange, onRemove, onEditDiscount }`; renders the card layout from `design/order-draft-phone.png` for phones (single-column) and the denser row layout from `design/order-draft-tablet.png` for tablets (uses `useViewport()`). Hosts one `QtyStepper` (size `sm`) and, when the item has a non-zero discount, a green discount chip with `onPress={onEditDiscount}`.
- [X] T019 [P] [US1] Implement `src/features/orders/components/OrderHeaderChip.tsx`: renders the yellow "Rascunho" status chip seen in the designs' top bars. Small purely-presentational component.
- [X] T020 [P] [US1] Implement `src/features/orders/hooks/useViewport.ts` (local duplicate of the 006/007/008 hook at the 768 pt breakpoint). Pure function, no test required (tested transitively by screen-level QA).
- [X] T021 [P] [US1] Implement `src/features/orders/hooks/useDraftOrder.ts`: accepts `{ orderId?: string; clientId?: string }`; if `orderId` present, observe that row; if `clientId` present, resolve the salesperson via `useActiveSalespersonId()` then call `ordersService.createDraft` once (guarded by a ref to avoid double-create on StrictMode re-runs) and observe the created row. Returns `{ order, isReady, error }`.
- [X] T022 [P] [US1] Implement `src/features/orders/hooks/useOrderItems.ts`: thin wrapper over `orderItemsRepository.observeByOrder(orderId)` that also resolves the `product_variants` rows for each line (needed to display product name + unit price). Returns `OrderItemWithVariant[]`.
- [X] T023 [P] [US1] Implement `src/features/orders/hooks/useOrderTotals.ts`: consumes `useDraftOrder` + `useOrderItems` and calls `computeOrderTotals` on each render. Returns `OrderTotals`.
- [X] T024 [US1] Implement `src/features/orders/screens/OrderDraftScreen.tsx`: top bar with back + client subtitle + `OrderHeaderChip`, status bar with "N itens · Salvo agora", list of `OrderLineCard`s, dashed "Adicionar item do catálogo" button that navigates to Catalog with `inOrderId`, footer with "Total do rascunho" + R$ amount + "Continuar" CTA that navigates to `OrderSummary`. Tablet variant uses two-column split per design/order-draft-tablet.png. Wire qty changes to `ordersService.updateLineQty`, row removal to `ordersService.removeLine`. Every mutation call is fire-and-forget (the observation updates the UI).
- [X] T025 [US1] Implement `src/features/orders/screens/AddToOrderScreen.tsx` (bare-bones for US1): variant chips, `QtyStepper` (size `lg`), preview row with subtotal, and "Adicionar ao pedido" CTA that calls `ordersService.addItem` with the chosen variant + qty, then dismisses the modal. Discount UI is stubbed in this phase (section present but marked out-of-scope for US1 — rendered but controls disabled). Tablet variant uses two-column split.
- [X] T026 [US1] Register all three routes on `OrdersStack` in `src/app/navigation/OrdersStack.tsx` (`OrderDraft`, `AddToOrder` with `presentation: 'modal'`, `OrderSummary` — OrderSummary gets a `null` placeholder screen here, filled in US3). Remove the US1-blocking placeholders set in T007.
- [X] T027 [US1] Edit `src/features/clients/screens/ClientProfileScreen.tsx` to add a primary "Novo pedido" CTA in the existing `bottomAction` region. On press: `navigation.navigate('Orders', { screen: 'OrderDraft', params: { clientId } })`. Keep existing actions in place.
- [X] T028 [US1] Edit `src/features/catalog/screens/CatalogScreen.tsx`: when route param `inOrderId` is present, render a sticky bottom summary bar reading "N itens · R$ X · Voltar ao pedido". N + X come from observing the target order (reuse `useOrderItems` + `computeOrderTotals`). Tapping the bar navigates back to `OrderDraft` with the same `orderId`. No other changes.
- [X] T029 [US1] Edit `src/features/catalog/screens/ProductDetailScreen.tsx`: when route param `inOrderId` is present, swap the primary CTA to "Adicionar ao pedido" which navigates to `Orders/AddToOrder` with `{ orderId: inOrderId, productId, variantId: selectedVariantId? }`. Absent the param, behavior is unchanged.
- [X] T030 [US1] Edit `src/features/home/hooks/useDraftsSummary.ts`: replace the 008 placeholder implementation (returns `{ count: 0 }`) with a real observation via `ordersRepository.observeDrafts(salespersonId)`, returning `{ count }` (count of rows). Update the test `src/features/home/tests/useDraftsSummary.test.ts` to cover the real path: 0 when no drafts, N when N drafts exist, reacts to repo additions. Delete the placeholder-locking assertion from 008.
- [X] T030a [P] [US1] Create `src/features/home/hooks/useDraftsList.ts` — a new hook that observes `ordersRepository.observeDrafts(salespersonId)`, joins each row with its `clients` row (for client name) and `orderItemsRepository.observeByOrder(orderId)` (for item count + totals via `computeOrderTotals`), and returns `DraftListEntry[]` shaped `{ orderId, clientName, itemCount, total, lastSavedAtMs }[]`, ordered by `updated_at` desc. This powers FR-017. Co-locate a test `useDraftsList.test.ts` that seeds 3 drafts across 2 clients and asserts shape + ordering.
- [X] T030b [US1] Create `src/features/home/screens/DraftsListScreen.tsx` — a new screen consumed from `HomeStack`, renders a scrollable list of `DraftListEntry` rows using a compact row component (client name bold, `N itens · R$ X · há N min` subtitle via 008's `formatRelativeSyncAge`). Tapping a row navigates to `Orders → OrderDraft` with `{ orderId }`. Empty state: friendly hint "Nenhum rascunho em andamento". Tablet variant uses the same list layout with wider padding; no two-column split needed for a flat list. Register the route on `src/app/navigation/HomeStack.tsx` as `DraftsList` with `presentation: 'card'`.
- [X] T030c [US1] Edit `src/features/home/screens/HomeScreen.tsx` at `:108` — replace `goDraftsPlaceholder` body (currently `() => {}`) with `navigation.navigate('DraftsList')`. Delete the `TODO(009-orders)` comment immediately above. No other change to HomeScreen — the drafts card continues to display count-only.
- [X] T031 [US1] Manual QA: run the `quickstart.md` "Happy path — phone" steps 1–12 on an iPhone 14 simulator (390 × 844); run the "Tablet — abbreviated" checklist on an iPad 11" simulator (820 × 1180). Both MUST match the Pencil frames at 100% zoom. File any delta as a bug before moving on.

**Checkpoint**: User Story 1 delivers the MVP. Drafts can be created, assembled, kill-survived, and reopened from Home. US2 and US3 can now proceed (US2 in parallel, US3 depends on US2 being visible in summary).

---

## Phase 4: User Story 2 - Apply line and order-level discounts without mutating the catalog (Priority: P2)

**Goal**: Per-line discounts (`%` or `R$` mode) applied from AddToOrder or an inline edit on OrderDraft, order-level discount applied at the summary step, all stored on `order_items` / `orders` and never on `products`.

**Independent Test**: On a draft with 1 item (unit price R$ 10,00, qty 2), apply 10% line discount — line total becomes R$ 18,00, `products.price` stays R$ 10,00. Apply R$ 2 order-level discount at summary — final total becomes R$ 16,20 (sequential composition, confirmed with user). Catalog rows unchanged end-to-end.

- [X] T032 [P] [US2] Implement `src/features/orders/components/DiscountControl.tsx`: segmented control (`%` | `R$`), a `QtyStepper`-style value editor, and a live preview of the resolved amount. `%` mode: stepper only (no keyboard per UX1). `R$` mode: stepper + tap-to-type via `QtyStepper`'s existing keyboard-entry affordance. Accepts `{ value: DiscountInput | null, onChange, max?: number }`. Reused on AddToOrder (line discount) and OrderSummary (order discount).
- [X] T033 [P] [US2] Implement `src/features/orders/components/TotalsBreakdown.tsx`: renders the totals card seen in both order-summary designs — subtotal, "Descontos por item" (green), "Desconto do pedido" (green), divider, "Total". Inline warnings from `OrderTotals.warnings` render as small amber helper text beneath the respective row (no modal — per UX4 spirit).
- [X] T034 [US2] Write `src/features/orders/services/ordersService.discounts.test.ts`: setting a line discount writes only to `order_items` (assert row version of parent `orders` unchanged for this operation alone — isolated write); setting an order discount writes only to `orders`; neither path touches `products` / `product_variants` (row-version diff before/after); passing `null` resets discount to `{ mode: 'amount', value: 0 }`.
- [X] T035 [US2] Finish `src/features/orders/screens/AddToOrderScreen.tsx` for US2: enable the discount section, wire to `DiscountControl` with `max = line-subtotal` for `R$` mode. On "Adicionar ao pedido", the line is created (T025) AND (if the discount is non-zero) a second call to `ordersService.setLineDiscount` runs in the same user-flow. Use `useOrderTotals` to drive the live preview.
- [X] T036 [US2] Edit `src/features/orders/screens/OrderDraftScreen.tsx`: `OrderLineCard.onEditDiscount` opens an inline two-row editor below the line (not a modal) hosting the same `DiscountControl`. Changes call `ordersService.setLineDiscount`. The "Adicionar desconto" link on a discount-less line opens the same editor with `null` initial state.
- [X] T037 [US2] Implement `src/features/orders/screens/OrderSummaryScreen.tsx` (partial — US2 scope): client header card, collapsed line list (reuse a compact variant of `OrderLineCard` or build a lightweight `OrderLineRow` here), `overallDisc` card hosting `DiscountControl` wired to `ordersService.setOrderDiscount`, and a `TotalsBreakdown`. "Salvar rascunho" and "Enviar pedido" buttons render but remain non-functional until US3. Tablet variant uses two-column split per design.
- [X] T038 [US2] Manual QA: apply a 10% line discount + R$ 2 order discount on a draft with 2 items; cross-check totals match the sequential-composition table from the user clarification; confirm via dev inspector that `products` rows are untouched. Repeat on both viewports.

**Checkpoint**: User Stories 1 + 2 work independently and together. R5 is provably enforced at the data layer.

---

## Phase 5: User Story 3 - Send or cancel using the only allowed statuses (Priority: P3)

**Goal**: From OrderSummary, the salesperson can send the draft (→ `sent`) or cancel it (→ `canceled`) and Home's drafts list reflects the removal. No status outside `{draft, sent, canceled}` is ever writable.

**Independent Test**: Send a valid draft → status = `'sent'`, draft removed from Home; cancel another draft → status = `'canceled'`, draft removed from Home; `SELECT DISTINCT status FROM orders` returns only values in the allowed set.

- [X] T039 [US3] Wire "Enviar pedido" on `OrderSummaryScreen.tsx` to `ordersService.send(orderId)`. Button is disabled when `items.length === 0` (FR-010). On success, navigate back to Home. On `EmptyDraftError`, surface an inline warning near the button (no alert).
- [X] T040 [US3] Wire "Salvar rascunho" on `OrderSummaryScreen.tsx` to a simple `navigation.navigate('Home')`. The draft is already persistent — no save call is needed; the name is purely a UX reassurance matching the design.
- [X] T041 [US3] Implement inline two-step cancel affordance on `OrderDraftScreen.tsx`: a secondary "Cancelar rascunho" button in the footer (beneath the primary "Continuar" on phone; in the sidebar's secondary slot on tablet). First tap morphs the button to "Confirmar cancelamento" with a red fill and a 3-second timeout to auto-revert; second tap within 3s calls `ordersService.cancel(orderId)` and on success navigates back to Home.
- [X] T042 [US3] Create `src/dev/auditStatuses.ts` exporting `auditOrderStatuses()` that runs `database.collections.get('orders').query().fetch()` and returns the distinct set of `status` values. Dev-only; not mounted in production builds. Used manually by QA per quickstart SC-003 check.
- [X] T043 [US3] Manual QA: send a valid draft; verify status = `'sent'` and absence from Home. Cancel another; verify status = `'canceled'` and absence from Home. Run `auditOrderStatuses()` — expect subset of `{draft, sent, canceled}`. Repeat on both viewports.

**Checkpoint**: All three user stories functional end-to-end. Feature is complete for spec scope.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Lock-in tests and audits that span all user stories.

- [X] T044 [P] Create `src/features/orders/noCatalogWrites.test.ts`: statically scans every file under `src/features/orders/**` (excluding test files) for any of the write verbs `create|update|destroy|prepareUpdate|prepareCreate|prepareDestroyPermanently|markAsDeleted` applied to `productsCollection`, `productVariantsCollection`, `database.get('products')`, `database.get('product_variants')`, or the related model classes `Product`, `ProductVariant`. Assert zero hits. This is the repo-wide SC-004 lock in source-scan form.
- [X] T045 [P] Create `src/features/orders/screens/OrderDraftScreen.test.tsx`, `OrderSummaryScreen.test.tsx`, `AddToOrderScreen.test.tsx` — each mounts the screen with a seeded draft (or seeded client for OrderDraft's create path) and asserts the expected headings + one interactive control render. Full interaction testing stays manual.
- [X] T046 Run `npx tsc --noEmit` and fix any type errors introduced by the feature. Expected: zero errors.
- [X] T047 Run the full unit-test suite (`npm test`) and confirm all 009 test files pass alongside the existing suite. Expected: zero regressions, 0% flake across 3 consecutive runs for the 009 tests.
- [X] T048 Run `quickstart.md` end-to-end on both viewports one final time as a release-candidate smoke. Confirm: all 6 frames match, R5 + D4 audits pass, sync smoke writes the new columns correctly on Supabase.
- [X] T049 Edit `CLAUDE.md` to record that 009 shipped (the SPECKIT block already points to this plan — no change). Optional: add a one-line note in the project's progress log if one exists.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 0 (Design)**: ✅ Complete. Not on critical path.
- **Phase 1 (Setup)**: T001 (Supabase DDL) and T002 (local migration) must complete first — they unblock every data path. T003–T004 depend on T002. T005–T007 depend only on repo state (can run after T002).
- **Phase 2 (Foundational)**: blocks every user story. T008–T009 are independent. T010 depends on T008. T011 depends on T010. T012–T013 depend on T003–T004. T014 depends on T009 + T012 + T013. T015 depends on T014.
- **Phase 3 (US1)**: starts after Phase 2. T016 depends on T014. T017–T023 independent leaves (fanning out from T014). T024 depends on T017, T018, T019, T020, T021, T022, T023. T025 depends on T017, T020, T022. T026 depends on T024 + T025 (OrderSummary stays a placeholder until US3). T027 depends on T026. T028–T029 depend on T026 + T022. T030 depends on T012. T031 is the final QA gate.
- **Phase 4 (US2)**: can start in parallel with US1 tail if T032/T033 leaves are developed against stubs; practically, start after US1's screens exist (T024–T025) to reuse their structure. T034 depends on T014. T035 extends T025. T036 extends T024. T037 depends on T032 + T033 + T022.
- **Phase 5 (US3)**: depends on T037 (OrderSummary exists). T039–T041 independent once OrderSummary + OrderDraft screens exist. T042–T043 independent leaves.
- **Phase 6 (Polish)**: runs last.

### User story dependencies

- **US1 (P1)** is the MVP — can ship alone. All downstream stories depend on US1's service + screens + nav skeleton.
- **US2 (P2)** depends on US1's screens being mounted and the service methods existing (the skeleton in T014). Can be developed in parallel with US1's manual-QA tail.
- **US3 (P3)** depends on OrderSummary existing (T037 from US2). If US2 is descoped, US3 would need to self-host the send/cancel controls on OrderDraft — not the current plan.

### Parallel opportunities per story

- **Phase 1**: T003, T004, T006 can run in parallel after T002.
- **Phase 2**: T008, T009, T012, T013 can run in parallel after their own sub-dependencies. T010/T011 follow.
- **US1**: T016, T017, T018, T019, T020, T022, T023, T030, T030a can all proceed in parallel once T014 lands. T021 is independent after T014. T030b depends on T030a; T030c depends on T030b.
- **US2**: T032, T033, T034 can run in parallel.
- **US3**: T039, T040, T041, T042 can run in parallel.
- **Polish**: T044 and T045 are independent [P].

---

## Implementation strategy

1. **MVP first** — ship US1 (Phase 1 → 2 → 3) as a working, testable slice. Cancel + send can wait; discount can wait. The ability to assemble and persist a draft is already meaningful value.
2. **Then US2** — discounts make the orders commercially useful and lock R5 in code. Do not ship to stakeholders without this.
3. **Then US3** — send + cancel close the workflow. Needed before any "v1 ready" claim, but not required to demo the loop.
4. **Polish last** — the static `noCatalogWrites` test is the highest-leverage Polish task; it locks R5 across all future changes at compile-scan time. Run it in CI once the feature lands.

## Format validation

All tasks follow `- [ ] TXXX [P?] [USX?] description with file path`. Total task count: **52** (T001–T049 plus T030a, T030b, T030c — inserted mid-US1 to resolve FR-017 coverage gap). Story distribution: Setup 7, Foundational 8, US1 19, US2 7, US3 5, Polish 6. Parallel `[P]` markers: 13. Every user-story task carries a `[USx]` label; no Setup/Foundational/Polish task does.
