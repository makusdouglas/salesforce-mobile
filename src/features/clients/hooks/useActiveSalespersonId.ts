import { useEffect, useState } from 'react';
import type { Subscription } from 'rxjs';

import { salespeopleRepository } from '@/data/repositories/salespeopleRepository';
import { useSession } from '@/features/auth';

import {
  MISSING,
  RESOLVING,
  resolveActiveSalesperson,
} from '../session/resolveActiveSalesperson';
import type { ActiveSalespersonState } from '../types';

export function useActiveSalespersonId(): ActiveSalespersonState {
  const { status: sessionStatus, email } = useSession();
  const [state, setState] = useState<ActiveSalespersonState>(RESOLVING);

  useEffect(() => {
    if (sessionStatus !== 'Authenticated' || email === null) {
      setState(RESOLVING);
      return;
    }

    let sub: Subscription | undefined;
    sub = salespeopleRepository.observeAll().subscribe({
      next: (rows) => {
        setState(resolveActiveSalesperson(rows, sessionStatus, email));
      },
      error: () => setState(MISSING),
    });

    return () => sub?.unsubscribe();
  }, [sessionStatus, email]);

  return state;
}
