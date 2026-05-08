import type { OrderOverviewRowDTO } from '../types';
import type { ReportData } from './buildReportData';
import { renderReportHtml } from './renderReportHtml';

function row(
  overrides: Partial<OrderOverviewRowDTO> & Pick<OrderOverviewRowDTO, 'status'>,
): OrderOverviewRowDTO {
  return {
    id: 'o',
    shortId: '#0000',
    clientId: 'c',
    clientName: 'Cliente',
    total: 0,
    itemCount: 0,
    received: 0,
    paymentStatus: null,
    effectiveTimestampMs: 0,
    timestampLabel: 'enviado',
    ...overrides,
  };
}

const sampleData: ReportData = {
  salespersonId: 'sp-1',
  salespersonName: 'João',
  generatedAtMs: new Date(2026, 3, 24, 10, 15).getTime(),
  monthlyBuckets: [
    {
      monthKey: '2026-04',
      summary: {
        ordersCount: 1,
        billed: 250,
        received: 100,
        pending: 150,
        progressRatio: 0.4,
      },
      rows: [
        row({
          id: 'o1',
          shortId: '#AAAA',
          clientName: 'Padaria & Sabor',
          status: 'sent',
          total: 250,
          received: 100,
          paymentStatus: 'partial',
        }),
      ],
    },
  ],
};

describe('renderReportHtml', () => {
  it('emits a valid HTML document with the title', () => {
    const html = renderReportHtml(sampleData);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Relatório de pedidos</title>');
    expect(html).toContain('<h1>Relatório de pedidos</h1>');
  });

  it('includes the salesperson name and formatted generation timestamp in the header', () => {
    const html = renderReportHtml(sampleData);
    expect(html).toContain('Vendedor: João');
    expect(html).toContain('Gerado em: 24/04/2026 10:15');
  });

  it('escapes HTML-sensitive characters in client names', () => {
    const html = renderReportHtml(sampleData);
    expect(html).toContain('Padaria &amp; Sabor');
    expect(html).not.toContain('Padaria & Sabor');
  });

  it('renders one month section with its summary + row table', () => {
    const html = renderReportHtml(sampleData);
    expect(html).toContain('Abril 2026');
    expect(html).toContain('Faturado');
    expect(html).toContain('R$ 250,00');
    expect(html).toContain('<td>#AAAA</td>');
    expect(html).toContain('status-sent');
    expect(html).toContain('payment-partial');
  });

  it('shows an empty-state paragraph when no buckets exist', () => {
    const html = renderReportHtml({
      salespersonId: 'sp-1',
      salespersonName: null,
      generatedAtMs: sampleData.generatedAtMs,
      monthlyBuckets: [],
    });
    expect(html).toContain('Nenhum pedido encontrado');
  });
});
