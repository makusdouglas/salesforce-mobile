/**
 * Home feature public types. Consumed by components, hooks, and the
 * `deriveHomeSnapshot` composition function.
 */

export type RecentActivityDTO = {
  readonly storeName: string;
  /** Integer cents so rendering can pick the decimal separator. */
  readonly totalCentsAmount: number;
  /** Wall-clock ms when the order's status transitioned to 'sent'. */
  readonly sentAtMs: number;
};
