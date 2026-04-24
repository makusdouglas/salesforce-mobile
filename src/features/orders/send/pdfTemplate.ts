// 011-order-email-delivery: pure HTML builder for the order PDF quote.
// Feeds `Print.printToFileAsync`. See contracts/pdfTemplate.md.
//
// Totals are computed by `computeOrderTotals` (009) — this template NEVER
// reimplements discount or total math (FR-010 / SC-004).
//
// The header carries "Documento sem valor fiscal" and the footer carries a
// matching disclaimer. No CNPJ blocks, no tax codes, no fiscal language —
// see pdfTemplate.nofiscal.test.ts for the static guarantee (FR-008 / SC-003).

import { computeOrderTotals } from '../totals/computeOrderTotals';
import type { OrderForTotals, OrderLineForTotals } from '../totals/types';
import { formatBRL } from '../formatting/formatBRL';
import { formatShortDatePt } from '../formatting/formatShortDatePt';

export interface PdfOrderLine {
  readonly id: string;
  readonly productName: string;
  readonly variantLabel: string | null;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly discountAmountCents: number;
  readonly discountMode: 'amount' | 'percent';
}

export interface PdfOrderInput {
  readonly orderNumber: string; // '#YYYY-NNNN'
  readonly issuedAtMs: number;
  readonly salesperson: { readonly name: string };
  readonly client: {
    readonly name: string;
    readonly email: string | null;
    readonly phone: string | null;
  };
  readonly items: readonly PdfOrderLine[];
  readonly orderDiscount: { readonly amountCents: number; readonly mode: 'amount' | 'percent' };
}

const NON_FISCAL_HEADER = 'Documento sem valor fiscal';
const NON_FISCAL_FOOTER =
  'Este documento é um orçamento / proposta comercial. NÃO POSSUI valor fiscal.';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDiscountLabel(mode: 'amount' | 'percent', value: number, subtotal: number): string {
  if (value <= 0) return '—';
  if (mode === 'percent') return `−${value}%`;
  return `−${formatBRL(value)}${value >= subtotal && subtotal > 0 ? '' : ''}`;
}

export function renderOrderPdfHtml(input: PdfOrderInput): string {
  const orderForTotals: OrderForTotals = {
    discount: { mode: input.orderDiscount.mode, value: input.orderDiscount.amountCents },
  };
  const linesForTotals: OrderLineForTotals[] = input.items.map((l) => ({
    id: l.id,
    quantity: l.quantity,
    unitPrice: l.unitPriceCents,
    discount: { mode: l.discountMode, value: l.discountAmountCents },
  }));

  const totals = computeOrderTotals(orderForTotals, linesForTotals);

  const dateLabel = formatShortDatePt(input.issuedAtMs);
  const rows = input.items
    .map((l, i) => {
      const per = totals.perLine[i]!;
      const productLabel = l.variantLabel
        ? `${l.productName} <span class="variant">· ${escapeHtml(l.variantLabel)}</span>`
        : escapeHtml(l.productName);
      return `
        <tr>
          <td class="qty">${l.quantity}</td>
          <td class="prod">${productLabel}</td>
          <td class="unit">${formatBRL(l.unitPriceCents)}</td>
          <td class="disc">${formatDiscountLabel(l.discountMode, l.discountAmountCents, per.lineSubtotal)}</td>
          <td class="total">${formatBRL(per.lineTotal)}</td>
        </tr>
      `;
    })
    .join('');

  const orderDiscountRow =
    totals.orderDiscount > 0
      ? `<div class="totals-row"><span>Desconto do pedido</span><span>−${formatBRL(totals.orderDiscount)}</span></div>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Pedido ${escapeHtml(input.orderNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #18181b; margin: 0; padding: 32px; font-size: 12px; line-height: 1.45; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #e4e4e7; }
    .title { font-size: 18px; font-weight: 700; }
    .order-meta { text-align: right; color: #3f3f46; }
    .order-number { font-size: 14px; font-weight: 700; color: #18181b; }
    .chip { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #fef3c7; color: #78350f; font-size: 10px; font-weight: 700; letter-spacing: 0.02em; margin-top: 6px; }
    .parties { display: flex; gap: 32px; padding: 20px 0; border-bottom: 1px solid #e4e4e7; }
    .party { flex: 1; }
    .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; margin: 0 0 6px; font-weight: 700; }
    .party .name { font-size: 13px; font-weight: 600; }
    .party .sub { color: #52525b; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; font-weight: 700; border-bottom: 1px solid #e4e4e7; padding: 8px 6px; }
    th.unit, th.disc, th.total { text-align: right; }
    th.qty { width: 40px; }
    td { padding: 10px 6px; border-bottom: 1px solid #f4f4f5; vertical-align: top; }
    td.qty { font-weight: 600; }
    td.unit, td.disc, td.total { text-align: right; font-variant-numeric: tabular-nums; }
    td.disc { color: #b45309; }
    td.total { font-weight: 600; }
    td .variant { color: #71717a; font-weight: 400; }
    .totals-card { margin-top: 20px; margin-left: auto; width: 260px; border: 1px solid #e4e4e7; border-radius: 10px; padding: 14px 16px; }
    .totals-row { display: flex; justify-content: space-between; font-size: 12px; color: #3f3f46; padding: 3px 0; }
    .totals-row.grand { border-top: 1px solid #e4e4e7; margin-top: 8px; padding-top: 10px; font-weight: 700; color: #18181b; font-size: 14px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e4e4e7; font-size: 10px; color: #71717a; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Pedido</div>
      <div class="chip">${NON_FISCAL_HEADER}</div>
    </div>
    <div class="order-meta">
      <div class="order-number">${escapeHtml(input.orderNumber)}</div>
      <div>${dateLabel}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Vendedor</h3>
      <div class="name">${escapeHtml(input.salesperson.name)}</div>
    </div>
    <div class="party">
      <h3>Cliente</h3>
      <div class="name">${escapeHtml(input.client.name)}</div>
      ${input.client.email ? `<div class="sub">${escapeHtml(input.client.email)}</div>` : ''}
      ${input.client.phone ? `<div class="sub">${escapeHtml(input.client.phone)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="qty">Qtd</th>
        <th>Produto</th>
        <th class="unit">Un.</th>
        <th class="disc">Desc.</th>
        <th class="total">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals-card">
    <div class="totals-row"><span>Subtotal</span><span>${formatBRL(totals.subtotal)}</span></div>
    ${totals.lineDiscountsTotal > 0 ? `<div class="totals-row"><span>Descontos por item</span><span>−${formatBRL(totals.lineDiscountsTotal)}</span></div>` : ''}
    ${orderDiscountRow}
    <div class="totals-row grand"><span>Total</span><span>${formatBRL(totals.total)}</span></div>
  </div>

  <div class="footer">${NON_FISCAL_FOOTER}</div>
</body>
</html>`;
}
