# Quickstart: Orders Overview

**Feature**: 013-orders-overview

## For developers

### Run tests for this feature

```bash
npm test -- --testPathPattern "features/orders/(overview|detail|payment|activity)|clients/orders/deriveOrderHistory"
```

The `clients/orders/deriveOrderHistory` pattern is included because R1 moves the shared helper; the existing 012 test must still pass against the new import path.

### Boot the app and reach the surfaces

1. `npm run start` → open Expo dev client on device.
2. Log in as any seller that has sent/draft/canceled orders.
3. From Home: tap the new **Pedidos** QuickActionCard → OrdersOverview.
4. From OrdersOverview: tap any row:
   - Draft → OrderDraft (existing editor).
   - Sent → new OrderDetail (read-only).
   - Canceled → new OrderDetail (read-only, no `Lançar recebimento`).
5. From Home "Atividade recente" card: tap any item → OrderDetail.
6. From ClientProfile → Histórico → tap a sent row → OrderDetail (R9 behavior change).

## For QA

### Manual test matrix

| Scenario | Expected |
|----------|----------|
| Open Pedidos with zero orders in the current month | Empty list, summary `0 pedidos · R$ 0,00`, chevrons still enabled |
| Tap left chevron to previous month with 3 orders | Summary recomputes, list shows 3 rows |
| Activate `Pago` chip | Only paid rows visible, summary recomputes |
| Type `pad` in search | Only client names containing `pad` (case/accent-insensitive) remain |
| Combine `Pendente` + `mer` search | Intersection of both filters; summary reflects it |
| Overpayment order | Row shows `Ajuste` chip (red); summary `received` is capped at total |
| Canceled order with receipts | Row shows only `Cancelado` chip, no payment chip; OrderDetail still lists receipts |
| Airplane mode | Everything renders from local DB; no errors, no spinners |
| Tap a sent order from ClientProfile | OrderDetail opens (not OrderReceipts directly) |
| Tablet split panel | Tap a row on the left pane → right pane shows that order's detail preview |
| Tablet deep-link to OrderDetail (via Home card) | OrderDetail/Tablet full-screen opens (not the split panel) |

## Success criteria verification

| SC | How to verify |
|----|---------------|
| SC-001 | Seed DB with 500 orders; measure cold open to rendered list with `performance.now()`-style marker in the screen component. |
| SC-002 | Jest integration test: instantiate each entry point, assert they all push a screen with `name === 'OrderDetail'` and identical route params for the same order id. |
| SC-003 | Unit test: for 100 random (total, received) tuples, assert `derivePaymentStatus` returns the same value when called from the OrdersOverview pipeline vs the ClientProfile pipeline. |
| SC-004 | Property-based jest test (`fast-check` if already dep; otherwise loop-based) asserting `pending === max(0, billed - received)`. |
| SC-005 | Manual on physical Android mid-range device; spot-check fps via React DevTools. |
| SC-006 | Jest spy on the Supabase client inside a 30-s airplane-mode test run; assert call count is 0. |
