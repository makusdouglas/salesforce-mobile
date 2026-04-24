/**
 * Public DTOs for the clients feature. Components read these, never the
 * WatermelonDB model directly, to keep mutation methods out of UI code
 * (Structure Decision point 4, plan.md).
 */

export type ClientListItemDTO = {
  readonly id: string;
  readonly name: string;
  readonly taxId: string | null;
  readonly addressSnippet: string | null;
  readonly contactSnippet: string | null;
  readonly updatedAt: number;
  readonly isPendingSync: boolean;
};

export type ClientProfileDTO = {
  readonly id: string;
  readonly name: string;
  readonly taxId: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly addressLine: string | null;
  readonly notes: string | null;
  readonly isPendingSync: boolean;
};

export type ClientDraft = {
  readonly name: string;
  readonly taxId: string;
  readonly addressLine: string;
  readonly contact: string;
  readonly notes: string;
};

export const EMPTY_DRAFT: ClientDraft = {
  name: '',
  taxId: '',
  addressLine: '',
  contact: '',
  notes: '',
};

export type ClientFilter =
  | { readonly kind: 'recent' }
  | { readonly kind: 'letter'; readonly value: string }
  | null;

export type ClientFilterState = {
  readonly query: string;
  readonly activeFilter: ClientFilter;
};

export type OrderHistoryStatus = 'draft' | 'sent' | 'canceled';

/**
 * 012-payment-receipts: payment status derived from the order's receipts
 * against its total. Null for non-sent orders (draft, canceled) — they
 * don't have a payment expectation.
 *
 *   - 'paid'    — sum(receipts) >= total
 *   - 'partial' — 0 < sum(receipts) < total
 *   - 'pending' — sum(receipts) === 0 on a sent order
 *   - 'adjust'  — sum(receipts) > total (overpayment) OR < 0 (over-correction);
 *                 seller needs to reconcile with a correction
 */
export type OrderPaymentStatus = 'paid' | 'partial' | 'pending' | 'adjust';

export type OrderHistoryRowDTO = {
  readonly id: string;
  readonly createdAtMs: number;
  readonly status: OrderHistoryStatus;
  readonly total: number;
  readonly itemCount: number;
  /** 012-payment-receipts: sum of receipts.amount. 0 when no receipts. */
  readonly received: number;
  /** 012-payment-receipts: null for draft / canceled (no payment expectation). */
  readonly paymentStatus: OrderPaymentStatus | null;
};

export type ActiveSalespersonState =
  | { readonly status: 'resolving'; readonly salespersonId: null }
  | { readonly status: 'ready'; readonly salespersonId: string }
  | { readonly status: 'missing'; readonly salespersonId: null };
