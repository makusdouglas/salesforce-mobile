import { useEffect, useState } from 'react';
import type { Subscription } from 'rxjs';

import type Client from '@/data/models/Client';
import { clientsRepository } from '@/data/repositories/clientsRepository';

/**
 * Observes a single client by id from the local DB. Returns `null` before the
 * first emission, after a not-found, or after soft-delete. Used by
 * {@link ClientProfileScreen} and {@link NewOrderStubScreen}.
 */
export function useObservableClient(clientId: string): Client | null {
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    let sub: Subscription | undefined;
    sub = clientsRepository.observe(clientId).subscribe({
      next: (row) => setClient(row),
      error: () => setClient(null),
    });
    return () => sub?.unsubscribe();
  }, [clientId]);

  return client;
}
