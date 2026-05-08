import { supabase } from '@/data/supabase';
import { triggerSyncAfterAdminWrite } from '@/features/sync/triggers/adminWriteTrigger';

import type {
  ListSellersFilter,
  SellerApiError,
  SellerRecord,
} from './sellersApi.types';

export type { ListSellersFilter, SellerApiError, SellerRecord };

function toApiError(err: unknown): SellerApiError {
  if (err === null || err === undefined) return { code: 'unknown', message: 'empty_error' };
  if (typeof err === 'object' && 'message' in err) {
    const message = String((err as { message: unknown }).message ?? '');
    if (/permission denied|42501/i.test(message)) return { code: 'not_admin' };
    if (/cannot_deactivate_self|P0001/i.test(message)) return { code: 'cannot_deactivate_self' };
    if (/network|fetch/i.test(message)) return { code: 'network_error' };
    return { code: 'unknown', message };
  }
  return { code: 'unknown', message: String(err) };
}

export async function listSellers(filter: ListSellersFilter): Promise<SellerRecord[]> {
  let q = supabase
    .from('salespeople')
    .select('id, name, email, active, auth_user_id')
    .is('deleted_at', null)
    .not('auth_user_id', 'is', null)
    .order('active', { ascending: false })
    .order('name', { ascending: true });

  if (filter === 'active') q = q.eq('active', true);
  if (filter === 'inactive') q = q.eq('active', false);

  const { data, error } = await q;
  if (error) throw toApiError(error);
  return (data ?? []).map((r) => ({
    salespeople_id: r.id as string,
    auth_user_id: (r.auth_user_id ?? '') as string,
    name: r.name as string,
    email: r.email as string,
    active: Boolean(r.active),
  }));
}

export async function getSellerByAuthUserId(authUserId: string): Promise<SellerRecord | null> {
  const { data, error } = await supabase
    .from('salespeople')
    .select('id, name, email, active, auth_user_id')
    .eq('auth_user_id', authUserId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw toApiError(error);
  if (!data) return null;
  return {
    salespeople_id: data.id as string,
    auth_user_id: (data.auth_user_id ?? '') as string,
    name: data.name as string,
    email: data.email as string,
    active: Boolean(data.active),
  };
}

export async function updateSellerName(
  salespeopleId: string,
  name: string,
): Promise<void> {
  if (name.trim().length === 0) {
    throw { code: 'validation_error', field: 'name' } as SellerApiError;
  }
  const { error } = await supabase
    .from('salespeople')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', salespeopleId);
  if (error) throw toApiError(error);
  void triggerSyncAfterAdminWrite();
}

export async function deactivateSeller(authUserId: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_seller', {
    p_auth_user_id: authUserId,
  });
  if (error) throw toApiError(error);
  void triggerSyncAfterAdminWrite();
}

export async function reactivateSeller(authUserId: string): Promise<void> {
  const { error } = await supabase.rpc('reactivate_seller', {
    p_auth_user_id: authUserId,
  });
  if (error) throw toApiError(error);
  void triggerSyncAfterAdminWrite();
}
