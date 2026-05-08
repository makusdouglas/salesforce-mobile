# Implementation Plan: Repeat Past Order

**Branch**: `010-repeat-last-order` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-repeat-last-order/spec.md`

## Summary

Add two repeat entry points to `ClientProfileScreen` — a dark primary "Repetir último pedido" hero card above the history list, and a circular ↺ icon button on every history row — so the salesperson can clone any past order into a new draft in a single tap and land on the existing `OrderSummaryScreen` already ready to send. The four Pencil frames touched by this feature (ClientProfile × phone+tablet edited in place; OrderSummary × phone+tablet reused unchanged) are the primordial UI source.

**No new screens, no new navigation, no new data entities.** The entire feature reuses the `OrdersStack` and `OrderSummaryScreen` shipped in 009. The "landed draft" the salesperson sees is an ordinary `orders` row with ordinary `order_items` — produced by one new service method, `ordersService.repeat(...)`.

**One-method service extension.** `ordersService.repeat({ sourceOrderId })` wraps the existing `createDraft → addItem → setLineDiscount → setOrderDiscount` chain inside a single `database.write(...)` action so the cloned draft is atomically persisted (P5). It copies per-line `quantity` and `discountAmount`/`discountMode`, copies the order-level `discountAmount`/`discountMode`, and — critically — resolves each line's `unitPrice` from the **current** `product_variants.price`, not from the source order's snapshot. Catalog-table writes are still zero, preserved by the existing `noCatalogWrites.test.ts` scan (009) which is extended to also cover `src/features/clients/**` and the new repeat code path.

**Availability gate.** For every line on the source order, `repeat` looks up the variant via `productVariantsRepository.findById`. If the variant row is soft-deleted (`_status = 'deleted'`) or its parent product is soft-deleted, that line is dropped and its product name is collected. If every source line drops, `repeat` throws `AllItemsUnavailableError` and the UI presents a blocking message on the client profile without creating any draft (FR-008). Otherwise, `repeat` returns `{ orderId, droppedProductNames }` and the caller navigates to `OrderSummary` with a `droppedNames` route param that the summary renders as a non-dismissable notice (FR-007).

**Draft short-circuit.** A ↺ tap whose source has status `draft` does **not** call `repeat`; it navigates straight to `OrderSummary` with that draft's id (FR-011). This rule lives in the hook `useRepeatOrder` as a status branch, not inside `ordersService.repeat` — the service method is intentionally total (clone only), and the resume-vs-clone policy is a UI-layer concern.

**Hero data.** The hero CTA needs the client's most recent *sent* order with date, item count, and total. A new repository observation `ordersRepository.observeLastSentForClient(clientId)` returns the single most-recent row with `status = 'sent'` (ordered by `sent_at_ms desc`). The item count + total are derived by the existing `computeOrderTotals` pure function (009) on the observed order + its items. No DB denormalisation.

**Tap accounting.** Constitution §5 UX2 requires ≤ 2 taps from client profile to sendable draft. Both repeat paths meet this: tap 1 = hero card or row ↺ → synchronously lands on `OrderSummaryScreen`; tap 2 = "Enviar". This plan therefore explicitly rejects any intermediate "confirm repeat" dialog, any async spinner that blocks navigation, and any pattern that moves the cloned draft creation to the landing screen's mount effect (which would double the perceived latency).

**Responsive strategy.** Same model as 009 — `useViewport()` returning `'phone' | 'tablet'` at 768 pt; `ClientProfileScreen` already branches layout by viewport (feature 008). This feature adds two new visual chunks to that screen: a `RepeatHeroCard` component above the history list, and a `RepeatIconButton` slot on each `OrderHistoryRow`. Both chunks are viewport-agnostic at the typography/density level and render inside whichever column `useViewport()` already chose (phone: single column; tablet: right column of the split). The `OrderSummaryScreen` (009) needs a small addition: a notice banner that renders when `droppedNames.length > 0`, inserted above the line list. No layout branch change in the summary screen.

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001–009).

**Primary Dependencies**:

- `@nozbe/watermelondb` — already installed. This feature adds **zero** migrations. The `orders` and `order_items` shape from 009 (including `discount_mode`) is sufficient.
- `@react-navigation/native-stack` — already installed. **No new stack, no new route.** The existing `OrderSummary` route in `OrdersStack` (009) is the landing target; this feature only adds an optional `droppedNames?: string[]` route param on it.
- `@/data/repositories/ordersRepository` — EDIT: add `observeLastSentForClient(clientId)` and `findById(orderId)` (if not already present). Repeat operations are performed via the existing `create` + `update` write API.
- `@/data/repositories/orderItemsRepository` — EDIT: add `findByOrder(orderId)` (if not already present; 009 already exposes `observeByOrder`). Repeat clones through the existing `create` API.
- `@/data/repositories/productVariantsRepository` — reused as-is. `findById` already returns `null` for deleted variants, which is exactly the signal the availability gate needs. No repo change.
- `@/features/orders/services/ordersService` — EDIT: add `repeat(input: RepeatInput): Promise<RepeatResult>`. No other method changes.
- `@/features/orders/totals/computeOrderTotals` — reused as-is for the hero card's "X itens · R$ Y" subtitle.
- `@/features/orders/screens/OrderSummaryScreen` — EDIT: accept an optional `droppedNames?: string[]` route param and render a sticky notice banner above the lines when non-empty.
- `@/features/clients/screens/ClientProfileScreen` — EDIT: mount `RepeatHeroCard` above the history list; add a `repeat` slot to each row; replace the single "Novo pedido" bottomAction (phone) / topBar (tablet) with its demoted secondary variant ("Novo pedido em branco"), styled per the design summary.
- **No new npm package. No new Expo module. No new dev-client build. No Supabase change. No RLS change. No Edge Function. No migration.**

**Storage**:

- **Schema**: unchanged. The feature adds no column, no table, no index. Everything it needs is already present.
- **New observation**: `ordersRepository.observeLastSentForClient(clientId)` — `orders.query(Q.where('client_id', clientId), Q.where('status', 'sent'), Q.sortBy('sent_at_ms', Q.desc), Q.take(1)).observe()`. Returns an `Observable<Order | null>`. Backed by the existing Watermelon index on `client_id` (001) and a sort over `sent_at_ms`, which is indexed server-side and locally narrow enough (≤ few hundred rows per client in MVP) that no additional index is required.
- **New write path**: `ordersService.repeat` wraps N+3 writes (1 order create, N line creates, 1 order update for order-level discount, 1 optional mutation if needed) inside a single `database.write(...)` action. Atomic per WatermelonDB semantics: if any write throws (e.g. a race where the source order is deleted mid-repeat), the whole clone rolls back and no half-draft persists.
- **No Supabase change**. Draft rows created by repeat are serialized and pushed by the existing sync engine (005) with no alteration — they are just another `orders` row. RLS on `(salesperson_id = auth.uid())` continues to apply; this feature does not touch any D7-guarded table.

**Testing**: Constitution §9 — business-logic coverage first.

1. **`ordersService.repeat.test.ts`** — the behaviour lock for this feature.
   - Cloning copies: every line's `product_variant_id`, `quantity`, `discount_amount`, `discount_mode` match the source; order-level `discount_amount` + `discount_mode` match the source; new `unit_price` is read from the *current* `product_variants.price`, not the source snapshot (set up with a variant whose price changed between source creation and repeat).
   - Identity guarantees: the returned `orderId` is different from the source; the source order row is untouched (SC-006 lock — diff the source Order row before/after); the returned order has `status = 'draft'` and `sent_at_ms = null`.
   - Availability gate: when one variant is soft-deleted, its line is dropped and its product name appears in `droppedProductNames`; when every variant is soft-deleted, the call throws `AllItemsUnavailableError` and **no** `orders` row is created (verified by counting rows before/after).
   - Draft short-circuit (negative case): `repeat` called against a source with status `draft` throws `CannotRepeatDraftError` — the resume policy is enforced at the service boundary so the hook can rely on it.
   - Atomicity: injecting a failing variant lookup mid-clone rolls back the new draft (count of `orders` unchanged, count of `order_items` unchanged).

2. **`useRepeatOrder.test.ts`** — the hook that owns status-branching.
   - Given source status `sent`/`canceled`/any non-draft: calls `ordersService.repeat(...)` and returns `{ orderId, droppedNames }`.
   - Given source status `draft`: does NOT call `ordersService.repeat`; returns the source's own `orderId` with `droppedNames: []` (resume).
   - Error propagation: `AllItemsUnavailableError` surfaces as a discriminated union `{ kind: 'blocked', reason: 'all_unavailable' }` so the screen can render the FR-008 message without catching exceptions in render code.

3. **`observeLastSentForClient.test.ts`** — repository observation lock.
   - Emits `null` when the client has no sent orders.
   - Emits the single most-recent sent order when multiple exist.
   - Ignores orders with status `draft` or `canceled`.
   - Reacts to a subsequent `markSent` by emitting the new row.

4. **Screen smoke**:
   - `ClientProfileScreen.test.tsx` (edited): mounts with a seeded sent order and asserts the `RepeatHeroCard` renders with the correct date/count/total; mounts with an empty-history client and asserts zero repeat affordances are rendered (FR-015).
   - `OrderSummaryScreen.test.tsx` (edited from 009): when mounted with `droppedNames: ['Leite Integral 1L']`, renders the notice banner containing the product name above the line list; when mounted without the param, renders unchanged.

5. **Static `noCatalogWrites.test.ts` widened** (from 009): the scanner now also walks `src/features/clients/**` and the new `useRepeatOrder.ts` to assert zero references to catalog-table write APIs along the repeat code path. R5 stays locked as the service surface grows. The same scanner adds a second assertion — zero references to `fetch`, `global.fetch`, `@supabase/`, or any `@/data/sync/...` import along `ordersService.repeat`, `useRepeatOrder`, `RepeatHeroCard`, and `RepeatIconButton` — enforcing FR-016 (the clone path is offline-only) as a static guarantee.

UI verification is manual against the four Pencil screens on both viewports, covering the four P1–P2 stories: (a) hero repeat → send in ≤ 2 taps; (b) row ↺ on a non-latest order → send; (c) row ↺ on a Draft → resume (no clone, same draft id on summary); (d) price-changed + one-item-unavailable → notice banner visible on summary.

**Target Platform**: iOS 13+ and Android 7+ (inherited). No platform-specific API.

**Project Type**: Mobile app — pure feature-module extension. No backend code. No schema migration. No Edge Function. No RLS change.

**Performance Goals**:

- SC-001 (≤ 2 taps) + SC-004 (< 10 s median) are architectural, not compute-bound. The dominant time is the OS tap→navigation animation (~300–400 ms × 2 = ≤ 1 s) plus user think time on the summary. Compute budget:
  - `repeat` on a 10-line source: 1 order create + 10 line creates + 1 order update = 12 DB writes inside one transaction, well under 100 ms on the 009 bench. Variant lookups are 10 indexed reads, < 5 ms total.
  - `observeLastSentForClient` is a single `sent_at_ms desc LIMIT 1` query over an already-client-scoped index; re-runs on every sent order change, which the UI subscribes to via WatermelonDB's observable — < 5 ms per recomputation on a client with hundreds of past orders.
- No memoization, no deferred rendering, no `InteractionManager.runAfterInteractions` needed at MVP scale.

**Constraints**:

- **Offline-first (P1)**: every action is local. `repeat` makes zero network calls. Cloning a 5-year-old order works without Wi-Fi.
- **Portrait-only (UX5)**: inherited.
- **Role (UX6 / D7)**: the screens touched live on the VENDEDOR surface (`HomeStack` → `ClientProfileScreen` and `OrdersStack` → `OrderSummaryScreen`); no role-guarded surface is introduced or modified.
- **No modal-alert pattern**: the "all items unavailable" block (FR-008) uses an inline non-dismissable notice rendered on `ClientProfileScreen` in place of the hero card, not a `ConfirmModal`. Same rationale as 009's cancel-draft treatment.
- **Language (§9)**: English identifiers; Portuguese UI copy centralized per screen; no new DB enum values.
- **Tap budget is the architectural gate, not a metric.** Every design decision defers to it: the `repeat` method is synchronous from the UI's perspective (awaited inside the tap handler, which then navigates), so the salesperson lands on a fully-populated summary — never on a spinner.

**Scale/Scope**:

- **~6 new source files + 4 unit-test files** under `src/features/orders/` and `src/features/clients/`. Breakdown: 1 new service method (edit `ordersService.ts`), 1 new hook (`useRepeatOrder.ts`), 1 new component (`RepeatHeroCard.tsx`), 1 new presentational button (`RepeatIconButton.tsx`), 1 new observation (edit `ordersRepository.ts`), 1 optional-param addition to `OrderSummaryScreen.tsx` + 1 new `DroppedItemsNotice.tsx` component.
- **Existing files edited**: `src/features/orders/services/ordersService.ts` (+ `repeat` + error types), `src/data/repositories/ordersRepository.ts` (+ `observeLastSentForClient`), `src/features/orders/screens/OrderSummaryScreen.tsx` (+ notice banner + route param), `src/features/clients/screens/ClientProfileScreen.tsx` (+ `RepeatHeroCard` slot + per-row ↺ + demote "Novo pedido"), `src/app/navigation/types.ts` (+ `droppedNames?: string[]` on `OrderSummary` route param), `src/features/orders/noCatalogWrites.test.ts` (widened scan root). Total: ~6 existing files touched, all additive or parameter-gated.
- **0 new npm packages**. **0 new DB columns**. **0 new navigation routes**. **0 Supabase changes**.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | `repeat` makes zero network calls. Hero observation reads local-only. |
| P2 Local DB is source of truth | ✅ | Pass | Clone is an atomic local transaction; the cloned draft becomes source of truth immediately. |
| P3 MVP simplicity | ✅ | Pass | No new dependency, no new screen, no new stack, no new route, no migration. One service method, one observation, two small components. Reuses `OrderSummaryScreen` instead of introducing a "Repeat summary" variant. |
| P4 Reuse free tools | ✅ | Pass | No new tool. |
| P5 Salesperson data is sacred | ✅ | Pass | Clone writes inside a single `database.write(...)` action — either the whole draft materializes or nothing does; the source is never mutated. |
| P6 Admin is online-first | N/A | — | VENDEDOR-only feature. |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | No native module added. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | All clone ops inside `database.write`. |
| §3 Mandatory — Supabase | ✅ | Pass | No schema change. Draft rides normal sync. |
| §3 Forbidden — custom backend / Firebase / heavy state mgmt | ✅ | Pass | None introduced. |
| §3 Forbidden — heavy UI libraries | ✅ | Pass | Only the existing RN core + feature-009 primitives. |
| R1 WatermelonDB is the single client data layer (VENDEDOR) | ✅ | Pass | All reads/writes through Watermelon repositories. |
| R2 Seven entities | ✅ | Pass | No new entity; reads `orders`, `order_items`, `product_variants`, `products` (via variant resolution), `clients`. |
| R3 Images in Storage | N/A | — | No images. |
| R4 PDF local, email via system | N/A | — | Send handoff is unchanged from 009. |
| **R5 Discounts on order + order_item, never on product** | ✅ | **Pass** | `repeat` only writes to `orders` and `order_items`. Catalog-write ban is re-asserted by the widened `noCatalogWrites.test.ts` scan. |
| **UX1 Tap, not type** | ✅ | Pass | No new input modes. Hero card and ↺ are tap-only affordances. |
| **UX2 Repeat previous order is first-class** | ✅ | **Pass — central invariant** | This feature fulfils UX2 and goes beyond it (any past order, not only the most recent). Hero is the primary CTA on `ClientProfile`, not hidden in a menu (FR-001/002). Max 2 taps to ready-to-send (FR-012). |
| UX3 Useful empty states | ✅ | Pass | Empty history falls back to the existing `ClientProfileEmpty`; all-unavailable state renders a clear inline notice rather than a silent disabled button (FR-008). |
| UX4 Sync feedback discreet | ✅ | Pass | No sync surface in this feature. |
| UX5 Layouts serve phone and tablet | ✅ | Pass | Four frames shipped (ClientProfile × 2 edited in place; OrderSummary × 2 reused). Responsive strategy documented above. |
| UX6 Dual-role visibility | N/A | — | Seller-only surfaces. |
| D4 Orders use simple local statuses | ✅ | Pass | Clone produces `draft`; no new status. `assertValidStatus` continues to guard writes via 009's service methods. |
| D5 / D6 Auth + biometric | N/A | — | No auth-surface change. |
| D7 Role-based authorization | N/A | — | No role-guarded surface touched. |
| §9 English in code / Portuguese in copy | ✅ | Pass | Service method + hook + error types in English; new UI strings (`"Repetir último pedido"`, `"Abrir resumo"`, `"Novo pedido em branco"`, `"Itens indisponíveis"`) Portuguese, centralized per screen. |

**Gate result: PASS.** No violations — no Complexity Tracking entries.

## Role & Authorization Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Does this feature expose or touch role-guarded surfaces?** **No.**

The feature edits `ClientProfileScreen` (under `src/features/clients/`, VENDEDOR surface) and `OrderSummaryScreen` (under `src/features/orders/`, VENDEDOR surface). It does not introduce or modify any screen under `src/features/admin/`, it does not alter RLS on any D7-guarded table (`products`, `product_variants`, `salespeople`, `clients`, `user_roles`), it does not change which roles see which affordance, and it introduces no Edge Function. Writes are to `orders` and `order_items` only, which remain scoped by `(salesperson_id = auth.uid())` RLS established in 001/002 and reused by 009.

N/A (no role-guarded surfaces).

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

**Does this feature have a UI?** **Yes.** Spec lists four screens; `design/screens.md` and `design/design.json` were generated by `/speckit-pencil-design` on 2026-04-23, then revised after scope confirmation to "repeat any past order".

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | Four frames (ClientProfile × 2 edited; OrderSummary × 2 reused) |
| `design/screens.md` exists | ✅ | [design/screens.md](./design/screens.md) |
| Phone frames cover all screens | ✅ | ClientProfile / Phone, OrderSummary / Phone |
| Tablet frames cover all screens | ✅ | ClientProfile / Tablet, OrderSummary / Tablet |
| Responsive strategy documented below | ✅ | See Summary "Responsive strategy" + Structure Decision |

**Design pointer**: `specs/010-repeat-last-order/design.json`.

## Project Structure

### Documentation (this feature)

```text
specs/010-repeat-last-order/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ordersService.repeat.md  # New service method contract
├── design/              # from /speckit-pencil-design
│   ├── screens.md
│   ├── client-profile-phone.png
│   ├── client-profile-tablet.png
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
│   └── repositories/
│       └── ordersRepository.ts              # EDIT: + observeLastSentForClient(clientId)
│
├── features/
│   ├── orders/
│   │   ├── services/
│   │   │   ├── ordersService.ts             # EDIT: + repeat(input) + AllItemsUnavailableError + CannotRepeatDraftError
│   │   │   └── ordersService.repeat.test.ts # NEW: behaviour lock for repeat
│   │   ├── hooks/
│   │   │   ├── useRepeatOrder.ts            # NEW: status-branching hook (clone vs resume)
│   │   │   └── useRepeatOrder.test.ts       # NEW
│   │   ├── screens/
│   │   │   └── OrderSummaryScreen.tsx       # EDIT: + droppedNames route param + notice banner
│   │   ├── components/
│   │   │   └── DroppedItemsNotice.tsx       # NEW: renders "N itens indisponíveis" banner
│   │   └── noCatalogWrites.test.ts          # EDIT: widen scan to include src/features/clients/**
│   │
│   └── clients/
│       ├── screens/
│       │   └── ClientProfileScreen.tsx      # EDIT: hero + per-row ↺ + demote "Novo pedido"
│       └── components/
│           ├── RepeatHeroCard.tsx           # NEW: primary dark card with last-sent metadata
│           └── RepeatIconButton.tsx         # NEW: circular ↺ button for each row
│
└── app/
    └── navigation/
        └── types.ts                          # EDIT: + droppedNames?: string[] on OrderSummary route param

tests/
└── (co-located with the files they test — same convention as 001–009)
```

**Structure Decision**: Single RN app, no new feature module. All additions sit inside the existing `src/features/orders/` (service + hook + summary banner) and `src/features/clients/` (hero card + icon button + profile edits) feature modules established by 009 and 008. Responsive strategy: reuse `ClientProfileScreen`'s existing `useViewport()` branch (008) — the new `RepeatHeroCard` renders at the top of the content column on phone and at the top of the right column on tablet. `RepeatIconButton` is a self-contained circular slot appended to each history row's right edge in both viewports. No new stack, no new route, no new navigation entry.

## Complexity Tracking

No Constitution Check violations. This section is intentionally empty.
