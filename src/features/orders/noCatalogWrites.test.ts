/**
 * 009-order-assembly — R5 repo-wide static lock.
 *
 * Scans every non-test file under `src/features/orders/**` for references
 * to catalog-table write APIs. If this test ever fails, the offending
 * feature-code change would have violated constitution R5 "discounts
 * belong to the order, not the catalog — discounts MUST never alter the
 * product".
 *
 * This is the source-scan half of the R5 enforcement. The runtime half
 * lives in `ordersService.test.ts` § "R5 — product / variant rows are
 * never mutated".
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname); // src/features/orders
const REPO_ROOT = join(__dirname, '..', '..', '..');

const FORBIDDEN_PATTERNS: RegExp[] = [
  // Any `.create(…)` / `.update(…)` / destructive call on the catalog
  // collection handles by name.
  /productsCollection\s*\.\s*(create|update|destroy|prepareUpdate|prepareCreate|prepareDestroyPermanently|markAsDeleted)\s*\(/,
  /productVariantsCollection\s*\.\s*(create|update|destroy|prepareUpdate|prepareCreate|prepareDestroyPermanently|markAsDeleted)\s*\(/,
  // Direct `database.get('products')…` / `database.get('product_variants')…` writes.
  /database\.get\(\s*['"]products['"]\s*\)[^\n;]{0,120}?\.\s*(create|update|prepareCreate|prepareUpdate|prepareDestroyPermanently|markAsDeleted)\s*\(/,
  /database\.get\(\s*['"]product_variants['"]\s*\)[^\n;]{0,120}?\.\s*(create|update|prepareCreate|prepareUpdate|prepareDestroyPermanently|markAsDeleted)\s*\(/,
  // Model-level writes: `someProduct.update(` / `.markAsDeleted(`.
  /\bproduct(?:Variant)?Instance\s*\.\s*(update|markAsDeleted|prepareUpdate|destroyPermanently)\s*\(/,
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

describe('R5 static lock — orders feature never writes to catalog tables', () => {
  const files = walk(ROOT);

  test('at least one source file was scanned (guard against empty-dir false positive)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = relative(REPO_ROOT, file);
    test(`${rel} — no catalog-write patterns`, () => {
      const src = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        const match = src.match(pattern);
        if (match !== null) {
          throw new Error(
            `R5 violation in ${rel}: matched forbidden pattern ${String(
              pattern,
            )} — "${match[0]}". Catalog (products / product_variants) MUST NOT be mutated by the orders feature.`,
          );
        }
      }
    });
  }
});
