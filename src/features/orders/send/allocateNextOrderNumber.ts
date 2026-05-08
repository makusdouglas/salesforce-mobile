// 011-order-email-delivery: pure + stateful allocation helpers for the
// per-year `#YYYY-NNNN` order number.
//
// - `formatOrderNumber` / `parseOrderNumber` are pure.
// - `allocateNextNumber({ year, taken })` is pure — used by the sync push
//   conflict resolver to pick the lowest free number given already-taken ones.
// - `allocateNextOrderNumber(year)` is stateful — wraps
//   `orderNumberCountersRepository.allocateNext`; MUST run inside a caller-
//   opened `database.write(...)` action. See contracts/allocateNextOrderNumber.md.

import { orderNumberCountersRepository } from '@/data/repositories/orderNumberCountersRepository';

const MAX_N = 9999;

export class OrderNumberOverflowError extends Error {
  readonly code = 'ORDER_NUMBER_OVERFLOW';
  constructor(year: number, n: number) {
    super(`Order number overflow for year ${year}: ${n} > ${MAX_N}`);
    this.name = 'OrderNumberOverflowError';
  }
}

export function formatOrderNumber(year: number, n: number): string {
  if (n < 1 || n > MAX_N) throw new OrderNumberOverflowError(year, n);
  return `#${String(year).padStart(4, '0')}-${String(n).padStart(4, '0')}`;
}

const PARSE_RE = /^#(\d{4})-(\d{4})$/;

export function parseOrderNumber(s: string): { year: number; n: number } | null {
  const m = PARSE_RE.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const n = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(n)) return null;
  return { year, n };
}

/**
 * Pure: given a year and a list of already-taken order numbers (any format
 * — non-matching entries are ignored), return the next available
 * `#YYYY-NNNN` by picking the lowest positive integer NOT in the set.
 */
export function allocateNextNumber(input: {
  readonly year: number;
  readonly taken: readonly string[];
}): string {
  const takenSet = new Set<number>();
  for (const s of input.taken) {
    const parsed = parseOrderNumber(s);
    if (parsed && parsed.year === input.year) {
      takenSet.add(parsed.n);
    }
  }
  let n = 1;
  while (takenSet.has(n)) n += 1;
  return formatOrderNumber(input.year, n);
}

/**
 * Stateful allocator. MUST be called inside a caller-opened
 * `database.write(...)` action. Returns a formatted `#YYYY-NNNN` string.
 */
export async function allocateNextOrderNumber(year: number): Promise<string> {
  const n = await orderNumberCountersRepository.allocateNext(year);
  return formatOrderNumber(year, n);
}
