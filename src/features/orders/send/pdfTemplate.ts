// 011-order-email-delivery: pure HTML builder for the order PDF quote.
// Feeds `Print.printToFileAsync`. See contracts/pdfTemplate.md.
//
// Pixel-locked to the Pencil frame "PDF Template / A4" (id 6iIjz).
// A4 portrait page with 48/48/36/48 pt padding, sectioned as:
//   1. header — "PROPOSTA COMERCIAL" micro-label + order number (left),
//      issue date + non-fiscal caption (right).
//   2. divider hairline.
//   3. parties — VENDEDOR / CLIENTE stacked blocks.
//   4. items table — bordered card with #FAFAFA header row.
//   5. totals card — right-aligned, 280pt wide, #FAFAFA fill.
//   6. footer — two-line disclaimer pinned to the bottom.
//
// Totals are computed by `computeOrderTotals` (009) — this template NEVER
// reimplements discount or total math (FR-010 / SC-004). Non-fiscal
// wording is guarded by pdfTemplate.nofiscal.test.ts (FR-008 / SC-003).

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
  readonly salesperson: {
    readonly name: string;
    readonly email?: string | null;
  };
  readonly client: {
    readonly name: string;
    readonly email: string | null;
    readonly phone: string | null;
    readonly taxId?: string | null;
    readonly addressLine?: string | null;
  };
  readonly items: readonly PdfOrderLine[];
  readonly orderDiscount: {
    readonly amountCents: number;
    readonly mode: 'amount' | 'percent';
  };
}

const NON_FISCAL_CAPTION = 'Documento sem valor fiscal';
const NON_FISCAL_FOOTER =
  'Este documento é uma proposta comercial. NÃO POSSUI valor fiscal.';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatDiscountLabel(
  mode: 'amount' | 'percent',
  value: number,
): string {
  if (value <= 0) return '—';
  if (mode === 'percent') return `−${value}%`;
  return `−${formatBRL(value)}`;
}

