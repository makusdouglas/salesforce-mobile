import type { OrderOverviewRowDTO } from '../types';
import type { ReportData } from './buildReportData';
import { buildReportCsv } from './buildReportCsv';

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

describe('buildReportCsv', () => {
  const sampleData: ReportData = {
    salespersonId: 'sp-1',
    salespersonName: 'João',
    generatedAtMs: new Date(2026, 3, 24, 10, 15).getTime(),
    monthlyBuckets: [
      {
        monthKey: '2026-04',
        summary: {
          ordersCount: 2,
          billed: 300,
          received: 200,
          pending: 100,
          progressRatio: 2 / 3,
        },
        rows: [
          row({
            id: 'o1',
            shortId: '#AAAA',
            clientName: 'Padaria São José',
            status: 'sent',
            total: 200,
            received: 200,
            paymentStatus: 'paid',
            effectiveTimestampMs: new Date(2026, 3, 20, 9, 30).getTime(),
          }),
          row({
            id: 'o2',
            shortId: '#BBBB',
            clientName: 'Mercadinho Bom Preço; LTDA', // has a semicolon → must be quoted
            status: 'sent',
            total: 100,
            received: 0,
            paymentStatus: 'pending',
          }),
        ],
      },
    ],
  };

  it('starts with the report header, generator timestamp, and vendor', () => {
    const csv = buildReportCsv(sampleData);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Relatório de pedidos');
    expect(lines[1]).toMatch(/^Gerado em;24\/04\/2026 10:15$/);
    expect(lines[2]).toBe('Vendedor;João');
  });

  it('escapes field values that contain the separator', () => {
    const csv = buildReportCsv(sampleData);
    expect(csv).toContain('"Mercadinho Bom Preço; LTDA"');
  });

  it('uses comma decimal separator for BRL values', () => {
    const csv = buildReportCsv(sampleData);
    expect(csv).toContain(';200,00;');
    expect(csv).toContain('Faturado;300,00');
  });

  it('writes a per-month block header before its detail rows', () => {
    const csv = buildReportCsv(sampleData);
    const idx = csv.indexOf('Mês;Abril 2026');
    expect(idx).toBeGreaterThan(-1);
    const detailStart = csv.indexOf('Número;Cliente;Status', idx);
    expect(detailStart).toBeGreaterThan(idx);
  });

  it('empty data yields a header-only file (no month blocks)', () => {
    const csv = buildReportCsv({
      salespersonId: 'sp-1',
      salespersonName: null,
      generatedAtMs: new Date(2026, 3, 24, 10, 15).getTime(),
      monthlyBuckets: [],
    });
    expect(csv).not.toContain('Mês;');
    expect(csv).toContain('Relatório de pedidos');
  });
});
