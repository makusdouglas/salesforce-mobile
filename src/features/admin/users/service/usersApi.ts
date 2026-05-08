// 016-product-lifecycle-roles — Part B admin users service.
//
// All access goes through Supabase directly (P6). Reads hit the
// `admin_users_view` introduced by migration 0018. Writes are plain
// authenticated INSERT/DELETE on `public.user_roles`, gated by the RLS
// policy `user_roles_insert_superuser` / `user_roles_delete_superuser`.
//
// The `seller` role is managed by feature 015's SECURITY DEFINER RPCs
// and is NOT editable from this module — setUserRoles() filters it out
// on both the "add" and "remove" sides so a stray toggle cannot slip
// through.

import { supabase } from '@/data/supabase';
import type { SessionRole, ManagedAdminRole } from '@/features/auth';

export type UserRow = {
  user_id: string;
  email: string;
  display_name: string;
  salesperson_active: boolean;
  roles: SessionRole[];
};

export type UsersApiErrorKind =
  | 'offline'
  | 'rls_denied'
  | 'self_demote_blocked'
  | 'unknown';

export class UsersApiError extends Error {
  readonly kind: UsersApiErrorKind;
  constructor(kind: UsersApiErrorKind, message: string) {
    super(message);
    this.name = 'UsersApiError';
    this.kind = kind;
  }
}

function mapError(err: unknown): UsersApiError {
  const anyErr = err as { code?: string; message?: string };
  const code = anyErr?.code ?? '';
  const msg = anyErr?.message ?? '';
  if (/at_least_one_superuser_required/i.test(msg)) {
    return new UsersApiError(
      'self_demote_blocked',
      'O sistema precisa manter pelo menos um Super usuário.',
    );
  }
  if (code === '42501' || /row-level security|new row violates/i.test(msg)) {
    return new UsersApiError('rls_denied', 'Você não tem permissão para essa ação.');
  }
  if (/fetch|network|failed to fetch/i.test(msg)) {
    return new UsersApiError('offline', 'Você está offline — conecte-se para salvar.');
  }
  return new UsersApiError('unknown', msg || 'Não foi possível concluir a ação.');
}

export async function listUsers(): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('admin_users_view')
    .select('user_id, email, display_name, salesperson_active, roles')
    .order('display_name', { ascending: true });
  if (error) throw mapError(error);
  return (data ?? []) as UserRow[];
}

export async function getUser(userId: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('admin_users_view')
    .select('user_id, email, display_name, salesperson_active, roles')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw mapError(error);
  return (data ?? null) as UserRow | null;
}

/**
 * Diff the user's current admin-grade roles against `nextRoles` and
 * issue the corresponding INSERTs and DELETEs. The `seller` role is
 * intentionally excluded — both from reads (it survives in the DB) and
 * from writes (attempts are filtered out so a stray toggle cannot call
 * into feature 015's territory). See contracts/client-api.md.
 */
export async function setUserRoles(
  userId: string,
  nextRoles: readonly ManagedAdminRole[],
): Promise<void> {
  const current = await getUser(userId);
  if (!current) throw new UsersApiError('unknown', 'Usuário não encontrado.');

  const nextSet = new Set<ManagedAdminRole>(nextRoles);
  const currentAdminRoles = new Set<ManagedAdminRole>(
    current.roles.filter(isManagedAdminRole),
  );

  const toAdd: ManagedAdminRole[] = [];
  const toRemove: ManagedAdminRole[] = [];
  for (const role of nextSet) {
    if (!currentAdminRoles.has(role)) toAdd.push(role);
  }
  for (const role of currentAdminRoles) {
    if (!nextSet.has(role)) toRemove.push(role);
  }

  // Apply deletes first so a superuser-swap pattern stays valid inside
  // the single-superuser deferrable constraint. Additions before deletes
  // would double-count for an instant; deletes-before-adds is cleaner
  // because each DELETE is individually safe thanks to the trigger's
  // deferrable nature.
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .in('role', toRemove);
    if (error) throw mapError(error);
  }
  if (toAdd.length > 0) {
    const payload = toAdd.map((role) => ({ user_id: userId, role }));
    const { error } = await supabase.from('user_roles').insert(payload);
    if (error) throw mapError(error);
  }
}

const MANAGED_ADMIN_ROLES: readonly ManagedAdminRole[] = [
  'manage-products',
  'manage-salespersons',
  'manage-clients',
  'superuser',
];

function isManagedAdminRole(role: SessionRole): role is ManagedAdminRole {
  return (MANAGED_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Utility consumed by the form to render the toggle list. Guarantees
 * the rendered order matches the design (products → salespersons →
 * clients → superuser).
 */
export function managedAdminRoles(): readonly ManagedAdminRole[] {
  return MANAGED_ADMIN_ROLES;
}
