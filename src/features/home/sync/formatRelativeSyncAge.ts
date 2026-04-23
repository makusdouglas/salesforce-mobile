/**
 * Relative time vocabulary for the Home sync pill and recent-activity row.
 *
 * Windows (per specs/008-home-dashboard/research.md §R-003):
 *   < 60 s         → "agora"
 *   1–59 min       → "há N min"
 *   1–23 h         → "há N h"
 *   ≥ 24 h         → "há N d"   (no upper bound)
 *
 * Portuguese short forms only (no plural agreement per Assumptions in spec).
 * Pure function: caller supplies `nowMs` for tests, production uses Date.now().
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeSyncAge(
  thenMs: number,
  nowMs: number = Date.now(),
): string {
  const ageMs = Math.max(0, nowMs - thenMs);
  if (ageMs < MINUTE_MS) return 'agora';
  if (ageMs < HOUR_MS) {
    const minutes = Math.floor(ageMs / MINUTE_MS);
    return `há ${minutes} min`;
  }
  if (ageMs < DAY_MS) {
    const hours = Math.floor(ageMs / HOUR_MS);
    return `há ${hours} h`;
  }
  const days = Math.floor(ageMs / DAY_MS);
  return `há ${days} d`;
}
