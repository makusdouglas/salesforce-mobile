import { formatMonthKeyPt } from '../selectors/monthRange';
import type { ReportData } from './buildReportData';

const MONTHS_SHORT = [
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

/**
 * 013-orders-overview: HTML template consumed by `expo-print`
 * (Print.printToFileAsync) to generate the PDF report.
 *
 * Pure — no I/O. Uses inline styles so the HTML renders identically
 * in the expo-print WebView on both iOS and Android.
 */
export function renderReportHtml(data: ReportData): string {
  const head = `
    <meta charset="utf-8" />
    <title>Relatório de pedidos</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, Helvetica, Arial, sans-serif;
        color: #0A0A0A;
        margin: 32px;
      }
      h1 { font-size: 22px; margin: 0 0 2px 0; }
      .meta { color: #525252; font-size: 12px; margin-bottom: 24px; }
      .month { margin-bottom: 28px; }
      h2 { font-size: 16px; margin: 0 0 6px 0; text-transform: capitalize; }
      .summary {
        display: table;
        width: 100%;
        background: #F5F5F5;
        border-radius: 6px;
        padding: 8px 12px;
        margin-bottom: 10px;
        font-size: 12px;
        color: #3F3F46;
      }
      .summary .cell {
        display: table-cell;
        padding: 4px 8px;
      }
      .summary strong { color: #0A0A0A; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E4E4E7; }
      th { background: #FAFAFA; font-weight: 600; font-size: 11px; color: #3F3F46; }
      td.num { text-align: right; font-variant: tabular-nums; }
      .status { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
      .status-draft { background: #F4F4F5; color: #3F3F46; }
      .status-sent { background: #ECFDF5; color: #047857; }
      .status-canceled { background: #FEE2E2; color: #B91C1C; }
      .payment-paid { color: #15803D; }
      .payment-partial { color: #A16207; }
      .payment-pending { color: #C2410C; }
      .payment-adjust { color: #B91C1C; }
    </style>
  `;

  const title = `<h1>Relatório de pedidos</h1>`;
  const subtitleLines: string[] = [];
  if (data.salespersonName) {
    subtitleLines.push(`Vendedor: ${escape(data.salespersonName)}`);
  }
  subtitleLines.push(`Gerado em: ${formatTimestampPtBR(data.generatedAtMs)}`);
  const meta = `<div class="meta">${subtitleLines.join(' · ')}</div>`;

  const monthsHtml = data.monthlyBuckets.map(renderMonth).join('\n');
  const empty =
    data.monthlyBuckets.length === 0
      ? `<p style="color:#737373">Nenhum pedido encontrado para este vendedor.</p>`
      : '';

  return `<!doctype html><html><head>${head}</head><body>${title}${meta}${empty}${monthsHtml}</body></html>`;
}

function renderMonth(bucket: ReportData['monthlyBuckets'][number]): string {
  const header = `<h2>${escape(formatMonthKeyPt(bucket.monthKey))}</h2>`;
  const summary = `
    <div class="summary">
      <div class="cell">Pedidos <strong>${bucket.summary.ordersCount}</strong></div>
      <div class="cell">Faturado <strong>${formatBRL(bucket.summary.billed)}</strong></div>
      <div class="cell">Recebido <strong>${formatBRL(bucket.summary.received)}</strong></div>
      <div class="cell">Pendente <strong>${formatBRL(bucket.summary.pending)}</strong></div>
    </div>
  `;

  const rows = bucket.rows
    .map((row) => {
      const statusKey = `status-${row.status}`;
      const statusLabel = statusLabelPt(row.status);
      const paymentClass = row.paymentStatus
        ? `payment-${row.paymentStatus}`
        : '';
      const paymentLabel = row.paymentStatus ? paymentLabelPt(row.paymentStatus) : '';
      return `
        <tr>
          <td>${escape(row.shortId)}</td>
          <td>${escape(row.clientName || '—')}</td>
          <td><span class="status ${statusKey}">${statusLabel}</span></td>
          <td class="${paymentClass}">${paymentLabel}</td>
          <td class="num">${formatBRL(row.total)}</td>
          <td class="num">${formatBRL(row.received)}</td>
          <td>${formatShortDatePt(row.effectiveTimestampMs)}</td>
        </tr>
      `;
    })
    .join('');

  const table = `
    <table>
      <thead>
        <tr>
          <th>Número</th>
          <th>Cliente</th>
          <th>Status</th>
          <th>Pagamento</th>
          <th>Total</th>
          <th>Recebido</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  return `<div class="month">${header}${summary}${table}</div>`;
}

function statusLabelPt(status: 'draft' | 'sent' | 'canceled'): string {
  return status === 'draft'
    ? 'Rascunho'
    : status === 'sent'
      ? 'Enviado'
      : 'Cancelado';
}

function paymentLabelPt(
  status: 'paid' | 'partial' | 'pending' | 'adjust',
): string {
  return status === 'paid'
    ? 'Pago'
    : status === 'partial'
      ? 'Parcial'
      : status === 'pending'
        ? 'Pendente'
        : 'Ajuste';
}

function formatBRL(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const raw = abs.toFixed(2);
  const [intPart, decPart] = raw.split('.');
  const withThousands = (intPart ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${withThousands},${decPart}`;
}

function formatShortDatePt(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS_SHORT[d.getMonth()] ?? '';
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatTimestampPtBR(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

function escape(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
