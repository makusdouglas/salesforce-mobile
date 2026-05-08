// 009-order-assembly: dev-only diagnostic for SC-003 ("0% of orders have
// a status outside {draft, sent, canceled}"). Not mounted in production
// builds. Run from the dev REPL / a debug screen.
//
// Usage:
//   import { auditOrderStatuses } from '@/dev/auditStatuses';
//   const result = await auditOrderStatuses();
//   // { allowed: true, distinct: ['draft', 'sent'] }  ← passing
//   // { allowed: false, distinct: [..., 'archived'] } ← violation

import { Q } from '@nozbe/watermelondb';

import { database } from '@/data/database';
import type Order from '@/data/models/Order';
import { ORDER_STATUSES } from '@/features/orders/guards/assertValidStatus';

export interface StatusAudit {
  readonly allowed: boolean;
  readonly distinct: string[];
}

export async function auditOrderStatuses(): Promise<StatusAudit> {
  const rows = await database
    .get<Order>('orders')
    .query(Q.where('_status', Q.notEq('deleted')))
    .fetch();
  const distinct = [...new Set(rows.map((r) => r.status))].sort();
  const allowed = distinct.every((s) => (ORDER_STATUSES as readonly string[]).includes(s));
  return { allowed, distinct };
}
