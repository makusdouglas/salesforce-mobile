import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static grep enforcing spec FR-005 ("no modal/alert/toast/spinner for
 * sync") and SC-003 ("zero modals during sync"): no file in the Home
 * feature tree may contain `Alert.alert`. After 008's modal migration
 * (SettingsScreen uses ConfirmModal; Catalog's offline alert was deleted)
 * this assertion is absolute — no allowlist needed.
 */

const HOME_ROOT = join(__dirname, '..');

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      // Skip the tests directory itself — the scan's own regex literal would
      // otherwise trip the assertion on every run.
      if (entry === 'tests') continue;
      out.push(...listFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('Home feature tree — no native Alert.alert', () => {
  const files = listFiles(HOME_ROOT);
  const offenders = files.filter((file) => {
    const src = readFileSync(file, 'utf8');
    return /\bAlert\.alert\b/.test(src);
  });

  test('finds Home feature source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test('no file uses Alert.alert', () => {
    expect(offenders).toEqual([]);
  });
});
