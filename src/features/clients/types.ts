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

export type OrderHistoryRowDTO = {
  readonly id: string;
  readonly createdAtMs: number;
  readonly status: OrderHistoryStatus;
  readonly total: number;
  readonly itemCount: number;
};

export type ActiveSalespersonState =
  | { readonly status: 'resolving'; readonly salespersonId: null }
  | { readonly status: 'ready'; readonly salespersonId: string }
  | { readonly status: 'missing'; readonly salespersonId: null };
