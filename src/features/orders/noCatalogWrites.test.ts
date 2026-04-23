/**
 * 009-order-assembly — R5 repo-wide static lock.
 * 010-repeat-last-order — scan root widened to cover clients/ screens and
 * the repeat code path; added a second assertion enforcing FR-016's
 * offline-only guarantee for the clone flow.
 *
 * Scans non-test files along the repeat and order-assembly code paths for:
 *   (a) catalog-table write APIs (R5 lock — discounts never alter products).
 *   (b) network modules imported by the clone flow (FR-016 lock — repeat
 *       MUST work with no connectivity).
 *
 * If this test fails, revisit the touched file against the plan's
 * "Responsive strategy" and "R5 invariant" notes before adjusting the
 * scan — the intent is to surface violations early, not to placate them.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const ORDERS_ROOT = join(__dirname); // src/features/orders
const CLIENTS_ROOT = join(__dirname, '..', 'clients'); // src/features/clients

// ---------- R5: no catalog writes anywhere along the orders/clients path ----------
const FORBIDDEN_CATALOG: RegExp[] = [
  /productsCollection\s*\.\s*(create|update|destroy|prepareUpdate|prepareCreate|prepareDestroyPermanently|markAsDeleted)\s*\(/,
  /productVariantsCollection\s*\.\s*(create|update|destroy|prepareUpdate|prepareCreate|prepareDestroyPermanently|markAsDeleted)\s*\(/,
  /database\.get\(\s*['"]products['"]\s*\)[^\n;]{0,120}?\.\s*(create|update|prepareCreate|prepareUpdate|prepareDestroyPermanently|markAsDeleted)\s*\(/,
  /database\.get\(\s*['"]product_variants['"]\s*\)[^\n;]{0,120}?\.\s*(create|update|prepareCreate|prepareUpdate|prepareDestroyPermanently|markAsDeleted)\s*\(/,
  /\bproduct(?:Variant)?Instance\s*\.\s*(update|markAsDeleted|prepareUpdate|destroyPermanently)\s*\(/,
];

// ---------- FR-016: repeat code path never imports a network module ----------
// Only enforced on the files that belong to the repeat flow. Other modules
// (e.g., sync) legitimately import these.
const REPEAT_PATH_FILES: readonly string[] = [
  'src/features/orders/services/ordersService.ts',
  'src/features/orders/hooks/useRepeatOrder.ts',
  'src/features/clients/components/RepeatHeroCard.tsx',
  'src/features/clients/components/RepeatIconButton.tsx',
  'src/features/clients/components/AllUnavailableNotice.tsx',
  'src/features/clients/hooks/useLastSentOrderSummary.ts',
  'src/features/orders/components/DroppedItemsNotice.tsx',
];

const FORBIDDEN_NETWORK: RegExp[] = [
  /\bfetch\s*\(/,
  /\bglobal\.fetch\b/,
  /from\s+['"]@supabase\//,
  /from\s+['"]@\/data\/sync\//,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (
      (full.endsWith('.ts') || full.endsWith('.tsx')) &&
      !full.endsWith('.test.ts') &&
      !full.endsWith('.test.tsx')
    ) {
      acc.push(full);
    }
  }
  return acc;
}

describe('R5 static lock — orders + clients features never write to catalog tables', () => {
  const files = [...walk(ORDERS_ROOT), ...walk(CLIENTS_ROOT)];

  test('at least one source file was scanned (guard against empty-dir false positive)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = relative(REPO_ROOT, file);
    test(`${rel} — no catalog-write patterns`, () => {
      const src = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_CATALOG) {
        const match = src.match(pattern);
        if (match !== null) {
          throw new Error(
            `R5 violation in ${rel}: matched forbidden pattern ${String(pattern)} — "${match[0]}". Catalog (products / product_variants) MUST NOT be mutated by the orders or clients features.`,
          );
        }
      }
    });
  }
});

describe('FR-016 static lock — repeat code path is offline-only', () => {
  for (const relPath of REPEAT_PATH_FILES) {
    test(`${relPath} — no network-module imports`, () => {
      const full = join(REPO_ROOT, relPath);
      const src = readFileSync(full, 'utf8');
      for (const pattern of FORBIDDEN_NETWORK) {
        const match = src.match(pattern);
        if (match !== null) {
          throw new Error(
            `FR-016 violation in ${relPath}: matched forbidden pattern ${String(pattern)} — "${match[0]}". The repeat flow MUST run entirely offline (no fetch, no Supabase, no sync import).`,
          );
        }
      }
    });
  }
});
