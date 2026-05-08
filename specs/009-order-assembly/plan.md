# Implementation Plan: Order Assembly

**Branch**: `009-order-assembly` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-order-assembly/spec.md`

## Summary

Build the `src/features/orders/` feature module that lets a salesperson assemble and persist draft orders from a client profile, applying optional line- and order-level discounts, and transitioning only through the three statuses allowed by D4 (`draft`, `sent`, `canceled`). The six Pencil frames (OrderDraft / AddToOrder / OrderSummary × phone + tablet) produced by `/speckit-pencil-design` are the primordial UI source — every screen component is a faithful implementation of one frame.

**Persist-on-mutation model.** A draft is a real `orders` row from the first tap. Every subsequent action (add item, adjust qty, set line discount, set order discount) writes to WatermelonDB inside a `database.write(...)` action before the UI acknowledges it. There is no in-memory "cart" living outside Watermelon — the row IS the cart. This upholds P5 without ceremony: if the app is killed at any moment, the draft is already persistent at exactly its displayed state. It also lets Home's "Drafts in progress" list (008) observe the same rows via `ordersRepository.observeDrafts(salespersonId)` with zero new store.

**Discount shape requires a schema migration.** The existing `orders.discount_amount` and `order_items.discount_amount` columns (shipped in 001, schema v2) store a number but have no mode field. The spec requires both `%` and `R$` modes, and a `%` discount must remain 10% as qty changes — which forces us to store the semantic (mode + value), not the derived absolute. Migration v3 adds one `discount_mode` column (string: `'amount' | 'percent'`) to both `orders` and `order_items`, defaulted to `'amount'` for any pre-existing rows (there are none in prod: 001–008 have not shipped orders). `discount_amount` keeps its name and slot; its numeric meaning is interpreted through `discount_mode`. This is the minimum viable schema change — we deliberately do not rename the column to `discount_value` because (a) the existing name is acceptable, (b) renaming doubles the migration complexity, and (c) this table has zero production rows at the time this feature ships.

**Totals are derived, never stored.** Line total and order total are computed in a pure function `computeOrderTotals(order, items)` at read time. The DB stores unit price snapshot + qty + discount (mode + value) per line, and order-level discount (mode + value) on the order. Every surface (OrderDraft footer, OrderSummary totals, "Drafts in progress" item subtitle) calls the same pure function. This prevents divergence and makes the `products`/`product_variants` tables provably untouched by this feature (SC-004 is enforced by a repo-wide static assertion — see Testing).

**Navigation.** A new `OrdersStack` is nested inside `HomeStack`. Three routes: `OrderDraft` (entry), `AddToOrder` (modal-style presentation), `OrderSummary`. Entry from `ClientProfileScreen` pushes `OrderDraft` with a `clientId` param, resolving/creating the draft in an effect. Entry from Home's "Drafts in progress" card pushes `OrderDraft` with an `orderId` param. AddToOrder is pushed from the catalog when the catalog is opened in "order context" (route param `inOrderId`). Catalog itself gains a minimal non-breaking affordance — a sticky bottom summary bar reading "N itens · R$ X" + "Voltar ao pedido" — rendered only when `inOrderId` is present.

**Status gate.** `ordersService` exposes exactly three state-transition methods: `createDraft(clientId)`, `send(orderId)`, `cancel(orderId)`. The orders table has a runtime assertion (enforced in the service layer by a `Status` TS union + a repo-level `assertValidStatus` guard in every write path) that rejects any value other than `'draft' | 'sent' | 'canceled'`. Since writes go through the service, and the service is the only writer, D4 is enforced statically and at runtime. The audit query that powers SC-003 is `SELECT DISTINCT status FROM orders` run in a dev-only diagnostic.

**Send handoff is a stub for now.** `send(orderId)` transitions status to `'sent'`, stamps `sent_at_ms = Date.now()`, and emits a no-op in this feature. The actual PDF-generation + email handoff is a later feature (R4); the spec's Assumptions already flag this. When that feature ships, it subscribes to "order transitioned to sent" (either by observing `orders` where `status = 'sent'` or by an explicit call after the transition — to be decided in its own plan, not here).

**Responsive strategy.** Duplicates the established pattern from 006/007/008 — a local `useViewport()` returning `'phone' | 'tablet'` at 768 pt; each screen component branches layout inline. OrderDraft/Tablet and OrderSummary/Tablet use a two-column split (list + sidebar); AddToOrder/Tablet uses a product-left / controls-right split. Shared presentational components (`QtyStepper`, `DiscountControl`, `TotalsBreakdown`, `OrderLineCard`) carry viewport-agnostic typography scale but accept size props where a tablet tightens/loosens density.

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001–008).

**Primary Dependencies**:

- `@nozbe/watermelondb` — already installed (002). This feature adds migration v3 (`discount_mode` column on `orders` and `order_items`) and introduces the first write paths to `orders` / `order_items` from the app.
- `@react-navigation/native-stack` — already installed (001). One new nested stack `OrdersStack` added inside `HomeStack`. Three new routes: `OrderDraft`, `AddToOrder`, `OrderSummary`.
- `@/data` — existing repositories. This feature adds `ordersRepository` + `orderItemsRepository` (first write-capable repositories; catalog and clients are read-heavy until their own CRUD landed).
- `@/features/clients` — reuses `useActiveSalespersonId()` (already barrel-exported since 007) to resolve the salesperson owner on order creation. Reuses `ClientProfileScreen` by adding a "Novo pedido" button to its `bottomAction` region.
- `@/features/catalog` — reuses the existing `CatalogScreen` and `ProductDetailScreen` by extending them with an optional `inOrderId` route param that, when present, swaps the primary CTA from "Detalhes" to "Adicionar ao pedido" and adds the sticky bottom summary bar. No catalog business logic changes.
- `@/features/home` — no code change. Home's existing `useDraftsSummary` placeholder hook (shipped in 008) is replaced by a real implementation in this feature, under the same path and shape (`() => { count: number }`), so Home does not need a rebuild; only the behind-the-scenes file changes.
- No new npm package. No new Expo module. No new dev-client build.

**Storage**:

- **Migration v3**: adds `discount_mode` (string, not null, default `'amount'`) to `orders` and `order_items`. One migration step that calls `addColumns` on both tables. No data migration needed (no pre-existing rows).
- **New writes**: `orders` and `order_items` get their first application-code writes. All writes go through `ordersService` which runs inside `database.write(...)` actions (WatermelonDB's transactional unit).
- **Observations**: `ordersRepository.observeDrafts(salespersonId)` (for Home), `ordersRepository.observeById(orderId)` (for OrderDraft + OrderSummary), `orderItemsRepository.observeByOrder(orderId)` (for the line list). All three are thin wrappers over `collection.query(...).observe()`.
- **No Supabase change**. Remote schema already matches; the new column is added remotely only at sync time (D1). Confirmation: the sync payload shape in `runPass` already serializes all columns of `orders` and `order_items`; the new column rides through with no code change. RLS on `orders` and `order_items` is unchanged (they scope by `salesperson_id` already; this feature does not alter the policy).

**Testing**: Constitution §9 — business-logic coverage first. Unit tests ship for:

1. **Total derivation** (`computeOrderTotals.test.ts`): subtotal sums qty × unit_price; line discounts apply in both modes (`amount` and `percent`); order-level discount applies to post-line subtotal; total is clamped to ≥ 0 (FR-016); zero-item order has zero subtotal/total; `percent > 100` clamps to 100; `amount > subtotal` clamps to subtotal. Pure function, no DB, no mocks.
2. **Status transitions** (`ordersService.transitions.test.ts`): `createDraft` writes status=`draft`; `send` with ≥ 1 line transitions to `sent`; `send` on empty draft throws; `cancel` from `draft` transitions to `canceled`; `send` or `cancel` on already-`sent` / `canceled` throws (FR-012); any direct write with an invalid status value is rejected by `assertValidStatus`.
3. **Discount persistence invariants** (`ordersService.discounts.test.ts`): setting a line discount writes only to `order_items`; setting an order discount writes only to `orders`; neither write path touches `products` or `product_variants` (verified by asserting on a test database the row versions of catalog tables before/after — SC-004 lock).
4. **Draft persistence across "restart"** (`ordersService.persistence.test.ts`): create a draft, add 3 items with qty + discounts, tear down the database instance and reopen it, read the draft back — every field matches (SC-002 lock).
5. **Drafts-summary rewiring** (`useDraftsSummary.test.ts` edited): replaces the placeholder locked in 008 with a real observation over `ordersRepository.observeDrafts(salespersonId)`; returns `{ count: 0 }` when no drafts; reflects repository additions within a tick. The existing placeholder test file from 008 is deleted and replaced.
6. **Screen smoke** (`OrderDraftScreen.test.tsx`, `OrderSummaryScreen.test.tsx`, `AddToOrderScreen.test.tsx`): each screen mounts with a seeded draft and renders the expected headings + at least one interactive control. Full interaction testing is deferred to manual QA on both viewports.
7. **Static `products`/`product_variants` write-free assertion** (`noCatalogWrites.test.ts`): scans `src/features/orders/**` for any reference to `productsCollection.create|update|destroy|prepareUpdate|prepareCreate|prepareDestroyPermanently` or the same on `productVariantsCollection`. Asserts zero matches. This is the SC-004 repo-wide lock in source form — a second layer beyond the runtime persistence test.

UI verification is manual against the six Pencil frames on both viewports, covering the 3 representative paths: (a) empty-profile → new draft → 3 items with one line discount → summary with order discount → send; (b) draft reopened after app kill → verify state; (c) draft canceled → verify removed from Home drafts list.

**Target Platform**: iOS 13+ and Android 7+ (inherited). No platform-specific API.

**Project Type**: Mobile app — pure feature-module addition on top of 001–008. No backend code. One schema migration (WatermelonDB-side; the remote column is written via sync). No Edge Function. No RLS change.

**Performance Goals**:

- SC-001 (90 s assembly) is achievable because every mutation writes to WatermelonDB synchronously inside a `database.write(...)` action — measured on 001/002's bench, a single-row `create` or `update` runs under 15 ms on baseline devices. Five adds + one line discount + one order discount + one send = ~8 writes, total DB time under 150 ms across the whole flow, which is imperceptible inside the 90 s user budget.
- OrderDraft's line list renders under 200 ms from open on a draft with up to 50 items (the plausible upper bound for one visit). Achieved by rendering the list as a plain `View`-mapped `.map(...)` — 50 items well fits the phone viewport's virtualization budget without `FlatList`; we avoid `FlatList` for this screen because OrderDraft must also render the footer inline with the list and the sticky footer is simpler without virtualization. If a future visit blows the 50-item assumption, revisit.
- Totals recompute in < 1 ms per change because `computeOrderTotals` is O(n) over items and n < 50. No memoization needed at the MVP scale.

**Constraints**:

- **Offline-first (P1)**: every action is local. No network call is initiated anywhere in this feature. The future PDF/email handoff will introduce its own network path; today's `send` is a pure local status transition.
- **No modal-alert pattern (constitution-wide, reinforced in 008)**: the cancel confirmation uses an inline two-step affordance (tap "Cancelar rascunho" → the button morphs into "Confirmar cancelamento" for 3 seconds) rather than `ConfirmModal`. This follows UX4's "sync feedback that is discreet but present" spirit — cancel is not a sync event, but it is a state-change event that deserves the same discreet treatment. `ConfirmModal` (008) remains the correct primitive for the logout confirmation it was built for; cancel-draft is a different pattern, closer to an inline undo. Rationale recorded here so the next reader does not try to generalize.
- **Role (UX6 / D7)**: `OrdersStack` sits on `HomeStack`, which is the VENDEDOR surface. Admin does not get this stack. No role guard is added at screen level — the nav tree itself is the gate.
- **Portrait-only (UX5)**: inherited lock.
- **Language (constitution §9)**: English identifiers; Portuguese UI copy centralized in each screen/component; database enum values (`draft`, `sent`, `canceled`, `amount`, `percent`) are English.

**Scale/Scope**:

- **~18 new source files + 7 unit-test files** under `src/features/orders/`, plus **2 data-layer files** (`ordersRepository.ts`, `orderItemsRepository.ts`) and **1 schema migration**. Breakdown: 3 screen components (`OrderDraftScreen`, `AddToOrderScreen`, `OrderSummaryScreen`), 5 presentational components (`OrderLineCard`, `QtyStepper`, `DiscountControl`, `TotalsBreakdown`, `OrderHeaderChip`), 1 service (`ordersService.ts` with `createDraft`, `addItem`, `updateLineQty`, `removeLine`, `setLineDiscount`, `setOrderDiscount`, `send`, `cancel`), 1 totals module (`computeOrderTotals.ts` + `types.ts`), 3 hooks (`useDraftOrder`, `useOrderItems`, `useOrderTotals`), 1 local `useViewport.ts` (duplicated per 006/007/008 pattern), 1 barrel `index.ts`, 1 stack definition (`OrdersStack.tsx`), 1 nav types extension.
- **Existing files edited**: `src/data/schema/tables.ts` (+ `discount_mode` on 2 tables), `src/data/schema/migrations.ts` (v2 → v3 step), `src/data/models/Order.ts` (+ `discountMode` field), `src/data/models/OrderItem.ts` (+ `discountMode` field), `src/app/navigation/HomeStack.tsx` (mount `OrdersStack`), `src/app/navigation/types.ts` (+ `OrdersStackParamList` + route-level `inOrderId` param on the catalog stack), `src/features/catalog/screens/CatalogScreen.tsx` (sticky bottom summary when `inOrderId` present; no other logic change), `src/features/catalog/screens/ProductDetailScreen.tsx` (swap primary CTA when `inOrderId` present), `src/features/clients/screens/ClientProfileScreen.tsx` (add "Novo pedido" CTA to `bottomAction`), `src/features/home/summaries/useDraftsSummary.ts` (replace 008 placeholder with real observation; delete old placeholder test), `src/features/home/summaries/useLastSentOrder.ts` (can stay as placeholder for now — not load-bearing for 009's success criteria; 010+ can replace). Total: ~12 existing files touched, all additive or parameter-gated.
- **0 new npm packages**. **0 Supabase schema changes at plan time** (migration rides in through normal Watermelon sync when the remote tables receive their first row with `discount_mode`; Supabase's schema already has `discount_amount` as numeric — the new column will be added to the remote schema by a follow-up DDL done in the plan's Phase 1 quickstart). Actually — **reconsidered**: the remote column MUST exist before the first `push` containing it, else sync fails. Adding a DDL step to Supabase is non-optional. See research R-004.
- **1 Supabase DDL** (ALTER TABLE on `orders` and `order_items` to add `discount_mode text not null default 'amount'`) is tracked as a Setup-phase task in tasks.md. No RLS change; the existing policy on `(salesperson_id = auth.uid())` continues to apply to the whole row.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | Every mutation writes to WatermelonDB before the UI acknowledges it. `send` and `cancel` are local status transitions with no network call. No screen blocks on network. |
| P2 Local DB is source of truth | ✅ | Pass | The draft row is the cart. Observations drive the UI. Sync carries the finished row upstream later. |
| P3 MVP simplicity | ✅ | Pass | No new dependency. `OrdersStack` is a standard nested stack, not a novel pattern. `useViewport` duplicated from 006/007/008 per the documented "duplicate before abstracting" rule. Discount shape is stored as mode+value rather than a richer object — one migration column, not a whole new table. |
| P4 Reuse free tools | ✅ | Pass | No admin UI. No custom backend. The catalog browsing surface is reused, not rebuilt. |
| P5 Salesperson data is sacred | ✅ | Pass | Persist-on-mutation model: the draft row exists and is up-to-date at every moment. App kill loses zero state because state is not in memory. FR-003 and SC-002 both fall out of this architecture. |
| P6 Admin is online-first | N/A | — | This feature is VENDEDOR-only. |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | No new native module. No dev-client change. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | One schema migration. All writes in `database.write(...)` actions. |
| §3 Mandatory — Supabase | ✅ | Pass | One additive DDL (new column, nullable-with-default). No RLS change. |
| §3 Forbidden — custom backend / Firebase / heavy state mgmt | ✅ | Pass | None introduced. Hooks are thin `useSyncExternalStore`-style wrappers over Watermelon observations. |
| §3 Forbidden — heavy UI libraries | ✅ | Pass | RN core + existing primitives (`ConfirmModal` from 008 is NOT pulled in for cancel — rationale in Constraints). |
| R1 WatermelonDB is the single client data layer (VENDEDOR) | ✅ | Pass | All reads + writes through Watermelon. Sync is the only code path that talks to Supabase. |
| R2 Seven entities | ✅ | Pass | No new entity. Uses `orders`, `order_items`, `products`, `product_variants`, `clients`. `user_roles` not touched. |
| R3 Images in Storage | N/A | — | No images in this feature. |
| R4 PDF local, email via system | N/A (at this phase) | — | `send` is a status transition only; PDF/email is a later feature. |
| **R5 Discounts on order + order_item, never on product** | ✅ | **Pass — central invariant** | Enforced by (a) `ordersService` API shape — no method ever receives a product id as target; (b) the static `noCatalogWrites.test.ts` asserting zero references to catalog-table write APIs under `src/features/orders/**`; (c) the persistence test that diffs catalog rows before/after a full flow. |
| **UX1 Tap, not type** | ✅ | **Pass — with explicit secondary path** | Steppers are primary on every qty and discount surface. Numeric keyboard is allowed for qty and for `R$` discount (per design feedback captured in `feedback_ux1_input_modes`). `%` discount stays stepper-only. |
| UX2 Repeat previous order is first-class | ✅ | Pass (deferred) | Out of scope for 009 — belongs to a future feature that reads `orders` with status `sent`. This plan does not block it; the data shape written here is the shape it will read. |
| UX3 Useful empty states | ✅ | Pass | OrderDraft with 0 items shows a localized hint ("Adicione itens do catálogo para começar"); the "Enviar pedido" CTA is disabled (FR-010). |
| UX4 Sync feedback discreet | ✅ | Pass | No feature-specific sync surface. Home's sync pill (008) continues to be the single surface. |
| UX5 Layouts serve phone and tablet | ✅ | Pass | Six frames shipped (3 screens × 2 viewports). Responsive strategy documented in Summary + Design Prerequisite. |
| UX6 Dual-role visibility | N/A | — | Seller-only feature. |
| **D4 Orders use simple local statuses** | ✅ | **Pass — enforced statically + at runtime** | TypeScript union `Status = 'draft' \| 'sent' \| 'canceled'`; every write path through the service calls `assertValidStatus`; SC-003 audit query lives in `src/dev/auditStatuses.ts` for manual verification. |
| D5 / D6 Auth + biometric | N/A | — | No auth-surface change. |
| D7 Role-based authorization | N/A | — | No role-guarded surface touched. |
| §9 English in code / Portuguese in copy | ✅ | Pass | Enum values and identifiers in English; UI strings in Portuguese, centralized per screen. |

**Gate result: PASS.** No violations — no Complexity Tracking entries.

## Role & Authorization Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Does this feature expose or touch role-guarded surfaces?** **No.**

This feature is scoped entirely to VENDEDOR field flows. It does not introduce or modify any screen under `src/features/admin/`, it does not write to any D7-guarded table (`products`, `product_variants`, `salespeople`, `clients`, `user_roles`), it does not change which roles see which affordance, and it does not introduce any Edge Function. Writes are to `orders` and `order_items`, which are already scoped by `(salesperson_id = auth.uid())` RLS (established in 001/002 and unchanged by this feature).

N/A (no role-guarded surfaces).

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

**Does this feature have a UI?** **Yes.** Spec lists six screens; `design/screens.md` and `design/design.json` were generated by `/speckit-pencil-design` on 2026-04-23.

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | Three logical screens, six frames |
| `design/screens.md` exists | ✅ | [design/screens.md](./design/screens.md) |
| Phone frames cover all screens | ✅ | OrderDraft / Phone, AddToOrder / Phone, OrderSummary / Phone |
| Tablet frames cover all screens | ✅ | OrderDraft / Tablet, AddToOrder / Tablet, OrderSummary / Tablet |
| Responsive strategy documented below | ✅ | See Summary "Responsive strategy" + Structure Decision |

**Design pointer**: `specs/009-order-assembly/design.json`.

## Project Structure

### Documentation (this feature)

```text
specs/009-order-assembly/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ordersService.md # Public service surface
├── design/              # from /speckit-pencil-design
│   ├── screens.md
│   ├── order-draft-phone.png
│   ├── order-draft-tablet.png
│   ├── add-to-order-phone.png
│   ├── add-to-order-tablet.png
│   ├── order-summary-phone.png
│   └── order-summary-tablet.png
├── design.json
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── data/
│   ├── schema/
│   │   ├── tables.ts                       # EDIT: + discount_mode on orders + order_items
│   │   └── migrations.ts                   # EDIT: + schema v3 migration step
│   ├── models/
│   │   ├── Order.ts                        # EDIT: + discountMode field
│   │   └── OrderItem.ts                    # EDIT: + discountMode field
│   └── repositories/
│       ├── ordersRepository.ts             # NEW: observeDrafts, observeById, CRUD helpers
│       └── orderItemsRepository.ts         # NEW: observeByOrder, CRUD helpers
│
├── features/
│   ├── orders/                             # NEW feature module
│   │   ├── screens/
│   │   │   ├── OrderDraftScreen.tsx
│   │   │   ├── AddToOrderScreen.tsx
│   │   │   └── OrderSummaryScreen.tsx
│   │   ├── components/
│   │   │   ├── OrderLineCard.tsx
│   │   │   ├── QtyStepper.tsx
│   │   │   ├── DiscountControl.tsx
│   │   │   ├── TotalsBreakdown.tsx
│   │   │   └── OrderHeaderChip.tsx
│   │   ├── hooks/
│   │   │   ├── useDraftOrder.ts
│   │   │   ├── useOrderItems.ts
│   │   │   ├── useOrderTotals.ts
│   │   │   └── useViewport.ts              # local copy (P3 duplicate rule)
│   │   ├── services/
│   │   │   └── ordersService.ts            # createDraft, addItem, updateLineQty, removeLine, setLineDiscount, setOrderDiscount, send, cancel
│   │   ├── totals/
│   │   │   ├── computeOrderTotals.ts       # pure function
│   │   │   └── types.ts                    # OrderTotals, DiscountMode, DiscountValue
│   │   ├── guards/
│   │   │   └── assertValidStatus.ts        # D4 runtime gate
│   │   └── index.ts                        # barrel
│   │
│   ├── catalog/screens/
│   │   ├── CatalogScreen.tsx               # EDIT: sticky bottom summary when inOrderId
│   │   └── ProductDetailScreen.tsx         # EDIT: CTA swap when inOrderId
│   │
│   ├── clients/screens/
│   │   └── ClientProfileScreen.tsx         # EDIT: "Novo pedido" in bottomAction
│   │
│   └── home/summaries/
│       ├── useDraftsSummary.ts             # EDIT: replace 008 placeholder with real observation
│       └── useDraftsSummary.test.ts        # EDIT: test against real observation
│
├── app/
│   └── navigation/
│       ├── OrdersStack.tsx                 # NEW: OrderDraft / AddToOrder / OrderSummary routes
│       ├── HomeStack.tsx                   # EDIT: mount OrdersStack
│       └── types.ts                        # EDIT: + OrdersStackParamList, + inOrderId on catalog routes
│
└── dev/
    └── auditStatuses.ts                    # NEW: diagnostic for SC-003 (manual)

tests/
└── (co-located with the files they test — same convention as 001–008)
```

**Structure Decision**: Single RN app, one new feature module (`src/features/orders/`), one schema migration, one stack, one Supabase DDL. Responsive strategy: each screen component reads `useViewport()` and branches layout inline (stack-on-phone, split-on-tablet), sharing presentational components across viewports. This mirrors the 008 approach exactly — no new architectural shape is introduced.

## Complexity Tracking

No Constitution Check violations. This section is intentionally empty.
