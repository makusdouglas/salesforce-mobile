/**
 * Splits the free-text "Contato" field into structured { phone, email }
 * for storage in WatermelonDB.
 *
 * Rules (spec 007 data-model.md + tasks.md T017a):
 * - Split on newlines; trim each line.
 * - The first non-empty line containing `@` becomes `email`.
 * - Every remaining non-empty line joined by space becomes `phone`.
 * - If no line contains `@`, the whole joined content becomes `phone`.
 * - Empty / whitespace-only input returns { phone: null, email: null }.
 *
 * Intentionally simple — the form is a single free-text block per UX1.
 */

export type SplitContact = {
  readonly phone: string | null;
  readonly email: string | null;
};

export function splitContact(raw: string): SplitContact {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { phone: null, email: null };
  }

  const emailIndex = lines.findIndex((line) => line.includes('@'));

  if (emailIndex === -1) {
    return { phone: lines.join(' '), email: null };
  }

  const emailLine = lines[emailIndex] ?? null;
  const rest = lines.filter((_, i) => i !== emailIndex);
  const phone = rest.length > 0 ? rest.join(' ') : null;

  return { phone, email: emailLine };
}
