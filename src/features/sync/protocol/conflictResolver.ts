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
 *
 * When choosing REMOTE we merge `{ ...resolved, ...remote }` — the mapper
 * output does NOT carry Watermelon sync metadata (`_status`, `_changed`, `id`),
 * so returning `remote` alone would zero those out and cause synced rows to
 * re-surface as `_status='created'` on the next push.
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

/**
 * When remote wins under LWW, the row on the server is the source of truth
 * and any local pending mutations are discarded. Force `_status: 'synced'`
 * + `_changed: ''` so the record does NOT surface in the next push as a
 * pending create/update (which would then re-insert and hit a duplicate-key
 * or re-update and fight the server forever). This is the standard fix for
 * the "INSERT reached the server but push threw for another row, so the
 * whole batch was never marked synced" race — the next pull heals the
 * orphan by bringing it back as a conflict and we win it via this branch.
 */
function remoteWins(resolved: AnyRaw, remote: AnyRaw): AnyRaw {
  return { ...resolved, ...remote, _status: 'synced', _changed: '' };
}

export function conflictResolver(
  _table: string,
  local: AnyRaw,
  remote: AnyRaw,
  resolved: AnyRaw,
): AnyRaw {
  const lu = numericUpdatedAt(local);
  const ru = numericUpdatedAt(remote);
  if (ru > lu) return remoteWins(resolved, remote);
  if (ru < lu) return resolved;

  const rsid = stringServerId(remote);
  const lsid = stringServerId(local);
  if (rsid !== null && lsid !== null && rsid < lsid) {
    return remoteWins(resolved, remote);
  }
  return resolved;
}
