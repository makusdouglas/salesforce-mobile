# Contract: `computeOrdersOverviewSummary`

**Path**: `src/features/orders/overview/selectors/computeOrdersOverviewSummary.ts`

## Signature

```typescript
export function computeOrdersOverviewSummary(
  rows: readonly OrderOverviewRowDTO[],
): OrdersOverviewSummaryDTO;
```

## Semantics

Given rows already narrowed to the active filter window (month × status chip × text query):

- `ordersCount` = `rows.length`
- `billed` = sum of `row.total` for rows where `row.status === 'sent'`
- `received` = sum of `min(row.received, row.total)` for rows where `row.status === 'sent'` (**per-row cap** prevents negative pending from overpayment)
- `pending` = `max(0, billed - received)`
- `progressRatio` = `billed === 0 ? 0 : clamp(received / billed, 0, 1)`

Pure function. No side effects. Stable output ordering is irrelevant (no iteration order dependencies).

## Tests required

1. Empty rows → all zeros.
2. Single sent paid → `billed === received`, `pending === 0`, `progressRatio === 1`.
3. Single sent over-paid → `received` is capped at `total`, `pending === 0`, `progressRatio === 1`.
4. Mixed statuses → only sent contribute to `billed`.
5. Property-based: for 100 random rows, `pending === max(0, billed - received)` holds.
