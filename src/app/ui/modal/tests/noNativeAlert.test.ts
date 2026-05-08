import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Project-wide invariant since 008: `ConfirmModal` is the only dialog
 * primitive. React Native's `Alert.alert` is forbidden everywhere under
 * src/.
 *
 * Failure message includes the offending file paths so the author can jump
 * straight to them.
 */

const SRC_ROOT = join(__dirname, '..', '..', '..', '..');

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      // Skip tests directories — test files may reference Alert.alert when
      // asserting on legacy code or when mocking; business code is what we
      // care about.
      if (entry === 'tests' || entry === 'node_modules') continue;
      out.push(...listFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('src/ — Alert.alert is forbidden project-wide', () => {
  const files = listFiles(SRC_ROOT);
  const offenders = files.filter((file) => {
    const src = readFileSync(file, 'utf8');
    return /\bAlert\.alert\b/.test(src);
  });

  test('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test('no source file uses Alert.alert (use @/app/ui/modal ConfirmModal instead)', () => {
    expect(offenders).toEqual([]);
  });
});
