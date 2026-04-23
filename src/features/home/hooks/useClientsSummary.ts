import { useEffect, useState } from 'react';

import { clientsRepository } from '@/data/repositories/clientsRepository';
import type Client from '@/data/models/Client';

import { deriveClientsSummary, type ClientsSummary } from './clientsSummary';

export function useClientsSummary(salespersonId: string | null): ClientsSummary {
  const [clients, setClients] = useState<readonly Client[] | null>(null);

  useEffect(() => {
    if (salespersonId === null) {
      setClients(null);
      return;
    }
    const subscription = clientsRepository.observeByOwner(salespersonId).subscribe({
      next: (next) => {
        setClients(next);
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [salespersonId]);

  return deriveClientsSummary(clients);
}
