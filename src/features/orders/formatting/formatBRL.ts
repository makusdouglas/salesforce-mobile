// 009-order-assembly: centralized BRL formatting. Used across screens +
// components + home drafts list so the locale / separator is consistent.
//
// Uses Intl.NumberFormat('pt-BR', …) — available in Hermes + JSC in the
// versions expo-managed ships. No external date/currency library.

const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a BRL amount. Always returns the form `R$ X,XX`. Negative inputs
 * are printed with a minus sign preceding the number: `-R$ 3,90`. Callers
 * that want a minus sign typography ("−R$ 3,90") should prefix manually.
 */
export function formatBRL(amount: number): string {
  return formatter.format(amount);
}
