// 017-revenue-dashboard — shared helpers used by every derivation
// module. Kept private to the folder so they don't leak into the
// public revenue API.

import type { OrderItemRow, OrderRow, PaymentReceiptRow } from './types';

export interface MonthRange {
  readonly startMs: number;
  readonly endMs: number;
  readonly key: string; // YYYY-MM
}

/**
 * Convert an ISO-style YYYY-MM-DD or YYYY-MM month key into a
 * [startMs, endMs) UTC range. Uses local time so a "month" matches
 * what the seller sees on their device clock — same convention as
 * feature 013.
 */
export function monthRangeFromKey(key: string): MonthRange {
  // Accept either YYYY-MM or YYYY-MM-DD. Normalize to first-of-month.
  const parts = key.split('-');
  const yearStr = parts[0] ?? '1970';
  const monthStr = parts[1] ?? '01';
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    key: `${yearStr}-${monthStr.padStart(2, '0')}`,
  };
}

/** YYYY-MM key for an epoch-ms timestamp. */
export function monthKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
}

/** Inclusive list of YYYY-MM keys between two month keys (inclusive). */
export function monthKeysInRange(fromKey: string, toKey: string): string[] {
  const from = monthRangeFromKey(fromKey);
  const to = monthRangeFromKey(toKey);
  const out: string[] = [];
  const cursor = new Date(from.startMs);
  const end = new Date(to.startMs);
  while (cursor.getTime() <= end.getTime()) {
    out.push(monthKeyFromMs(cursor.getTime()));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** Per-order net total: max(0, subtotal − discount). */
export function totalForOrder(
  order: OrderRow,
  items: readonly OrderItemRow[],
): number {
  const subtotal = items
    .filter((it) => it.orderId === order.id)
    .reduce(
      (acc, it) => acc + (it.quantity * it.unitPrice - it.discountAmount),
      0,
    );
  return Math.max(0, subtotal - order.discountAmount);
}

/** Sum of receipt amounts for a given order id. */
export function receiptSumForOrder(
  orderId: string,
  receipts: readonly PaymentReceiptRow[],
): number {
  return receipts
    .filter((r) => r.orderId === orderId)
    .reduce((acc, r) => acc + r.amount, 0);
}

/** Per-order pendente: max(0, total − received). */
export function pendingForOrder(
  order: OrderRow,
  items: readonly OrderItemRow[],
  receipts: readonly PaymentReceiptRow[],
): number {
  return Math.max(
    0,
    totalForOrder(order, items) - receiptSumForOrder(order.id, receipts),
  );
}

/** Subtract one calendar month from a YYYY-MM key. */
export function previousMonthKey(key: string): string {
  const range = monthRangeFromKey(key);
  const prev = new Date(range.startMs);
  prev.setMonth(prev.getMonth() - 1);
  return monthKeyFromMs(prev.getTime());
}

/** Subtract one calendar year from a YYYY-MM key. */
export function priorYearMonthKey(key: string): string {
  const range = monthRangeFromKey(key);
  const prev = new Date(range.startMs);
  prev.setFullYear(prev.getFullYear() - 1);
  return monthKeyFromMs(prev.getTime());
}
