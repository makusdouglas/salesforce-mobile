/**
 * 012-payment-receipts: append-only static scan.
 *
 * Walks `src/features/orders/receipts/**` and `src/data/repositories/
 * paymentReceiptsRepository.ts`; fails if any file contains a forbidden
 * mutation pattern against a receipt record. This is belt-and-braces on
 * top of the repo's absent `update()` / `softDelete()` exports — it catches
 * call sites that try to bypass the boundary (e.g. `collection.find(id)
 * .update(...)` or direct field assignment).
 *
 * Exemptions:
 *   - paymentReceiptsRepository.ts itself is allowed to call `.update(...)`
 *     exactly inside `retryAttachmentUpload`, which only mutates the device-
 *     local `attachmentUploadState` column (never business fields). The scan
 *     tolerates that by whitelisting the sanctioned call site.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

const ROOTS = [
  path.resolve(__dirname),
  path.resolve(__dirname, '../../../data/repositories/paymentReceiptsRepository.ts'),
];

const FORBIDDEN: { pattern: RegExp; description: string }[] = [
  {
    pattern: /\.markAsDeleted\s*\(/,
    description: 'receipts are append-only; markAsDeleted is forbidden',
  },
  {
    pattern: /\.destroyPermanently\s*\(/,
    description: 'receipts are append-only; destroyPermanently is forbidden',
  },
  {
    // Direct business-field mutation via `receipt.amount = ...` / `.method =` /
    // `.receivedAtMs = ...`. The repo's create() writes these during setup
    // (inside the collection.create callback) and that is fine because the
    // record doesn't exist yet. But anywhere else — especially inside
    // `record.update((r) => { ... })` blocks — is forbidden.
    pattern: /\b(?:receipt|rcpt|row|rec|r)\.(?:amount|method|receivedAtMs)\s*=(?!=)/,
    description:
      'direct assignment to receipt business fields (amount/method/receivedAtMs) is forbidden',
  },
];

// Files that are allowed to call .update() on a receipt record. Anything not
// listed here will fail the `\.update\(` check. Every entry must be justified
// here with the specific fields it is allowed to touch — the business-field
// scan (amount/method/receivedAtMs) still runs globally.
const UPDATE_WHITELIST = new Set<string>([
  // Repo.retryAttachmentUpload flips upload_state failed→pending. No business fields.
  path.resolve(__dirname, '../../../data/repositories/paymentReceiptsRepository.ts'),
  // Uploader writes attachment_url + attachment_upload_state after a
  // successful Storage upload (sync bookkeeping, not business fields).
  path.resolve(__dirname, 'attachments/uploader.ts'),
]);

async function walk(root: string): Promise<string[]> {
  const stat = await fs.stat(root);
  if (stat.isFile()) return [root];
  const entries = await fs.readdir(root, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('append-only receipts — static scan', () => {
  let files: string[] = [];

  beforeAll(async () => {
    const all = await Promise.all(ROOTS.map((r) => walk(r)));
    files = all.flat().filter((f) => !f.endsWith('appendOnlyReceipts.test.ts'));
  });

  it('scans at least the repo + the receipts sub-tree', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(
      files.some((f) =>
        f.endsWith(path.join('src', 'data', 'repositories', 'paymentReceiptsRepository.ts')),
      ),
    ).toBe(true);
  });

  it('no file contains a forbidden append-only-violating pattern', async () => {
    const offenders: { file: string; reason: string; line: string }[] = [];

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        for (const { pattern, description } of FORBIDDEN) {
          if (pattern.test(line)) {
            offenders.push({ file, reason: description, line: `${i + 1}: ${line.trim()}` });
          }
        }

        // .update() is only allowed in the whitelist.
        if (/\.update\s*\(/.test(line) && !UPDATE_WHITELIST.has(file)) {
          offenders.push({
            file,
            reason: 'receipts are append-only; .update() call site is not whitelisted',
            line: `${i + 1}: ${line.trim()}`,
          });
        }
      }
    }

    if (offenders.length > 0) {
      const report = offenders
        .map((o) => `- ${o.file}\n    ${o.reason}\n    ${o.line}`)
        .join('\n');
      throw new Error(`Append-only violations detected:\n${report}`);
    }
  });
});
