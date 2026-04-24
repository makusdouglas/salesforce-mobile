// 011-order-email-delivery: pt-BR short date formatter used on the PDF
// header and the OrderSent recipient line. Format: "12 abr 2026" (day +
// 3-letter lowercase Portuguese month + 4-digit year). No separator punctuation.

const PT_MONTHS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

export function formatShortDatePt(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = PT_MONTHS[d.getMonth()] ?? '';
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}
