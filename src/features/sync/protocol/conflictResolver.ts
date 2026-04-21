/**
 * WatermelonDB sync conflict resolver.
 *
 * Contract: [contracts/conflict-resolver.md]. Pure function; no side effects.
 *
 * Rule (constitution P2 — last-write-wins by `updated_at`):
 *
 *   if remote.updated_at > local.updated_at → keep REMOTE
 *   if remote.updated_at < local.updated_at → keep LOCAL (via `resolved`)
 *   else if remote.server_id < local.server_id (lex) → keep REMOTE
 *   else → keep LOCAL
 */

/**
 * Watermelon's DirtyRaw / RawRecord types are generic maps — we treat them
 * as such here and only read the two fields the LWW rule needs.
 */
type AnyRaw = { [key: string]: unknown };

function numericUpdatedAt(r: AnyRaw): number {
  const v = r.updated_at;
  return typeof v === 'number' ? v : 0;
}

function stringServerId(r: AnyRaw): string | null {
  const v = r.server_id;
  return typeof v === 'string' ? v : null;
}

export function conflictResolver(
  _table: string,
  local: AnyRaw,
  remote: AnyRaw,
  resolved: AnyRaw,
): AnyRaw {
  const lu = numericUpdatedAt(local);
  const ru = numericUpdatedAt(remote);
  if (ru > lu) return remote;
  if (ru < lu) return resolved;

  const rsid = stringServerId(remote);
  const lsid = stringServerId(local);
  if (rsid !== null && lsid !== null && rsid < lsid) return remote;
  return resolved;
}
