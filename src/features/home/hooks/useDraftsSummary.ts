/**
 * 009-order-assembly: real implementation — observes the `orders` table
 * filtered by `status = 'draft'` scoped to the active salesperson, emits
 * `{ count }` whenever the count changes.
 *
 * Shape `() => { count: number }` is preserved from the 008 placeholder
 * so the Home snapshot and its tests keep working without modification.
 */

import { useEffect, useState } from 'react';

import { ordersRepository } from '@/data/repositories/ordersRepository';
import { useActiveSalespersonId } from '@/features/clients';

export type DraftsSummary = { readonly count: number };

export function useDraftsSummary(): DraftsSummary {
  const { salespersonId } = useActiveSalespersonId();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (salespersonId === null) {
      setCount(0);
      return;
    }
    const sub = ordersRepository
      .observeDraftsForSalesperson(salespersonId)
      .subscribe({
        next: (rows) => setCount(rows.length),
      });
    return () => sub.unsubscribe();
  }, [salespersonId]);

  return { count };
}
