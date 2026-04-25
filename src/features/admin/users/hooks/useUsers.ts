import { useCallback, useEffect, useState } from 'react';

import { listUsers, type UserRow } from '../service/usersApi';

type State =
  | { status: 'loading' }
  | { status: 'ready'; users: UserRow[] }
  | { status: 'error'; message: string };

export function useUsers() {
  const [state, setState] = useState<State>({ status: 'loading' });

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const users = await listUsers();
      setState({ status: 'ready', users });
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Erro ao carregar';
      setState({ status: 'error', message });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload } as const;
}
