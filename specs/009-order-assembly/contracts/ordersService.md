# Contract — `ordersService`

**Module**: `src/features/orders/services/ordersService.ts`

The only write path to `orders` and `order_items` in the application. All screens and hooks in this feature mutate through this service. Every method runs inside `database.write(...)` and calls `assertValidStatus` on any status value that crosses the boundary.

## Types

```ts
export type Status = 'draft' | 'sent' | 'canceled';
export type DiscountMode = 'amount' | 'percent';

export type DiscountInput = {
  mode: DiscountMode;
  /** BRL when mode = 'amount'; percent 0..100 when mode = 'percent'. */
  value: number;
};
```

## Methods

### `createDraft(input: { clientId: string; salespersonId: string }): Promise<{ orderId: string }>`

Creates a new `orders` row with `status = 'draft'`, 0 items, `discountMode = 'amount'`, `discountAmount = 0`, `createdAtMs = Date.now()`. Does not navigate; caller is responsible.

**Guards**: `clientId` and `salespersonId` must resolve to existing rows (checked by FK presence; service throws `ClientNotFoundError` / `SalespersonNotFoundError` if not).

### `addItem(input: { orderId: string; productVariantId: string; quantity?: number }): Promise<{ orderItemId: string }>`

Creates a new `order_items` row. Captures `unit_price` as a snapshot from `product_variants.price`. Defaults `quantity` to 1 if not provided.

**Guards**: `orderId` must resolve to a `draft` order (throws `OrderNotDraftError` otherwise). If the same `productVariantId` is already a line on this order, the method instead increments that line's quantity by `quantity ?? 1` and returns its existing `orderItemId`.

### `updateLineQty(input: { orderItemId: string; quantity: number }): Promise<void>`

Updates `quantity` on the line. If `quantity === 0`, the line is removed (equivalent to `removeLine`).

**Guards**: parent order must be `draft`. `quantity` must be an integer `≥ 0`.

### `removeLine(input: { orderItemId: string }): Promise<void>`

Permanently deletes the line row.

**Guards**: parent order must be `draft`.

### `setLineDiscount(input: { orderItemId: string; discount: DiscountInput | null }): Promise<void>`

Writes `discountMode` + `discountAmount` on the line. Passing `discount: null` clears the discount (resets to `{ mode: 'amount', value: 0 }`).

**Guards**: parent order must be `draft`. `value ≥ 0`. `mode === 'percent' ⇒ value ≤ 100` (enforced by TS refinement; runtime clamps in `computeOrderTotals`, not here — see research R-006).

### `setOrderDiscount(input: { orderId: string; discount: DiscountInput | null }): Promise<void>`

Writes `discountMode` + `discountAmount` on the order.

**Guards**: order must be `draft`. Same value constraints as `setLineDiscount`.

### `send(input: { orderId: string }): Promise<void>`

Transitions `draft → sent`. Stamps `sentAtMs = Date.now()`.

**Guards**: order must currently be `draft`. Order must have ≥ 1 line item (throws `EmptyDraftError`).

**Post-condition**: status = `'sent'`, `sentAtMs` set. The order disappears from `observeDrafts` and becomes immutable to this feature's write methods.

### `cancel(input: { orderId: string }): Promise<void>`

Transitions `draft → canceled`. Stamps `canceledAtMs = Date.now()`.

**Guards**: order must currently be `draft`.

**Post-condition**: status = `'canceled'`, `canceledAtMs` set. The order disappears from `observeDrafts` and becomes immutable.

## Errors

The service throws typed errors. Callers map them to inline warnings (no modals).

| Error | Thrown when |
|-------|-------------|
| `OrderNotFoundError` | Any method with `orderId` receives a missing id |
| `OrderNotDraftError` | Mutating method called on non-draft order |
| `LineNotFoundError` | `updateLineQty` / `removeLine` / `setLineDiscount` on missing line |
| `EmptyDraftError` | `send` called on a draft with 0 items |
| `AlreadyTerminalError` | `send` or `cancel` called on `sent` / `canceled` order |
| `ClientNotFoundError` / `SalespersonNotFoundError` | `createDraft` with bad ids |
| `InvalidStatusError` | `assertValidStatus` rejected a value — indicates a bug, never a user-caused error |

## Observations (read-side, for completeness)

The service does not expose reads; reads go through repositories directly. The following observations are consumed by screens/hooks in this feature:

- `ordersRepository.observeById(orderId)` — drives `OrderDraftScreen` / `OrderSummaryScreen` headers.
- `ordersRepository.observeDrafts(salespersonId)` — drives Home "Drafts in progress" (via `useDraftsSummary`).
- `orderItemsRepository.observeByOrder(orderId)` — drives the line list on `OrderDraftScreen` and the compact list on `OrderSummaryScreen`.

These return reactive arrays; callers pipe them through `computeOrderTotals` to derive display state.

## Invariants enforced by this contract

- **R5**: no method accepts a product or product_variant id as a *mutation target*. Variants and products are read-only inputs to `addItem` (`unitPrice` snapshot) and never the target of a write.
- **D4**: `status` can only reach the three allowed values, reached only via `createDraft`, `send`, `cancel`.
- **P1**: no method performs a network call. Every mutation is local to WatermelonDB. Sync pushes the rows upstream later (D1), not inside this service.
- **P5**: every successful method call leaves the database in a consistent state for app restart.
