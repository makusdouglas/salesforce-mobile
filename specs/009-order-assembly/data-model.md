# Phase 1 Data Model — Order Assembly

## Entities

### Order

The order is a row in WatermelonDB's `orders` table. Represents one intent order in one of three states (D4).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | WatermelonDB local id, generated on create. |
| `clientId` | string | FK → `clients.id`. Indexed. Required. |
| `salespersonId` | string | FK → `salespeople.id`. Indexed. Required. Resolved via `useActiveSalespersonId()` at `createDraft` time. |
| `status` | `'draft' \| 'sent' \| 'canceled'` | Stored as string, gated by TS union and `assertValidStatus`. Indexed (Home queries `status = 'draft'`). |
| `discountMode` | `'amount' \| 'percent'` | **NEW in schema v3.** Default `'amount'`. Column: `discount_mode`. |
| `discountAmount` | number | Existing column. Semantic is BRL when `discountMode = 'amount'`, percentage when `discountMode = 'percent'`. Default 0. |
| `notes` | string \| null | Existing column. Unused by this feature; kept for future. |
| `createdAtMs` | number | Existing column. Stamped on create. |
| `sentAtMs` | number \| null | Existing column. Stamped on `draft → sent` transition. |
| `canceledAtMs` | number \| null | **NEW — added in schema v3 alongside `discount_mode`.** Stamped on `draft → canceled` transition. Keeps the two terminal states symmetric. |
| `pdfUri` | string \| null | Existing column. Unused by this feature. |
| `serverId`, `updatedAt` | — | Sync columns, managed by Watermelon. |

**State transitions** (D4):

```
              createDraft
             -------------> draft
                            | |
                      send /   \ cancel
                         v     v
                       sent  canceled
```

Enforced by:

- TypeScript union `Status`.
- Runtime `assertValidStatus(value)` called inside every write path.
- Service-layer guards: `send` refuses if current status ≠ `'draft'`; `cancel` refuses if current status ≠ `'draft'`; `send` refuses if order has 0 line items.
- Supabase `check (status in ('draft', 'sent', 'canceled'))` constraint (already exists from 001).
- Supabase `check (discount_mode in ('amount', 'percent'))` constraint (NEW in 009 DDL).

**Immutability after transition**: once `status != 'draft'`, all item writes and discount writes are rejected at the service layer. The UI hides mutating affordances, but the runtime guard is the authoritative one.

### OrderItem

One line of an order. Stored in `order_items`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Local id. |
| `orderId` | string | FK → `orders.id`. Indexed. |
| `productVariantId` | string | FK → `product_variants.id`. Indexed. |
| `quantity` | number | Integer ≥ 1. Reducing to 0 removes the line. |
| `unitPrice` | number | **Snapshot at add-time.** Captured from `product_variants.price` when the line is created. Immune to later catalog price edits. |
| `discountMode` | `'amount' \| 'percent'` | **NEW in schema v3.** Default `'amount'`. |
| `discountAmount` | number | Existing column. Same semantics as on Order. Default 0. |
| `serverId`, `updatedAt` | — | Sync columns. |

**Relationships**:

- `Order → OrderItem` one-to-many. Deleting an order cascades to items via service-level `destroyPermanently` in one Watermelon transaction (not via DB cascade — Watermelon does not support declarative cascades).

## Derived values (not stored)

### OrderTotals

```ts
type OrderTotals = {
  subtotal: number;        // Σ (qty × unitPrice)  — no discounts applied
  lineDiscountsTotal: number;  // Σ line-discount-resolved-to-amount
  postLineSubtotal: number;    // subtotal − lineDiscountsTotal, clamped ≥ 0
  orderDiscount: number;       // order-level discount resolved to amount, clamped to postLineSubtotal
  total: number;               // postLineSubtotal − orderDiscount, clamped ≥ 0
  perLineTotals: { lineId: string; lineTotal: number }[];
  warnings: DiscountWarning[];
};

type DiscountWarning =
  | { kind: 'line-percent-over-100'; lineId: string }
  | { kind: 'line-amount-over-subtotal'; lineId: string }
  | { kind: 'order-percent-over-100' }
  | { kind: 'order-amount-over-subtotal' };
```

