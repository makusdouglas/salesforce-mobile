import { renderOrderPdfHtml, type PdfOrderInput } from './pdfTemplate';
import { computeOrderTotals } from '../totals/computeOrderTotals';
import { formatBRL } from '../formatting/formatBRL';

function seed(over: Partial<PdfOrderInput> = {}): PdfOrderInput {
  return {
    orderNumber: '#2026-0042',
    issuedAtMs: new Date('2026-04-23T12:00:00Z').getTime(),
    salesperson: { name: 'Maria Vendedora' },
    client: { name: 'Padaria Central', email: 'padaria@example.com', phone: '+55 11 98765-4321' },
    items: [
      {
        id: 'l1',
        productName: 'Leite Integral',
        variantLabel: '1L',
        quantity: 3,
        unitPriceCents: 650,
        discountAmountCents: 50,
        discountMode: 'amount',
      },
      {
        id: 'l2',
        productName: 'Pão Francês',
        variantLabel: null,
        quantity: 10,
        unitPriceCents: 100,
        discountAmountCents: 10,
        discountMode: 'percent',
      },
    ],
    orderDiscount: { amountCents: 0, mode: 'amount' },
    ...over,
  };
}

describe('renderOrderPdfHtml', () => {
  test('includes order number, salesperson name, client name', () => {
    const html = renderOrderPdfHtml(seed());
    expect(html).toContain('#2026-0042');
    expect(html).toContain('Maria Vendedora');
    expect(html).toContain('Padaria Central');
  });

  test('includes the non-fiscal header chip and footer disclaimer', () => {
    const html = renderOrderPdfHtml(seed());
    expect(html).toContain('Documento sem valor fiscal');
    expect(html).toContain('NÃO POSSUI valor fiscal');
  });

  test('renders one row per line item with correct totals', () => {
    const input = seed();
    const html = renderOrderPdfHtml(input);
    const totals = computeOrderTotals(
      { discount: { mode: input.orderDiscount.mode, value: input.orderDiscount.amountCents } },
      input.items.map((l) => ({
        id: l.id,
        quantity: l.quantity,
        unitPrice: l.unitPriceCents,
        discount: { mode: l.discountMode, value: l.discountAmountCents },
      })),
    );
    // Per-line totals are present in the HTML for every line.
    for (const per of totals.perLine) {
      expect(html).toContain(formatBRL(per.lineTotal));
    }
    expect(html).toContain(formatBRL(totals.total));
  });

  test('renders order discount row when set', () => {
    const html = renderOrderPdfHtml(seed({ orderDiscount: { amountCents: 200, mode: 'amount' } }));
    expect(html).toMatch(/Desconto do pedido/);
  });

  test('omits order discount row when zero', () => {
    const html = renderOrderPdfHtml(seed());
    expect(html).not.toMatch(/Desconto do pedido/);
  });

  test('uses pt-BR formatters (R$ + comma + abbreviated month)', () => {
    const html = renderOrderPdfHtml(seed());
    expect(html).toMatch(/R\$\s/);
    expect(html).toContain('23 abr 2026');
  });

  test('renders no phone block when client has no phone', () => {
    const html = renderOrderPdfHtml(
      seed({ client: { name: 'Sem Fone', email: null, phone: null } }),
    );
    expect(html).not.toMatch(/\+55/);
  });

  test('escapes HTML in client name', () => {
    const html = renderOrderPdfHtml(seed({ client: { name: '<script>alert(1)</script>', email: null, phone: null } }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
