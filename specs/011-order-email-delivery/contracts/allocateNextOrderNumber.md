# Contract: `allocateNextOrderNumber` + `allocateNextNumber`

Module: `src/features/orders/send/allocateNextOrderNumber.ts`

## Purpose

Two functions split by concern:

- `allocateNextOrderNumber(year, db)` — stateful allocator, reads + increments the `order_number_counters` row for the year.
- `allocateNextNumber({ year, taken })` — pure helper used by the sync push conflict resolver to pick the lowest free number given a list of already-used ones.

## Signatures

```ts
export async function allocateNextOrderNumber(
  year: number,
  db: Database /* injected for test */,
): Promise<string>; // e.g. '#2026-0042'

export function allocateNextNumber(input: {
  readonly year: number;
  readonly taken: readonly string[]; // ['#2026-0001', '#2026-0003', ...]
}): string;

export function formatOrderNumber(year: number, n: number): string; // '#YYYY-NNNN'
export function parseOrderNumber(s: string): { year: number; n: number } | null;
```

## Invariants

1. **Format**: output always matches `/^#\d{4}-\d{4}$/`. Padding is zero-fill to 4 digits; numbers above 9999 MUST throw `OrderNumberOverflowError` (unreachable in MVP scope; guards against future misuse).
2. **Monotonic per year on same device**: two successive `allocateNextOrderNumber(2026)` calls never return the same value, even under concurrent `database.write(...)` — the counter read + update live inside the caller's transaction.
3. **Year-scoped reset**: first allocation for a new year returns `#YYYY-0001`, independent of prior years' values.
4. **`allocateNextNumber` is pure**: no I/O, deterministic for a given `(year, taken)`. Picks the lowest positive integer not present in `taken` (after parsing + year-filtering).

## Test matrix

Covered by `allocateNextOrderNumber.test.ts`.
