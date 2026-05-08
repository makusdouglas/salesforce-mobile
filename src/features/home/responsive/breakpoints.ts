/**
 * Viewport classification threshold in density-independent points.
 * Widths >= this value are classified 'tablet'; widths < this value are 'phone'.
 *
 * Portrait-only per constitution §5 UX5. Value 768 is the canonical iPad mini
 * portrait width, falling cleanly between the UX5 baselines (phone 390 pt,
 * tablet 820 pt).
 *
 * TODO: duplicated from src/features/catalog/responsive/breakpoints.ts and
 * src/features/clients/responsive/breakpoints.ts. Catalog → Clients → Home is
 * the third consumer; extracting to src/app/responsive/ is a pre-approved
 * follow-up chore (see specs/008-home-dashboard/plan.md §Structure Decision).
 */
export const TABLET_MIN_WIDTH = 768;
