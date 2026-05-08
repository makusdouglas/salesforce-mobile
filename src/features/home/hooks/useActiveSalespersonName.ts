import { useEffect, useState } from 'react';

import { salespeopleRepository } from '@/data/repositories/salespeopleRepository';

/**
 * Observes the active salesperson row and returns its `name`. Used by the
 * GreetingBlock so the hub reads "Olá, Márcio" instead of the email's
 * local part ("Olá, markus").
 *
 * Returns `null` while the id is not yet resolved (bootstrap gap) or when
 * no matching salesperson row exists locally yet (first run before the
 * salesperson table has been synced).
 */
export function useActiveSalespersonName(salespersonId: string | null): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (salespersonId === null) {
      setName(null);
      return;
    }
    const sub = salespeopleRepository.observe(salespersonId).subscribe({
      next: (row) => {
        setName(row?.name ?? null);
      },
    });
    return () => {
      sub.unsubscribe();
    };
  }, [salespersonId]);

  return name;
}
