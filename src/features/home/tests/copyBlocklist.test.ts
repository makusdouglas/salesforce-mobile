import { allHomeCopyStrings } from '../copy/copy';

/**
 * FR-016: empty-state copy on Home MUST NOT contain error / system
 * vocabulary. This test scans every string produced by the Home copy
 * module against a blocklist; failure means someone slipped technical
 * language into user-facing text.
 */

const BLOCKLIST = [
  'erro',
  'falha',      // blocked in copy but allowed in the pill's "Falha ao sincronizar" string — not empty-state copy though, so we narrow the scan below
  'null',
  'undefined',
  'sem dados',
] as const;

/**
 * The pill's "Falha ao sincronizar" string is technically not empty-state
 * copy — it's a state label required by the spec. Exclude the pill's labels
 * from the blocklist scan but keep everything else covered.
 */
const PILL_LABEL_PREFIXES = ['Falha ao sincronizar'];

function isPillLabel(s: string): boolean {
  return PILL_LABEL_PREFIXES.some((prefix) => s.startsWith(prefix));
}

describe('homeCopy — FR-016 blocklist', () => {
  const strings = allHomeCopyStrings();

  test('every tracked string is a non-empty string', () => {
    for (const s of strings) {
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    }
  });

  test.each(BLOCKLIST)('no copy contains "%s" (case-insensitive)', (bad) => {
    const pattern = new RegExp(bad, 'i');
    const hits = strings.filter((s) => pattern.test(s) && !isPillLabel(s));
    expect(hits).toEqual([]);
  });
});
