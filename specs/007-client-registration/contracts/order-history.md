# Contract: order history on the client profile

**Status**: authoritative for 007 Client Management
**Files**:

- `src/features/clients/hooks/useClientOrderHistory.ts`
- `src/features/clients/components/OrderHistoryList.tsx`
- `src/features/clients/components/OrderHistoryRow.tsx`
- `src/features/clients/components/OrderHistoryEmptyView.tsx`
- `src/features/clients/screens/NewOrderStubScreen.tsx`

This contract covers three things: the hook shape that feeds the history list, the total-computation rules, and the stable hand-off boundary between this feature and the future orders feature (008).

## `useClientOrderHistory(clientId: string): OrderHistoryRowDTO[]`

```ts
import type { OrderHistoryRowDTO } from '../types';

export function useClientOrderHistory(clientId: string): readonly OrderHistoryRowDTO[];
```

- **Input**: the client id whose history should be observed.
- **Output**: a stable array of `OrderHistoryRowDTO` sorted most-recent-first by `createdAtMs`. Empty array when the client has no orders.
- **Behavior**:
  - Observes `ordersRepository.observeByClient(clientId)`.
  - For each emitted order, observes its items via `orderItemsRepository.observeByOrder(order.id)`.
  - Derives `OrderHistoryRowDTO` via the total-computation rules below.
  - Emits on every underlying change (order added, status changed, item added / removed / updated).
  - NEVER issues a network request. Pure local reads.
- **Memory**: subscription is torn down on unmount. No leak on profile navigation.
- **Performance**: at MVP scale (tens of orders per client at most, tens of items per order at most), the join is trivially fast. If profiling ever shows contention, a future optimization can cache totals per-order inside the hook.

### `OrderHistoryRowDTO` shape

See `data-model.md` for the canonical definition. Repeated here for convenience:

```ts
type OrderHistoryRowDTO = {
  readonly id: string;
  readonly createdAtMs: number;
  readonly status: 'draft' | 'sent' | 'canceled';
  readonly total: number;   // clamped ≥ 0
  readonly itemCount: number;
};
```

## Total computation rules (research R-004)

For each order:

```text
subtotal = Σ (item.quantity × item.unitPrice − item.discountAmount)
total    = max(0, subtotal − order.discountAmount)
```

Edge cases:

- No items → `subtotal = 0`, `total = max(0, 0 − discount)` — effectively `0` unless the order has a negative discount (impossible by 002's validation). Practically always `0` for an empty order.
- `item.discountAmount` may be zero (default) — the formula still works.
- `order.discountAmount` may be zero (default) — the formula still works.
- A canceled order's total is computed the same way; the row renders it with reduced opacity / strikethrough per FR-015 visual distinction.

## `OrderHistoryRow` visual rules

| Status | Visual treatment |
|--------|-----------------|
| `draft` | Normal foreground color; status pill labeled "Rascunho" in neutral color. |
| `sent` | Normal foreground color; status pill labeled "Enviado" in a success (green) accent. |
| `canceled` | Reduced opacity (e.g. 0.5); status pill labeled "Cancelado" in a muted / strikethrough style. Total is still displayed (not hidden). |

Date format: `dd/MM/yyyy` (Brazilian) — rendered via a local formatter function. No date library.

Total format: `R$ 1.234,56` — via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Hardcoded `BRL` is acceptable for MVP; no multi-currency scope.

## `OrderHistoryEmptyView`

Rendered when `useClientOrderHistory(clientId)` returns an empty array.

Copy: **"Nenhum pedido ainda. Toque em Novo pedido para começar."**

Points back at the primary CTA. Does NOT include a separate call-to-action button — the `Novo pedido` CTA below is already the intended action.

## Hand-off contract with feature 008 (orders)

The `NewOrder` route on `HomeStack` is the stable boundary between 007 and 008. See research R-007 for the rationale.

### Invariants owned by 007

- Route name: `NewOrder`.
- Route param: `{ clientId: string }`.
- The route is present in `HomeStackParamList` at 007's ship time.
- The current render target is `NewOrderStubScreen` (which only navigates back after showing a "em breve" message; no side effects, no DB writes).

### Invariants 008 MUST honor on arrival

- Route name and param shape remain stable. If 008 wants additional params (e.g., `{ clientId: string; sourceOrderId?: string }` to support "repeat this order" per UX2), the param shape MAY be widened but NOT narrowed. 007 passes only `{ clientId }`; widening with optional fields is safe.
- The `NewOrderStubScreen` is replaced by 008's own order-draft screen. 007's code does not need to change.

### 008's swap recipe (out of scope for 007, documented for clarity)

1. In `HomeStack.tsx`, replace the component reference:
   ```ts
   import { OrderDraftScreen } from '@/features/orders';
   // ...
   <Stack.Screen name="NewOrder" component={OrderDraftScreen} ... />
   ```
2. Remove the `NewOrderStubScreen` import from `HomeStack.tsx`.
3. (Optional cleanup) delete `src/features/clients/screens/NewOrderStubScreen.tsx` and remove its export from `src/features/clients/index.ts`.
4. If 008 widens the param shape, update `types.ts` accordingly. 007's callers pass only `{ clientId }`, which remains valid.

## Test contract

- `orderHistory.test.ts` MUST cover:
  1. Total for a single order with two items and no discounts: `subtotal = Σ(q × p)`.
  2. Total with item discounts: `subtotal = Σ(q × p − item.discount)`.
  3. Total with order discount: `total = max(0, subtotal − order.discount)`.
  4. Clamp: when order discount > subtotal, total === 0 (not negative).
  5. Empty items array: total === 0.
  6. Ordering: orders with larger `createdAtMs` come first.
  7. Canceled order still produces a total (not filtered out).

The hook itself (`useClientOrderHistory`) is tested lightly — WatermelonDB observations are covered by 002's test suite; this feature trusts the observation and tests the pure derivation.
