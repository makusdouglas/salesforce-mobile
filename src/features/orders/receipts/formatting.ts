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
 * Parse the string produced by a BRL-decimal text input. Accepts typical
 * user shapes: "150", "150,00", "150.00", "1.234,50", "1,234.50". Empty
 * / non-numeric → 0.
 *
 * Digit-only input uses the "rightmost two digits are centavos" convention
 * so a decimal-pad keyboard without a comma key still lands the user on
 * the right value ("15000" → 150.00).
 */
export function parseBRL(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;

  // Detect whether the input contains any decimal separator at all.
  const hasSeparator = /[.,]/.test(trimmed);
  if (!hasSeparator) {
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly === '') return 0;
    // Digits-only: treat rightmost two as centavos.
    const asInt = parseInt(digitsOnly, 10);
    if (!Number.isFinite(asInt)) return 0;
    return asInt / 100;
  }

  // With a separator: strip group separators, normalize the decimal to '.'.
  // We assume the LAST separator is the decimal marker — common across the
  // forms pt-BR users type: "1.234,50" OR "1,234.50" OR plain "150,00".
  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');
  const decimalSepIndex = Math.max(lastComma, lastDot);
  if (decimalSepIndex === -1) return 0;

  const intPart = trimmed.slice(0, decimalSepIndex).replace(/[.,\s]/g, '');
  const decPart = trimmed.slice(decimalSepIndex + 1).replace(/\D/g, '');
  const combined = `${intPart === '' ? '0' : intPart}.${decPart === '' ? '0' : decPart}`;
  const parsed = parseFloat(combined);
  return Number.isFinite(parsed) ? parsed : 0;
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
