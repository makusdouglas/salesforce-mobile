/**
 * Month-string helpers for the OrdersOverview filter.
 *
 * Format: 'YYYY-MM' (e.g. '2026-04'). Local timezone — the seller thinks
 * in their own calendar, not UTC.
 */

export function monthKeyForDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

export function currentMonthKey(now: Date = new Date()): string {
  return monthKeyForDate(now);
}

/**
 * [startMs, endMs) for the given month key, in local time. The end is
 * exclusive — matches observeOrdersForMonth's window contract.
 */
export function monthKeyToRange(key: string): {
  startMs: number;
  endMs: number;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) {
    throw new Error(`invalid month key: ${key}`);
  }
  const year = Number.parseInt(match[1] ?? '0', 10);
  const month = Number.parseInt(match[2] ?? '0', 10);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function shiftMonth(key: string, delta: number): string {
  const { startMs } = monthKeyToRange(key);
  const d = new Date(startMs);
  d.setMonth(d.getMonth() + delta);
  return monthKeyForDate(d);
}

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/** Pretty pt-BR label, e.g. 'Abril 2026'. */
export function formatMonthKeyPt(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  const year = match[1];
  const month = Number.parseInt(match[2] ?? '1', 10);
  const name = MONTHS_PT[month - 1] ?? '';
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return `${cap} ${year}`;
}
