# Contract — Seller Revenue Derivations (TypeScript)

All derivations live in `src/features/revenue/derivations/`. They are pure functions — no I/O, no observers, no Supabase. The `useSellerRevenue` hook is responsible for subscribing to WatermelonDB collections and feeding plain arrays into these functions.

Every derivation produces a slice of the same `RevenueSnapshot` shape defined in `data-model.md` §4. The seller scope omits `sellerRanking` (it's `undefined`).

---

## Common input

```ts
export interface DerivationInput {
  /** All sent + draft + cancelled orders for the active seller, with the existing repository row shape. */
  readonly orders: ReadonlyArray<OrderRow>;
  /** All payment_receipts for those orders, with corrected_by handled (latest non-corrected per chain). */
  readonly receipts: ReadonlyArray<PaymentReceiptRow>;
  /** All order_items for those orders. */
  readonly items: ReadonlyArray<OrderItemRow>;
  /** Display-name lookup for clients (id → name). */
  readonly clientNameById: ReadonlyMap<string, string>;
  /** Display-name lookup for products (id → name). */
  readonly productNameById: ReadonlyMap<string, string>;
  /** Filter / period state, same shape as RevenueFilter. Seller scope always pins sellerId to self. */
  readonly filter: RevenueFilter;
  /** Reference "now" for deterministic tests; defaults to Date.now() at call site. */
  readonly nowMs: number;
}
```

`OrderRow`, `PaymentReceiptRow`, `OrderItemRow` are the existing repository row types from `src/data/repositories/`.

---

## 1. `deriveKpis(input): KpiBlock[]`

**Output**: array of length 5 in the order Recebido, Faturado, Pendente, Ticket médio, Nº de pedidos enviados.

**Rules** (mirror `admin_revenue_kpis`):

- Restrict to the seller's own orders (already enforced by the input subset).
- For each metric, compute the value for `filter.month` and the previous month.
- `recebido` = sum of `receipts.amount` whose parent `order.sent_at` falls in the month.
- `faturado` = sum of `orders.total` for orders whose `created_at` falls in the month.
- `pendente` = sum over sent orders of `Math.max(0, total - receiptSum)` for orders whose `sent_at` falls in the month.
- `ticket_medio` = `faturado / sentCount` if `sentCount > 0` else `0`.
- `pedidos_enviados` = count of sent orders for the month.
- For each: `previousValue` = same metric for `month - 1`, or `null` if previous month has zero relevant rows.
- `deltaPct` = `null` if `previousValue` is `null` OR `previousValue === 0`. Otherwise `(currentValue - previousValue) / previousValue`.
- `deltaDirection` = `null` when `deltaPct === null`; else `'up'` for `>= 0`, `'down'` for `< 0`.

**Tests**: feed synthetic order/receipt sets covering the edge cases listed in research R5.

---

## 2. `deriveTrend(input, opts): TrendPoint[]`

`opts.includeYear?: 'current' | 'priorYear'` — `'current'` returns the trend window `[trendFrom, trendTo]`; `'priorYear'` returns the same calendar months one year earlier.

**Output**: at most `(months in window)` entries, sorted by `month asc`. Months with no relevant rows are **omitted**.

**Rules**:

- For each month in the window with at least one relevant row, compute `faturado`, `recebido`, `pendente` as in `deriveKpis`.
- `pendente` is computed against the receipts as of the month boundary — i.e., per-order pendente includes only receipts received within or before the month. This matches the trend chart's intent of "what was pendente that month, not what is pendente today".

---

## 3. `deriveTopClients(input): TopClient[]`

**Output**: at most 3 entries, sorted by `recebido desc, clientName asc`.

**Rules**:

- Window = `[filter.trendFrom, filter.trendTo]` for "active filter window" per FR-020 — same window used by Top products and aging context.
- Clients with `recebido = 0` are excluded.

---

## 4. `deriveTopProducts(input): TopProduct[]`

**Output**: at most 3 entries, sorted by `units desc, productName asc`.

**Rules**:

- `units` = sum of `order_items.quantity` for items whose parent order has `sent_at` in the window.
- Products with `units = 0` excluded.

---

## 5. `deriveAging(input): AgingBucket[]`

**Output**: exactly 4 entries in fixed order: `0–30`, `31–60`, `61–90`, `>90`.

**Rules** (mirror `admin_receivables_aging`):

- Only `status = 'sent'` orders.
- `ageDays = floor((nowMs - sentAtMs) / 86_400_000)`. Negative ages excluded.
- `pendentePerOrder = Math.max(0, total - receiptSum)`.
- Sum into buckets per boundaries in research R6.
- All four entries are returned even when `totalPendente = 0`; the renderer collapses to empty state when all four are zero (FR-029).

---

## Aggregator: `useSellerRevenue(activeSellerId)`

The hook composes the five derivations:

```ts
export function useSellerRevenue(
  activeSellerId: string,
): { snapshot: RevenueSnapshot; isLoading: boolean } {
  const filter = useSellerRevenueFilter(); // current month + last 12 months trend
  const orders = useObservedOrders(activeSellerId);
  const receipts = useObservedReceiptsForOrders(orders);
  const items = useObservedItemsForOrders(orders);
  const clientNameById = useClientNameMap(orders);
  const productNameById = useProductNameMap(items);

  const snapshot = useMemo<RevenueSnapshot>(() => {
    const input: DerivationInput = {
      orders, receipts, items, clientNameById, productNameById,
      filter, nowMs: Date.now(),
    };
    return {
      scope: 'seller',
      filter,
      fetchedAt: input.nowMs,
      kpis: deriveKpis(input),
      trend: deriveTrend(input, { includeYear: 'current' }),
      topClients: deriveTopClients(input),
      topProducts: deriveTopProducts(input),
      aging: deriveAging(input),
    };
  }, [orders, receipts, items, clientNameById, productNameById, filter]);

  return { snapshot, isLoading: false };
}
```

`isLoading` is always `false` after the initial mount — observers deliver synchronously after WatermelonDB has loaded. The hook MUST NOT show a spinner at idle state (FR-043).

---

## Test contract

For each of the five derivation functions, ship a Jest test file that covers:

1. **Happy path** with multi-month, multi-client, multi-product synthetic data.
2. **Empty input** → returns the empty-shape variant (e.g., `aging` returns 4 zero rows, KPIs return 5 entries with `currentValue = 0` and `previousValue = null`).
3. **Sparse trend** (only 2 of 12 months populated) → returns 2 entries.
4. **Edge case for the specific function**: KPI delta when previous = 0; aging when an order is exactly at a boundary day; top-N tie-break by name.

These test files must run under the existing `pnpm test` Jest config without new infrastructure.
