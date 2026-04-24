/**
 * 011-order-email-delivery: FR-021 static lock.
 *
 * Scans the send code path for any network-related import or call. The send
 * flow MUST be fully operational in airplane mode — PDF generation, file
 * IO, and intent opening are all local. Any sync reconciliation happens in
 * the sync engine, not in the send path.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

const SEND_PATH_FILES: readonly string[] = [
  'src/features/orders/send/orderSendService.ts',
  'src/features/orders/send/allocateNextOrderNumber.ts',
  'src/features/orders/send/pdfTemplate.ts',
  'src/features/orders/send/clientSlug.ts',
  'src/features/orders/send/useSendOrder.ts',
  'src/features/orders/send/openStoredPdf.ts',
  'src/features/orders/components/SendHint.tsx',
  'src/features/orders/screens/OrderSentScreen.tsx',
];

const FORBIDDEN: RegExp[] = [
  /\bfetch\s*\(/,
  /\bglobal\.fetch\b/,
  /from\s+['"]@supabase\//,
  /from\s+['"]@\/data\/sync\//,
  /from\s+['"]@\/features\/sync\//,
];

describe('FR-021 static lock — send code path is offline-only', () => {
  for (const rel of SEND_PATH_FILES) {
    test(`${rel} — no network-module imports`, () => {
      const full = join(REPO_ROOT, rel);
      const src = readFileSync(full, 'utf8');
      for (const pattern of FORBIDDEN) {
        const match = src.match(pattern);
        if (match !== null) {
          throw new Error(
            `FR-021 violation in ${rel}: matched forbidden pattern ${String(pattern)} — "${match[0]}". The send flow MUST run entirely offline.`,
          );
        }
      }
    });
  }
});
