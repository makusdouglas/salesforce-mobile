// 017-revenue-dashboard — delta % rendering helper.
// Spec: FR-007 mandates an em dash when previous data is missing. We do
// the same for "both zero" (no movement to show). Comma decimal separator
// is Brazilian convention (UX3).

export interface DeltaRendering {
  /** "+12,4%" / "-3,7%" / "—" */
  readonly text: string;
  readonly direction: 'up' | 'down' | null;
}

export function computeDeltaPct(
  current: number,
  previous: number | null,
): number | null {
  if (previous === null) return null;
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function computeDeltaDirection(
  current: number,
  previous: number | null,
): 'up' | 'down' | null {
  const pct = computeDeltaPct(current, previous);
  if (pct === null) return null;
  return pct >= 0 ? 'up' : 'down';
}

/**
 * Format a fractional delta (e.g. 0.124 → "+12,4%") with Brazilian
 * decimal separator. Returns "—" for null (FR-007).
 */
export function formatDelta(deltaPct: number | null): DeltaRendering {
  if (deltaPct === null || !Number.isFinite(deltaPct)) {
    return { text: '—', direction: null };
  }
  const pct = deltaPct * 100;
  const sign = pct >= 0 ? '+' : '−';
  const abs = Math.abs(pct).toFixed(1).replace('.', ',');
  return {
    text: `${sign}${abs}%`,
    direction: pct >= 0 ? 'up' : 'down',
  };
}
