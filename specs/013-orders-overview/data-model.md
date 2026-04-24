# Data Model: Orders Overview

**Feature**: 013-orders-overview
**Date**: 2026-04-24

This feature introduces **zero** schema changes. It consumes existing entities only. This document traces how those entities compose into the screens.

## Existing entities consumed

### `orders` (read)

| Field | Used for |
|-------|----------|
| `id` | Row identity; `formatShortOrderId()` derivation |
| `seller_id` | Observable filter (list shows only the logged seller's orders) |
| `client_id` | Used via relation to resolve client name |
| `status` | Status chip (draft / sent / canceled) |
| `total`, `subtotal`, `discount_amount` | Row total + OrderDetail totals block |
| `created_at` | Fallback timestamp for drafts with no `updated_at` delta |
| `updated_at` | Row timestamp when status=draft |
| `sent_at` | Row timestamp when status=sent; month bucket for sent orders |
| `canceled_at` | Row timestamp when status=canceled; month bucket for canceled orders |

### `order_items` (read)

| Field | Used for |
|-------|----------|
| `order_id` | Relation to orders |
| `description`, `unit_price`, `quantity`, `discount_amount` | OrderDetail items list |
| (count) | OrdersOverview list row "3 itens" label |

### `payment_receipts` (read, from feature 012)

| Field | Used for |
|-------|----------|
| `order_id` | Join key |
| `amount` | Payment status derivation + summary band `Recebido` |
| `paid_at`, `method`, `notes` | OrderDetail receipts section |
| `correction_of_receipt_id` | Shown as "correção" label on OrderDetail receipt rows |
| `attachment_*` | Pass-through to receipt row preview (reuses 012 components) |

### `clients` (read)

| Field | Used for |
|-------|----------|
| `id`, `name` | Row client label, OrderDetail client card |
| `address_line`, `phone` | OrderDetail client card (subtitle) |

## Derived (UI-only) concepts

### `OrderOverviewRowDTO`

```typescript
type OrderOverviewRowDTO = {
  readonly id: string;
  readonly shortId: string;                  // "#2041"
  readonly clientName: string;
  readonly clientId: string;
  readonly status: 'draft' | 'sent' | 'canceled';
  readonly total: number;                    // BRL decimal
  readonly itemCount: number;
  readonly received: number;                 // sum(receipts.amount), capped at total
  readonly paymentStatus: OrderPaymentStatus | null; // null for draft/canceled
  readonly effectiveTimestampMs: number;     // updated_at | sent_at | canceled_at
  readonly timestampLabel: 'atualizado' | 'enviado' | 'cancelado';
};
```

Produced by a selector that fan-outs `observeOrdersForMonth` + `observeReceiptsForOrders` and applies `derivePaymentStatus` (shared helper).

### `OrdersOverviewSummaryDTO`

```typescript
type OrdersOverviewSummaryDTO = {
  readonly ordersCount: number;        // after filters applied
  readonly billed: number;             // sum(totals of sent orders in window)
  readonly received: number;           // sum(receipts.amount on sent orders), capped per-order at order.total
  readonly pending: number;            // billed - received, floored at 0
  readonly progressRatio: number;      // received/billed, clamped [0,1]
};
```

Computed from the same row stream — so filter changes propagate to both list and summary in a single observable emission.

### `OrdersOverviewFilter` (UI state)

```typescript
type OrdersOverviewFilter = {
  readonly month: string;                                   // 'YYYY-MM'
  readonly status: 'all' | 'draft' | 'pending' | 'paid' | 'canceled';
  readonly query: string;                                   // raw text
};
```

Not persisted — lives inside the screen's reducer. `month` defaults to the current month on mount. `status` defaults to `all`. `query` defaults to `''`.

### `OrderDetailDTO`

```typescript
type OrderDetailDTO = {
  readonly order: OrderOverviewRowDTO;
  readonly client: {
    readonly id: string;
    readonly name: string;
    readonly addressLine: string | null;
    readonly phone: string | null;
  };
  readonly items: readonly OrderItemDTO[];
  readonly receipts: readonly ReceiptRowDTO[];     // re-uses feature 012 DTO
  readonly totals: {
    readonly subtotal: number;
    readonly itemDiscounts: number;
    readonly orderDiscount: number;
    readonly total: number;
  };
  readonly pdfUri: string | null;                  // null if not materialized yet
};
```

## Relation graph (read-only)

```
[seller]──owns──▶[orders]──has──▶[order_items]
                    │
                    ├──belongs_to──▶[clients]
                    │
                    └──has──▶[payment_receipts]──(optional)correction_of──▶[payment_receipts]
```

No writes. No new foreign keys. No migrations.

## Invariants locked by the model

- **I1**: Every `OrderOverviewRowDTO.paymentStatus` satisfies `derivePaymentStatus(order.total, sum(receipts.amount))` identically to what ClientProfile renders for the same inputs.
- **I2**: `OrdersOverviewSummaryDTO.pending === max(0, billed - received)`, tested by the property-based test required by SC-004.
- **I3**: `OrdersOverviewSummaryDTO.received` is the sum of per-order receipts **capped at each order's total** before summing, so `pending` can never go negative even when an order is overpaid.
- **I4**: The `month` bucket uses status-aware timestamps: drafts → `updated_at ?? created_at`, sent → `sent_at`, canceled → `canceled_at ?? created_at`. Consistent with R6.
