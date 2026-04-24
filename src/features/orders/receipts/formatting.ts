// 012-payment-receipts: BRL formatting helpers for the receipt surfaces.
// Kept local to the receipts sub-tree so the existing orders/formatting
// layer is not pulled into attachment/sync modules.

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

/** Formats a cents integer as `R$ 1.234,56`. Signed: −R$ for negatives. */
export function formatCents(amountCents: number): string {
  const negative = amountCents < 0;
  const abs = Math.abs(amountCents);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  const reaisStr = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavosStr = centavos.toString().padStart(2, '0');
  const prefix = negative ? '− R$ ' : 'R$ ';
  return `${prefix}${reaisStr},${centavosStr}`;
}

/** Parses free typing ("15,00" / "15.00" / "1500") into cents. */
export function parseCents(raw: string): number {
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly === '') return 0;
  // Treat the rightmost two digits as centavos.
  return parseInt(digitsOnly, 10);
}

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
