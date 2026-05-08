# Contract — `ordersService.repeat`

**Module**: `src/features/orders/services/ordersService.ts`
**Status**: new method, additive. Existing methods (`createDraft`, `addItem`, `updateLineQty`, `removeLine`, `setLineDiscount`, `setOrderDiscount`, `send`, `cancel`) are unchanged.

## Shape

```ts
export interface RepeatInput {
  sourceOrderId: string;
}

export interface RepeatResult {
  orderId: string;                    // the NEW draft's id
  droppedProductNames: string[];      // display strings of lines skipped by the availability gate
}

export interface OrdersService {
  // ... existing methods from 009
  repeat(input: RepeatInput): Promise<RepeatResult>;
}
```

## Errors

All errors are typed; callers discriminate on `.code`.

| Class | `.code` | Thrown when |
|-------|---------|-------------|
| `OrderNotFoundError` (existing, 009) | `ORDER_NOT_FOUND` | `sourceOrderId` does not exist or is soft-deleted |
| `CannotRepeatDraftError` (new) | `CANNOT_REPEAT_DRAFT` | Source order's status is `'draft'`. Callers should resume instead (see `useRepeatOrder`). |
| `AllItemsUnavailableError` (new) | `ALL_ITEMS_UNAVAILABLE` | Every line on the source references a variant that is soft-deleted or whose parent product is soft-deleted. No draft is created; the caller must present the blocking notice (FR-008). |

`CannotRepeatDraftError` carries the source `orderId` so the UI hook can route to resume without a second repository read.

## Behaviour

1. **Load** the source order via `ordersRepository.findById(sourceOrderId)`. If missing, throw `OrderNotFoundError`.
2. **Status gate**. If `source.status === 'draft'`, throw `CannotRepeatDraftError(source.id)`. Otherwise proceed. (Canceled sources are allowed — the user may legitimately want to redo an order that was cancelled for reasons unrelated to its contents.)
3. **Load** the source's active lines via `orderItemsRepository.findByOrder(sourceOrderId)` (respects the existing `_status != 'deleted'` filter).
4. **Availability gate**. For each source line, resolve `productVariantsRepository.findById(line.productVariantId)`:
   - If the variant is missing, or its `_status === 'deleted'`, or its parent product's `_status === 'deleted'` (fetched via `productsRepository.findById(variant.productId)`), collect the product's name (or a fallback "Item indisponível" if the product row is gone entirely) into `dropped`.
   - Otherwise, collect the line into `kept` along with the resolved variant (for the current `price`).
5. **All-unavailable gate**. If `kept.length === 0`, throw `AllItemsUnavailableError`.
6. **Atomic clone**. Inside a single `database.write(...)` action:
   - Create a new `orders` row with `client_id`, `salesperson_id`, `discount_amount`, `discount_mode` copied from the source; `status = 'draft'`; `sent_at_ms = null`.
   - For each `kept` line, create an `order_items` row referencing the new draft, with `quantity`, `discount_amount`, `discount_mode` copied and `unit_price` set to the current `variant.price`.
   - Any throw inside the action rolls back the transaction; the new draft does not persist.
7. **Return** `{ orderId: newDraft.id, droppedProductNames: dropped.map(d => d.name) }`.

## Invariants

- The source `orders` row and its `order_items` rows are **never** mutated. `repeat` only reads from them. Verified in `ordersService.repeat.test.ts` by diffing the source row before/after.
- The method performs **zero** writes against `products` or `product_variants`. Verified by the widened `noCatalogWrites.test.ts` static scan.
- `droppedProductNames.length + cloned_lines.length === source_active_lines.length` (conservation). Verified in tests.
- `status` on the returned draft is always `'draft'`; `sent_at_ms` is always `null`. Enforced by `assertValidStatus` on the write path.

## Example call sequences

### Happy path — all items available, non-empty notice is empty

```ts
const { orderId, droppedProductNames } = await ordersService.repeat({
  sourceOrderId: 'o_abc',
});
// droppedProductNames === []
// orderId !== 'o_abc'
// navigation.navigate('OrderSummary', { orderId, droppedNames: [] })
```

### Partial availability

```ts
// Source has 5 lines; variant for line #3 was soft-deleted.
const { orderId, droppedProductNames } = await ordersService.repeat({
  sourceOrderId: 'o_abc',
});
// droppedProductNames === ['Leite Integral 1L']
// The new draft has 4 lines.
// navigation.navigate('OrderSummary', { orderId, droppedNames: ['Leite Integral 1L'] })
```

### All unavailable → blocked

```ts
try {
  await ordersService.repeat({ sourceOrderId: 'o_xyz' });
} catch (err) {
  if (err instanceof AllItemsUnavailableError) {
    // Render inline notice on ClientProfile; do not navigate away.
  } else throw err;
}
```

### Draft source — service rejects, hook resumes

```ts
// Inside useRepeatOrder — hook-level:
if (source.status === 'draft') {
  navigation.navigate('OrderSummary', { orderId: source.id, droppedNames: [] });
  return;
}
// Only non-draft sources reach the service:
const result = await ordersService.repeat({ sourceOrderId: source.id });
navigation.navigate('OrderSummary', { orderId: result.orderId, droppedNames: result.droppedProductNames });
```

If a future caller bypasses the hook and calls `repeat` with a draft source, the service throws `CannotRepeatDraftError` — a second line of defence against accidental draft duplication.

## Out-of-contract

- `repeat` does NOT mark the source order read or touched in any way. It has no side effects beyond the new draft.
- `repeat` does NOT handle the "the source client is not the current seller's client" case. Ownership is scoped at the screen level (the salesperson can only open their own clients' profiles in the VENDEDOR surface).
- `repeat` does NOT return the cloned line ids. If a future caller needs them, extend `RepeatResult` additively — this version keeps the return shape minimal to satisfy the two callers (summary navigation + tests).
