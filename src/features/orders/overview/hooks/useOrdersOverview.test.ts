/**
 * 013-orders-overview: render-time tests for useOrdersOverview are
 * deferred per §9 (no in-repo RN test renderer). The pure pieces of
 * the pipeline are locked by:
 *   - selectors/totalFromItemsAndOrder.test.ts
 *   - selectors/computeOrdersOverviewSummary.test.ts
 *   - selectors/applyFilters.test.ts
 *   - selectors/monthRange.test.ts
 *   - payment/derivePaymentStatus.test.ts
 *
 * This suite captures the pipeline's contract end-to-end by composing
 * the same selectors the hook composes, without instantiating the
 * Watermelon-backed repos.
 */

import { derivePaymentStatus } from '../../payment/derivePaymentStatus';
import { applyFilters } from '../selectors/applyFilters';
import { computeOrdersOverviewSummary } from '../selectors/computeOrdersOverviewSummary';
import { totalFromItemsAndOrder } from '../selectors/totalFromItemsAndOrder';
import type { OrderOverviewRowDTO } from '../types';

function pipelineRow(
  order: { id: string; status: 'draft' | 'sent' | 'canceled'; discountAmount: number },
  items: Array<{ orderId: string; quantity: number; unitPrice: number; discountAmount: number }>,
  receipts: Array<{ amount: number }>,
): OrderOverviewRowDTO {
  const total = totalFromItemsAndOrder(order, items);
  const received = receipts.reduce((acc, r) => acc + r.amount, 0);
  return {
    id: order.id,
    shortId: `#${order.id.slice(-4).toUpperCase()}`,
    clientId: 'c',
    clientName: 'Cliente',
    status: order.status,
    total,
    itemCount: items.filter((it) => it.orderId === order.id).length,
    received,
    paymentStatus: derivePaymentStatus({ status: order.status, total, received }),
    effectiveTimestampMs: 0,
    timestampLabel:
      order.status === 'sent'
        ? 'enviado'
        : order.status === 'canceled'
          ? 'cancelado'
          : 'atualizado',
  };
}

describe('useOrdersOverview pipeline — end-to-end math', () => {
  it('paid sent order → summary billed===received, pending 0', () => {
    const row = pipelineRow(
      { id: 'o1', status: 'sent', discountAmount: 0 },
      [{ orderId: 'o1', quantity: 1, unitPrice: 100, discountAmount: 0 }],
      [{ amount: 100 }],
    );
    expect(row.total).toBe(100);
    expect(row.received).toBe(100);
    expect(row.paymentStatus).toBe('paid');

    const filtered = applyFilters([row], { status: 'paid', query: '' });
    expect(filtered).toHaveLength(1);
    const summary = computeOrdersOverviewSummary(filtered);
    expect(summary).toMatchObject({
      ordersCount: 1,
      billed: 100,
      received: 100,
      pending: 0,
    });
  });

  it('mixed window: drafts and canceled excluded from billed/received', () => {
    const rows = [
      pipelineRow(
        { id: 'draftA', status: 'draft', discountAmount: 0 },
        [{ orderId: 'draftA', quantity: 1, unitPrice: 500, discountAmount: 0 }],
        [],
      ),
      pipelineRow(
        { id: 'sentB', status: 'sent', discountAmount: 10 },
        [{ orderId: 'sentB', quantity: 1, unitPrice: 210, discountAmount: 0 }], // 200
        [{ amount: 80 }],
      ),
      pipelineRow(
        { id: 'canceledC', status: 'canceled', discountAmount: 0 },
        [{ orderId: 'canceledC', quantity: 1, unitPrice: 999, discountAmount: 0 }],
        [{ amount: 50 }],
      ),
    ];
    const summary = computeOrdersOverviewSummary(rows);
    expect(summary.billed).toBe(200);
    expect(summary.received).toBe(80);
    expect(summary.pending).toBe(120);
    expect(summary.ordersCount).toBe(3);
  });

  it('search filter composes with status filter', () => {
    const rows = [
      pipelineRow(
        { id: 'padariaX', status: 'sent', discountAmount: 0 },
        [{ orderId: 'padariaX', quantity: 1, unitPrice: 100, discountAmount: 0 }],
        [],
      ),
      pipelineRow(
        { id: 'mercadoY', status: 'sent', discountAmount: 0 },
        [{ orderId: 'mercadoY', quantity: 1, unitPrice: 100, discountAmount: 0 }],
        [],
      ),
    ].map((r, i) => ({ ...r, clientName: i === 0 ? 'Padaria' : 'Mercado' }));
    const out = applyFilters(rows, { status: 'pending', query: 'pad' });
    expect(out.map((r) => r.id)).toEqual(['padariaX']);
  });

  it('mutation scenario: adding a receipt bumps the row from pending → partial → paid', () => {
    const base = {
      order: { id: 'o1', status: 'sent' as const, discountAmount: 0 },
      items: [{ orderId: 'o1', quantity: 1, unitPrice: 100, discountAmount: 0 }],
    };
    const pending = pipelineRow(base.order, base.items, []);
    const partial = pipelineRow(base.order, base.items, [{ amount: 40 }]);
    const paid = pipelineRow(base.order, base.items, [{ amount: 40 }, { amount: 60 }]);
    expect(pending.paymentStatus).toBe('pending');
    expect(partial.paymentStatus).toBe('partial');
    expect(paid.paymentStatus).toBe('paid');
  });
});
