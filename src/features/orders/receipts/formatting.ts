// 012-payment-receipts: local formatting helpers for the receipts surfaces.
//
// Amount convention: BRL decimals (e.g. 194.50) — matches the rest of the
// codebase (orders.discount_amount, order_items.unit_price, etc. are all
// numeric(12,2)). DO NOT use integer-cents here — computeReceiptTotals is
// fed directly from computeOrderTotals, which emits BRL decimals.

import { formatBRL as baseFormatBRL } from '../formatting/formatBRL';

const METHOD_LABELS = {
  cash: 'Dinheiro',
  pix: 'Pix',
  transfer: 'Transferência',
  check: 'Cheque',
  other: 'Outro',
} as const;

export function methodLabel(method: keyof typeof METHOD_LABELS): string {
  return METHOD_LABELS[method];
}

export const METHOD_LABELS_MAP = METHOD_LABELS;

/**
 * Format a BRL decimal. Delegates to orders/formatting/formatBRL but stays
 * locally re-exported so the receipts sub-tree does not have to thread the
 * import through every file.
 */
export function formatBRL(amount: number): string {
  return baseFormatBRL(amount);
}

/**
 * Parse the string produced by a BRL-decimal text input.
 *
 * Convention (matches how the seller types):
 *   - Digits only (no separator) → whole reais. "10" = R$ 10,00,
 *     "150" = R$ 150,00. No implicit centavos split.
 *   - With a separator (`,` or `.`) → reais + centavos. The LAST separator
 *     is the decimal marker; earlier ones are group separators and are
 *     dropped. "10,5" = R$ 10,50, "10,50" = R$ 10,50, "1.234,50" =
 *     R$ 1.234,50, "1,234.50" = R$ 1.234,50.
 *   - Empty / garbage → 0.
 */
export function parseBRL(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;

  // Detect leading minus (ASCII hyphen, Unicode minus, em-dash). Used by
  // the receipt-correction form so a seller can type "-10" directly.
  const isNegative = /^[-−—]/.test(trimmed);
  const rest = isNegative ? trimmed.slice(1).trim() : trimmed;

  const hasSeparator = /[.,]/.test(rest);
  let value: number;
  if (!hasSeparator) {
    const digitsOnly = rest.replace(/\D/g, '');
    if (digitsOnly === '') return 0;
    const asInt = parseInt(digitsOnly, 10);
    value = Number.isFinite(asInt) ? asInt : 0;
  } else {
    const lastComma = rest.lastIndexOf(',');
    const lastDot = rest.lastIndexOf('.');
    const decimalSepIndex = Math.max(lastComma, lastDot);

    const intPart = rest.slice(0, decimalSepIndex).replace(/\D/g, '');
    const decPart = rest.slice(decimalSepIndex + 1).replace(/\D/g, '');
    const combined = `${intPart === '' ? '0' : intPart}.${decPart === '' ? '0' : decPart}`;
    const parsed = parseFloat(combined);
    value = Number.isFinite(parsed) ? parsed : 0;
  }

  return isNegative ? -value : value;
}

/** Short date: "23 abr 2026". */
export function formatShortDatePt(ms: number): string {
  const d = new Date(ms);
  const day = d.getDate().toString().padStart(2, '0');
  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  const month = months[d.getMonth()] ?? '';
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}
