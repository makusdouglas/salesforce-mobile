# Contract: `observeOrdersForMonth`

**Path**: `src/data/repositories/ordersRepository.ts` (added method)

## Signature

```typescript
export function observeOrdersForMonth(
  sellerId: string,
  monthStartMs: number,   // inclusive
  monthEndMs: number,     // exclusive
): Observable<readonly OrderModel[]>;
```

## Behavior

Emits the orders owned by `sellerId` that fall into the month window, using the **status-aware timestamp** described in R6:

- `status = 'draft'` AND `updated_at ∈ [monthStartMs, monthEndMs)` (fallback `created_at` if `updated_at` is null).
- `status = 'sent'` AND `sent_at ∈ [monthStartMs, monthEndMs)`.
- `status = 'canceled'` AND `canceled_at ∈ [monthStartMs, monthEndMs)` (fallback `created_at`).

Re-emits on any `orders` mutation that touches the filter columns (via the standard Watermelon observable plumbing).

## Ordering

Within a window, results are sorted by effective timestamp **descending** (most recent first). Ordering is applied inside the query to minimize downstream re-sorting.

## Behavioral locks

- Never returns orders from other sellers.
- `sellerId === null/undefined` → emits an empty array.
- An order whose status changes from `draft` → `sent` during the window migrates buckets automatically (because the observable re-evaluates against both `updated_at` and `sent_at`).

## Tests required

1. Seed 10 orders across 2 months × 3 statuses; assert only the right ones emit per month.
2. Mutation test: change an order's `sent_at` mid-subscription; assert the observable re-emits with the order in the correct bucket.
3. Empty seller id → empty array.
