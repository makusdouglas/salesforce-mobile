// 011-order-email-delivery: static guarantee that the order PDF template
// cannot drift into fiscal-invoice wording. The forbidden patterns list
// here is the locked surface — extend deliberately, never silently.
//
// Two checks:
//   1. The template source file itself does not contain any forbidden marker.
//   2. A rendered HTML instance (seeded order) does not contain them either.

import fs from 'node:fs';
import path from 'node:path';

import { renderOrderPdfHtml, type PdfOrderInput } from './pdfTemplate';

const FORBIDDEN_MARKERS = [
  'NF-e',
  'Nota Fiscal',
  'CNPJ:',
  'Inscrição Estadual',
  'ICMS',
  'IPI',
];

const TEMPLATE_SOURCE = fs.readFileSync(path.join(__dirname, 'pdfTemplate.ts'), 'utf8');

describe('pdfTemplate non-fiscal guarantee', () => {
  describe('static source scan', () => {
    test.each(FORBIDDEN_MARKERS)(
      'pdfTemplate.ts does NOT contain fiscal marker %p',
      (marker) => {
        expect(TEMPLATE_SOURCE).not.toContain(marker);
      },
    );
  });

  describe('rendered HTML scan', () => {
    const seed: PdfOrderInput = {
      orderNumber: '#2026-0042',
      issuedAtMs: Date.now(),
      salesperson: { name: 'Maria Vendedora' },
      client: { name: 'Padaria Central', email: 'x@y.co', phone: '+55 11 99999-9999' },
      items: [
        {
          id: 'l1',
          productName: 'Leite',
          variantLabel: '1L',
          quantity: 1,
          unitPriceCents: 650,
          discountAmountCents: 0,
          discountMode: 'amount',
        },
      ],
      orderDiscount: { amountCents: 0, mode: 'amount' },
    };
    const html = renderOrderPdfHtml(seed);

    test.each(FORBIDDEN_MARKERS)(
      'rendered HTML does NOT contain fiscal marker %p',
      (marker) => {
        expect(html).not.toContain(marker);
      },
    );
  });
});
