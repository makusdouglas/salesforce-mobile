# Contract: `derivePaymentStatus`

**Path**: `src/features/orders/payment/derivePaymentStatus.ts`
**Extracted from**: `src/features/clients/orders/deriveOrderHistory.ts` (feature 012)

## Signature

```typescript
export type OrderPaymentStatus = 'paid' | 'partial' | 'pending' | 'adjust';

export function derivePaymentStatus(params: {
  total: number;           // BRL decimal, order.total
  received: number;        // BRL decimal, sum(receipts.amount) — may be negative
  status: 'draft' | 'sent' | 'canceled';
}): OrderPaymentStatus | null;
```

## Semantics (frozen from feature 012)

- Returns `null` for `draft` or `canceled` — no payment expectation.
- For `sent`:
  - `received < 0` → `'adjust'` (over-correction)
  - `received > total + EPS` → `'adjust'` (overpayment)
  - `|received - total| ≤ EPS` → `'paid'`
  - `received > 0` → `'partial'`
  - otherwise → `'pending'`
- `EPS = 0.005` BRL.

## Behavioral locks

- Identical return for the same inputs as the current ClientProfile derivation (tested via a side-by-side table).
- Never mutates `orders.status`.
- Pure function — no I/O, no side effects.

## Tests required

1. Table of (total, received, status) → expected status, covering every branch.
2. Snapshot equivalence with ClientProfile for 100 random fixtures (seeded).
3. EPS boundary: `received = total - 0.004` → `paid`; `received = total - 0.006` → `partial`.
