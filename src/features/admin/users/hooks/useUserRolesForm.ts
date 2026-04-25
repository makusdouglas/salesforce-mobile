import { useCallback, useEffect, useState } from 'react';

import type { ManagedAdminRole } from '@/features/auth';

import {
  getUser,
  managedAdminRoles,
  setUserRoles,
  UsersApiError,
  type UserRow,
} from '../service/usersApi';

export type UserRolesFormState = {
  user: UserRow | null;
  roles: Set<ManagedAdminRole>;
};

export type SaveOutcome =
  | { status: 'saved' }
  | { status: 'self_demote_blocked' }
  | { status: 'forbidden' }
  | { status: 'offline' }
  | { status: 'error'; message: string };

export function useUserRolesForm(userId: string) {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<ManagedAdminRole>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getUser(userId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setLoadError('Usuário não encontrado.');
          return;
        }
        setUser(row);
        const current = new Set<ManagedAdminRole>();
        for (const role of row.roles) {
          if (managedAdminRoles().includes(role as ManagedAdminRole)) {
            current.add(role as ManagedAdminRole);
          }
        }
        setSelected(current);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError((err as { message?: string })?.message ?? 'Erro ao carregar.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback((role: ManagedAdminRole) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }, []);

  const save = useCallback(async (): Promise<SaveOutcome> => {
    if (!user) return { status: 'error', message: 'Usuário não carregado.' };
    setSaving(true);
    setSaveError(null);
    try {
      await setUserRoles(user.user_id, Array.from(selected));
      setSaving(false);
      return { status: 'saved' };
    } catch (err) {
      setSaving(false);
      // The self-demote block is enforced by the Postgres deferrable
      // trigger from migration 0018 (FR-025). It comes back as
      // `kind: 'self_demote_blocked'` with user-facing copy already
      // attached — no pre-emptive client-side check is needed.
      if (err instanceof UsersApiError) {
        setSaveError(err.message);
        if (err.kind === 'self_demote_blocked') return { status: 'self_demote_blocked' };
        if (err.kind === 'rls_denied') return { status: 'forbidden' };
        if (err.kind === 'offline') return { status: 'offline' };
      }
      const message = (err as { message?: string })?.message ?? 'Erro ao salvar.';
      setSaveError(message);
      return { status: 'error', message };
    }
  }, [user, selected]);

  return {
    user,
    loading,
    loadError,
    selected,
    saving,
    saveError,
    toggle,
    save,
  } as const;
}
