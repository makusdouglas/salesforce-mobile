import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { ReportData } from './buildReportData';
import { buildReportCsv } from './buildReportCsv';
import { renderReportHtml } from './renderReportHtml';

export type ExportFormat = 'pdf' | 'csv';

export type ExportReportResult = {
  readonly format: ExportFormat;
  readonly filePath: string;
  readonly shared: boolean;
};

/**
 * 013-orders-overview: write a report to cache + open the share sheet.
 * Mirrors the pattern in `orderSendService.ts` so the UX stays consistent.
 *
 * The PDF path goes through `expo-print` with the HTML from
 * `renderReportHtml`; the CSV path is a direct write of
 * `buildReportCsv` with a UTF-8 BOM so Excel on Windows reads the
 * accented labels correctly.
 */
export async function exportReport(params: {
  data: ReportData;
  format: ExportFormat;
}): Promise<ExportReportResult> {
  const { data, format } = params;
  const filename = buildFilename(data, format);
  const cacheDir =
    (FileSystem as unknown as { cacheDirectory: string | null }).cacheDirectory ?? '';
  const dir = `${cacheDir}reports/`;

  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => undefined,
  );

  let filePath: string;
  if (format === 'pdf') {
    const html = renderReportHtml(data);
    const result = await Print.printToFileAsync({ html });
    filePath = `${dir}${filename}`;
    // `printToFileAsync` writes to a random path; move it into our
    // reports/ cache so the share sheet displays a stable filename.
    await FileSystem.moveAsync({ from: result.uri, to: filePath });
  } else {
    const csv = buildReportCsv(data);
    filePath = `${dir}${filename}`;
    // Prepend a UTF-8 BOM so Excel opens accented pt-BR correctly.
    await FileSystem.writeAsStringAsync(filePath, `﻿${csv}`, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
      dialogTitle:
        format === 'pdf'
          ? 'Compartilhar relatório (PDF)'
          : 'Compartilhar relatório (CSV)',
      UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
    });
    shared = true;
  }

  return { format, filePath, shared };
}

function buildFilename(data: ReportData, format: ExportFormat): string {
  const d = new Date(data.generatedAtMs);
  const iso = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const ext = format === 'pdf' ? 'pdf' : 'csv';
  return `relatorio-pedidos-${iso}.${ext}`;
}
