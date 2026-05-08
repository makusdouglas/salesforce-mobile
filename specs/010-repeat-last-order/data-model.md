# Phase 1 Data Model — Repeat Past Order

**Date**: 2026-04-23
**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Schema changes

**None.** This feature introduces zero new tables, zero new columns, zero new indexes, and zero migrations. Every field it reads and writes is already present from features 001–009.

## Entities read

### `orders` (existing)

| Field | Type | Role in this feature |
|-------|------|----------------------|
| `id` | string (PK) | Source identifier + new cloned draft id |
| `client_id` | string (FK → clients.id) | Copied into the cloned draft |
| `salesperson_id` | string (FK → salespeople.id) | Copied into the cloned draft (taken from source, not from session, so offline clones in mixed-session devices stay attributed to the original seller) |
| `status` | `'draft' \| 'sent' \| 'canceled'` | Gate: `draft` → resume (R-003); `sent`/`canceled` → clone; the cloned draft is always `draft` |
| `sent_at_ms` | number \| null | Sort key for hero's "last sent order" observation (R-004); null on the cloned draft |
| `discount_amount` | number | Copied verbatim into the cloned draft |
| `discount_mode` | `'amount' \| 'percent'` | Copied verbatim into the cloned draft |
| `_status`, `_changed`, `created_at_ms`, `updated_at_ms` | WatermelonDB + audit | Cloned draft gets fresh values; source row is untouched |

### `order_items` (existing)

| Field | Type | Role in this feature |
|-------|------|----------------------|
| `id` | string (PK) | Source line id (read); new line id generated for each cloned line |
| `order_id` | string (FK → orders.id) | Cloned draft's id on new lines |
| `product_variant_id` | string (FK → product_variants.id) | Copied verbatim; drives availability gate |
| `quantity` | integer | Copied verbatim |
| `unit_price` | number | **Not copied**. Resolved from current `product_variants.price` at clone time (R-001) |
| `discount_amount` | number | Copied verbatim |
| `discount_mode` | `'amount' \| 'percent'` | Copied verbatim |

### `product_variants` (existing, read-only)

| Field | Role |
|-------|------|
| `id` | Looked up per source line |
| `price` | The live unit price written into the cloned line |
| `_status = 'deleted'` | Availability signal (drop + notice) |

### `products` (existing, read-only)

| Field | Role |
|-------|------|
| `id` | Resolved via the variant's parent-product id |
| `name` | Used in the dropped-items notice (e.g., "Leite Integral 1L") |
| `_status = 'deleted'` | Second availability signal — even if variant is active, a deleted parent product deactivates the line |

### `clients` (existing, read-only)

| Field | Role |
|-------|------|
| `id` | Scope for `observeLastSentForClient(clientId)` |

## Entities written

### New `orders` row (per clone)

Created with:
- `client_id` = source.client_id
- `salesperson_id` = source.salesperson_id
- `status` = `'draft'`
- `sent_at_ms` = `null`
- `discount_amount` = source.discount_amount
- `discount_mode` = source.discount_mode

WatermelonDB fills `id`, `_status`, `created_at_ms`, `updated_at_ms`.

### New `order_items` rows (one per available source line)

Created with:
- `order_id` = new draft's id
- `product_variant_id` = source_line.product_variant_id
- `quantity` = source_line.quantity
- `unit_price` = `product_variants.price` at clone time (current, not historical)
- `discount_amount` = source_line.discount_amount
- `discount_mode` = source_line.discount_mode

Source lines whose variant is deleted or whose parent product is deleted are **not** written; their product names accumulate in `droppedProductNames`.

## Validation rules

| Rule | Source | Enforced where |
|------|--------|----------------|
| Cloned draft always has `status = 'draft'` | D4, FR-003 | `ordersService.repeat` sets `status = 'draft'` via `ordersRepository.create`, which in turn runs through `assertValidStatus` |
| At least one line must remain after the availability gate, else clone is blocked | FR-008 | `ordersService.repeat` throws `AllItemsUnavailableError` before opening the `database.write` action |
| Source `status = 'draft'` rejects clone (resume policy) | R-003, FR-011 | `ordersService.repeat` throws `CannotRepeatDraftError`; `useRepeatOrder` branches to resume before ever calling the service |
| Source row is never mutated | SC-006 | `ordersService.repeat` only calls `create` / line-create paths; no update on the source id |
| New `unit_price` = current catalog price | R-001, FR-006 | `ordersService.repeat` reads `variant.price` per line |
| Dropped lines produce a user-visible notice | FR-007 | `repeat` returns `droppedProductNames`; `OrderSummaryScreen` renders `DroppedItemsNotice` when non-empty |
| Atomic rollback on any write failure | R-005, SC-006 | Entire write wrapped in one `database.write(...)` action |

## State transitions

This feature introduces no new status values. The two transitions it drives are:

1. **None → Draft** (via the new `orders` row). Same transition as `createDraft` (009).
2. **Draft (source) remains Draft** (resume path). No transition; `useRepeatOrder` navigates only.

All other transitions (`draft → sent`, `draft → canceled`) continue to be owned by 009's `send` / `cancel` methods and are untouched here.

## Observations

| Observation | Query (logical) | Consumer |
|-------------|-----------------|----------|
| `ordersRepository.observeLastSentForClient(clientId)` | `orders WHERE client_id = ? AND status = 'sent' ORDER BY sent_at_ms DESC LIMIT 1` (with `_status != 'deleted'`) | `RepeatHeroCard` on `ClientProfileScreen` |
| `ordersRepository.observeByClient(clientId)` *(existing, 008)* | `orders WHERE client_id = ? ORDER BY created_at_ms DESC` | History list on `ClientProfileScreen` — unchanged, each row gets a `RepeatIconButton` |
| `orderItemsRepository.observeByOrder(orderId)` *(existing, 009)* | `order_items WHERE order_id = ?` | `OrderSummaryScreen` after navigation — unchanged |

## Index usage

- `observeLastSentForClient` uses the existing `(client_id)` index on `orders` (001) plus a runtime sort over `sent_at_ms`. Per-client order counts are bounded (≤ low hundreds in MVP), so no dedicated composite index is warranted.
- Variant lookup inside `repeat` uses the existing primary-key index on `product_variants.id`.

No new index is needed.

## Entity relationship (scope of this feature)

```text
clients (1) ─┬── (N) orders ── (N) order_items ── (1) product_variants ── (1) products
             │                    │
             │                    └── discount_amount + discount_mode  (cloned)
             │
             └── hero.observeLastSentForClient reads orders scoped here
```

The arrows with "cloned" mark the fields this feature duplicates from source to new draft.
