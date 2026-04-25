// Type-only module — safe to import from tests without pulling the
// Supabase client through src/data/supabase.

export type SellerRecord = {
  auth_user_id: string;
  salespeople_id: string;
  name: string;
  email: string;
  active: boolean;
};

export type ListSellersFilter = 'all' | 'active' | 'inactive';

export type SellerApiError =
  | { code: 'unauthenticated' }
  | { code: 'not_admin' }
  | { code: 'email_in_use' }
  | { code: 'validation_error'; field: 'name' | 'email' | 'password' | 'mode' }
  | { code: 'cannot_deactivate_self' }
  | { code: 'network_error' }
  | { code: 'unknown'; message: string };
