import { formatMonthKeyPt } from '../selectors/monthRange';
import type { ReportData } from './buildReportData';

/**
 * 013-orders-overview: CSV serializer (pt-BR friendly).
 *
 * - Semicolon separator (';') — the default Excel pt-BR expects.
 * - Decimal comma for BRL values.
 * - A header row per month (`Mês; <label>; ...`) before its detail rows
 *   so the file stays human-skimmable.
 *
 * Pure — no I/O. Returns a string. Encoding is left to the caller
 * (exportReport writes UTF-8 with BOM so Excel on Windows reads it).
 */
export function buildReportCsv(data: ReportData): string {
  const sep = ';';
  const lines: string[] = [];

  lines.push(`Relatório de pedidos`);
  lines.push(`Gerado em${sep}${formatTimestampPtBR(data.generatedAtMs)}`);
  if (data.salespersonName) {
    lines.push(`Vendedor${sep}${escape(data.salespersonName)}`);
  }
  lines.push('');

  for (const bucket of data.monthlyBuckets) {
    lines.push(`Mês${sep}${escape(formatMonthKeyPt(bucket.monthKey))}`);
    lines.push(
      [
        `Pedidos${sep}${bucket.summary.ordersCount}`,
        `Faturado${sep}${formatBRL(bucket.summary.billed)}`,
        `Recebido${sep}${formatBRL(bucket.summary.received)}`,
        `Pendente${sep}${formatBRL(bucket.summary.pending)}`,
      ].join(sep),
    );
    lines.push('');
    lines.push(
      [
        'Número',
        'Cliente',
        'Status',
        'Pagamento',
        'Total',
        'Recebido',
        'Data',
      ]
        .map(escape)
        .join(sep),
    );
    for (const row of bucket.rows) {
      lines.push(
        [
          row.shortId,
          row.clientName,
          statusLabel(row.status),
          row.paymentStatus ? paymentLabel(row.paymentStatus) : '',
          formatBRL(row.total),
          formatBRL(row.received),
          formatTimestampPtBR(row.effectiveTimestampMs),
        ]
          .map(escape)
          .join(sep),
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function statusLabel(status: 'draft' | 'sent' | 'canceled'): string {
  return status === 'draft'
    ? 'Rascunho'
    : status === 'sent'
      ? 'Enviado'
      : 'Cancelado';
}

function paymentLabel(
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
  // pt-BR with comma decimal, no separator/currency — callers can add
  // R$ in their rendering. CSV prefers raw numbers so Excel parses them.
  return value.toFixed(2).replace('.', ',');
}

function formatTimestampPtBR(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

function escape(value: string | number): string {
  const s = String(value);
  if (s.includes('"') || s.includes(';') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
