/**
 * Viewport classification threshold in density-independent points.
 * Widths >= this value are classified 'tablet'; widths < this value are 'phone'.
 *
 * Portrait-only per constitution §5 UX5. Chosen as the canonical iPad mini
 * portrait width (768 pt), falling cleanly between the UX5 baselines
 * (phone 390 pt, tablet 820 pt).
 */
export const TABLET_MIN_WIDTH = 768;