export function renderOrderPdfHtml(input: PdfOrderInput): string {
  const orderForTotals: OrderForTotals = {
    discount: {
      mode: input.orderDiscount.mode,
      value: input.orderDiscount.amountCents,
    },
  };
  const linesForTotals: OrderLineForTotals[] = input.items.map((l) => ({
    id: l.id,
    quantity: l.quantity,
    unitPrice: l.unitPriceCents,
    discount: { mode: l.discountMode, value: l.discountAmountCents },
  }));
  const totals = computeOrderTotals(orderForTotals, linesForTotals);

  const dateLabel = formatShortDatePt(input.issuedAtMs);
  const clientCnpj = formatCnpj(input.client.taxId ?? null);
  const clientContactLine =
    input.client.email ?? input.client.phone ?? null;

  const rows = input.items
    .map((l, i) => {
      const per = totals.perLine[i]!;
      const productLabel = l.variantLabel
        ? `${escapeHtml(l.productName)} <span class="variant">· ${escapeHtml(l.variantLabel)}</span>`
        : escapeHtml(l.productName);
      const discountCell = formatDiscountLabel(
        l.discountMode,
        l.discountAmountCents,
      );
      const isLast = i === input.items.length - 1;
      return `
        <tr class="${isLast ? 'row row-last' : 'row'}">
          <td class="qty">${l.quantity}</td>
          <td class="prod">${productLabel}</td>
          <td class="unit">${formatBRL(l.unitPriceCents)}</td>
          <td class="disc ${l.discountAmountCents > 0 ? 'disc-on' : 'disc-off'}">${discountCell}</td>
          <td class="total">${formatBRL(per.lineTotal)}</td>
        </tr>
      `;
    })
    .join('');

  const lineDiscountsRow =
    totals.lineDiscountsTotal > 0
      ? `<div class="totals-row pos"><span>Descontos por item</span><span>−${formatBRL(totals.lineDiscountsTotal)}</span></div>`
      : '';
  const orderDiscountRow =
    totals.orderDiscount > 0
      ? `<div class="totals-row pos"><span>Desconto do pedido</span><span>−${formatBRL(totals.orderDiscount)}</span></div>`
      : '';

  // Generation timestamp for the footer line. Same source as `dateLabel`
  // (issued at) — kept as a separate variable in case we later surface an
  // independent "generated at" that differs from the fiscal issue date.
  const generatedLabel = dateLabel;
  const salespersonFooter = [
    escapeHtml(input.salesperson.name),
    input.salesperson.email ? escapeHtml(input.salesperson.email) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Pedido ${escapeHtml(input.orderNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #0a0a0a;
      font-size: 12px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 595px;
      min-height: 842px;
      padding: 48px 48px 36px 48px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* 1. Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header .left .kicker {
      font-size: 11px;
      font-weight: 500;
      color: #737373;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .header .left .order-number {
      font-size: 22px;
      font-weight: 700;
      color: #0a0a0a;
      margin-top: 4px;
      font-variant-numeric: tabular-nums;
    }
    .header .right {
      text-align: right;
    }
    .header .right .issued {
      font-size: 12px;
      font-weight: 500;
      color: #0a0a0a;
    }
    .header .right .caption {
      font-size: 10px;
      color: #a3a3a3;
      margin-top: 4px;
    }
    .hairline {
      height: 1px;
      background: #e4e4e7;
    }

    /* 2. Parties */
    .parties {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .party .label {
      font-size: 10px;
      font-weight: 600;
      color: #737373;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }
    .party .name {
      font-size: 13px;
      font-weight: 600;
      color: #0a0a0a;
      margin-top: 2px;
    }
    .party .sub {
      font-size: 11px;
      color: #404040;
      margin-top: 2px;
    }

    /* 3. Items table */
    .items {
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      overflow: hidden;
    }
    .items table { width: 100%; border-collapse: collapse; }
    .items thead th {
      background: #fafafa;
      font-size: 10px;
      font-weight: 600;
      color: #525252;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid #e4e4e7;
    }
    .items thead th.unit,
    .items thead th.disc,
    .items thead th.total { text-align: right; }
    .items thead th.qty { width: 40px; }
    .items thead th.unit { width: 70px; }
    .items thead th.disc { width: 60px; }
    .items thead th.total { width: 72px; }
    .items td {
      padding: 10px 12px;
      border-bottom: 1px solid #e4e4e7;
      font-size: 12px;
      color: #0a0a0a;
    }
    .items tr.row-last td { border-bottom: 0; }
    .items td.qty { font-variant-numeric: tabular-nums; }
    .items td.prod .variant { color: #737373; }
    .items td.unit,
    .items td.disc,
    .items td.total {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .items td.disc-off { color: #a3a3a3; }
    .items td.disc-on { color: #047857; }
    .items td.total {
      font-weight: 600;
    }

    /* 4. Totals card (right-aligned) */
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
    }
    .totals-card {
      width: 280px;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      background: #fafafa;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .totals-row > span:first-child { color: #525252; }
    .totals-row > span:last-child {
      color: #0a0a0a;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .totals-row.pos > span { color: #047857; }
    .totals-divider {
      height: 1px;
      background: #e4e4e7;
    }
    .totals-grand {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .totals-grand .label {
      font-size: 13px;
      font-weight: 700;
      color: #0a0a0a;
    }
    .totals-grand .value {
      font-size: 18px;
      font-weight: 700;
      color: #0a0a0a;
      font-variant-numeric: tabular-nums;
    }

    /* 5. Footer — pinned to the bottom via a flex spacer above it. */
    .spacer { flex: 1 0 auto; }
    .footer {
      border-top: 1px solid #e4e4e7;
      padding-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .footer .line-1 {
      font-size: 10px;
      color: #737373;
    }
    .footer .line-2 {
      font-size: 10px;
      color: #a3a3a3;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="left">
        <div class="kicker">Proposta comercial</div>
        <div class="order-number">${escapeHtml(input.orderNumber)}</div>
      </div>
      <div class="right">
        <div class="issued">${escapeHtml(dateLabel)}</div>
        <div class="caption">${NON_FISCAL_CAPTION}</div>
      </div>
    </div>

    <div class="hairline"></div>

    <div class="parties">
      <div class="party">
        <div class="label">Vendedor</div>
        <div class="name">${escapeHtml(input.salesperson.name)}</div>
        ${
          input.salesperson.email
            ? `<div class="sub">${escapeHtml(input.salesperson.email)}</div>`
            : ''
        }
      </div>
      <div class="party">
        <div class="label">Cliente</div>
        <div class="name">${escapeHtml(input.client.name)}</div>
        ${clientCnpj ? `<div class="sub">CNPJ ${escapeHtml(clientCnpj)}</div>` : ''}
        ${
          input.client.addressLine
            ? `<div class="sub">${escapeHtml(input.client.addressLine)}</div>`
            : ''
        }
        ${
          clientContactLine
            ? `<div class="sub">${escapeHtml(clientContactLine)}</div>`
            : ''
        }
      </div>
    </div>

    <div class="items">
      <table>
        <thead>
          <tr>
            <th class="qty">Qtd</th>
            <th class="prod">Produto</th>
            <th class="unit">Un.</th>
            <th class="disc">Desc.</th>
            <th class="total">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="totals-wrap">
      <div class="totals-card">
        <div class="totals-row"><span>Subtotal</span><span>${formatBRL(totals.subtotal)}</span></div>
        ${lineDiscountsRow}
        ${orderDiscountRow}
        <div class="totals-divider"></div>
        <div class="totals-grand">
          <span class="label">Total</span>
          <span class="value">${formatBRL(totals.total)}</span>
        </div>
      </div>
    </div>

    <div class="spacer"></div>

    <div class="footer">
      <div class="line-1">${NON_FISCAL_FOOTER}</div>
      <div class="line-2">Gerado em ${escapeHtml(generatedLabel)}${salespersonFooter ? ` · ${salespersonFooter}` : ''}</div>
    </div>
  </div>
</body>
</html>`;
}