Computed by the pure function `computeOrderTotals(order, items) → OrderTotals`. Called by:

- `OrderDraftScreen` footer (subtotal + total).
- `AddToOrderScreen` preview (per-line derivation for the in-progress line).
- `OrderSummaryScreen` breakdown rows.
- `useDraftsSummary` to compute "R$ X" shown on the Home drafts card.

**Never stored** — always re-derived. This is what makes SC-004 structurally enforceable: there is no cached total hanging around that could drift from reality.

### PerLineTotal derivation

```
lineSubtotal = qty × unitPrice
lineDiscountAmount =
  discountMode === 'percent'
    ? lineSubtotal × (clamp(discountAmount, 0, 100) / 100)
    : clamp(discountAmount, 0, lineSubtotal)
lineTotal = max(0, lineSubtotal − lineDiscountAmount)
```

### Order-level derivation

```
subtotal = Σ lineSubtotal
lineDiscountsTotal = Σ lineDiscountAmount
postLineSubtotal = max(0, subtotal − lineDiscountsTotal)
orderDiscountResolved =
  order.discountMode === 'percent'
    ? postLineSubtotal × (clamp(order.discountAmount, 0, 100) / 100)
    : clamp(order.discountAmount, 0, postLineSubtotal)
total = max(0, postLineSubtotal − orderDiscountResolved)
```

## Schema migration (v2 → v3)

```ts
// src/data/schema/migrations.ts
import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // ... existing v1 → v2 migration ...
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'orders',
          columns: [
            { name: 'discount_mode', type: 'string' },
            { name: 'canceled_at_ms', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'order_items',
          columns: [
            { name: 'discount_mode', type: 'string' },
          ],
        }),
      ],
    },
  ],
});
```

Backfill is a no-op: there are zero orders/order_items rows at the time this migration runs (001–008 never wrote them). The TS model defaults `discountMode` to `'amount'` on read if the column is somehow empty (defensive; shouldn't fire).

## Supabase DDL (runs before first sync push carrying v3 rows)

```sql
alter table public.orders
  add column if not exists discount_mode text not null default 'amount'
  check (discount_mode in ('amount', 'percent'));

alter table public.orders
  add column if not exists canceled_at_ms bigint;

alter table public.order_items
  add column if not exists discount_mode text not null default 'amount'
  check (discount_mode in ('amount', 'percent'));
```

RLS policies on `orders` and `order_items` are unchanged. The existing `salesperson_id = auth.uid()` policy continues to scope access correctly — the new column is not part of the predicate.

## Invariants (enforced in code)

| Invariant | Where enforced |
|-----------|----------------|
| `status ∈ {'draft', 'sent', 'canceled'}` | TS union + `assertValidStatus` in every write path + Supabase `check` constraint. |
| `discount_mode ∈ {'amount', 'percent'}` | TS union + Supabase `check` constraint. Model default `'amount'`. |
| Products and product_variants tables are never written by 009 code | `noCatalogWrites.test.ts` (static repo scan) + runtime persistence test that diffs catalog rows. |
| `send` blocked on empty draft | `ordersService.send` guard; test `ordersService.transitions.test.ts`. |
| `send` / `cancel` only from `draft` | Same guard; same test. |
| Mutations to `sent` or `canceled` orders rejected | Service-layer guard on every mutating method; test same file. |
| Totals are derived, never persisted | No total column exists; `computeOrderTotals` is pure; test `computeOrderTotals.test.ts`. |
| Line `unitPrice` is a snapshot | Service writes `unitPrice` from `product_variants.price` at `addItem` time; subsequent catalog changes do not affect the line. Test: `ordersService.persistence.test.ts` covers this with a seed-then-edit-catalog scenario. |
