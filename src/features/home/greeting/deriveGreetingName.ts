/**
 * Extract a first-name-ish label for the greeting.
 *
 * Priority: the salesperson's real `name` (from the salespeople table)
 * wins. Falls back to the email's local part when the name isn't
 * available yet (bootstrap gap — salesperson row still syncing down).
 * Returns `null` if neither is usable, and GreetingBlock then falls back
 * to plain "Olá".
 *
 * Examples:
 *   deriveGreetingName({ name: "Márcio Souza", email: "marcio@x.com" }) → "Márcio"
 *   deriveGreetingName({ name: null, email: "marcio@x.com" })          → "marcio"
 *   deriveGreetingName({ name: "", email: "marcio@x.com" })            → "marcio"
 *   deriveGreetingName({ name: null, email: null })                    → null
 *   deriveGreetingName({ name: "Ana", email: null })                   → "Ana"
 *   deriveGreetingName({ name: "São Paulo LTDA", email: null })        → "São"
 *
 * Pure function. No network, no I/O.
 */
export type GreetingNameInput = {
  readonly name?: string | null;
  readonly email?: string | null;
};

function firstNameFromFull(full: string): string | null {
  const trimmed = full.trim();
  if (trimmed.length === 0) return null;
  const space = trimmed.indexOf(' ');
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

function localPartFromEmail(email: string): string | null {
  const trimmed = email.trim();
  if (trimmed.length === 0) return null;
  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) return trimmed;
  if (atIndex === 0) return null;
  return trimmed.slice(0, atIndex);
}

export function deriveGreetingName(input: GreetingNameInput | string | null): string | null {
  // Back-compat: accept a bare email string for pre-existing call sites / tests.
  if (input === null) return null;
  if (typeof input === 'string') return localPartFromEmail(input);

  const fromName = input.name != null ? firstNameFromFull(input.name) : null;
  if (fromName !== null) return fromName;
  const fromEmail = input.email != null ? localPartFromEmail(input.email) : null;
  return fromEmail;
}
