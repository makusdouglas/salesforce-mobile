import { supabase } from '@/data';

import { SyncError } from '../service/errors';

import {
  mapClientServerRowToWMDB,
  mapOrderItemServerRowToWMDB,
  mapOrderServerRowToWMDB,
  mapPaymentReceiptServerRowToWMDB,
  mapProductServerRowToWMDB,
  mapProductVariantServerRowToWMDB,
  mapSalespersonServerRowToWMDB,
  type SupabaseRow,
  type WMDBDirtyRaw,
} from './mappers';

type TableName =
  | 'salespeople'
  | 'clients'
  | 'products'
  | 'product_variants'
  | 'orders'
  | 'order_items'
  | 'payment_receipts';

const TABLES: readonly {
  name: TableName;
  map: (row: SupabaseRow) => WMDBDirtyRaw;
}[] = [
  { name: 'salespeople', map: mapSalespersonServerRowToWMDB },
  { name: 'clients', map: mapClientServerRowToWMDB },
  { name: 'products', map: mapProductServerRowToWMDB },
  { name: 'product_variants', map: mapProductVariantServerRowToWMDB },
  { name: 'orders', map: mapOrderServerRowToWMDB },
  { name: 'order_items', map: mapOrderItemServerRowToWMDB },
  { name: 'payment_receipts', map: mapPaymentReceiptServerRowToWMDB },
];

type SyncDatabaseChangeSet = {
  [table in TableName]?: {
    created: WMDBDirtyRaw[];
    updated: WMDBDirtyRaw[];
    deleted: string[];
  };
};

export type SyncPullResult = {
  changes: SyncDatabaseChangeSet;
  timestamp: number;
};

interface SupabaseErrorShape {
  code?: string;
  message?: string;
  status?: number;
}

function classifyError(err: unknown): SyncError {
  const e = err as SupabaseErrorShape | null | undefined;
  const code = e?.code ?? '';
  const message = e?.message ?? '';
  const status = e?.status ?? 0;

  if (status === 401 || code === 'PGRST301' || /jws|jwt/i.test(message)) {
    return new SyncError('AUTH_REJECTED', message);
  }
  if (/network|fetch|timeout|connection/i.test(message)) {
    return new SyncError('NETWORK', message);
  }
  if (status >= 500) {
    return new SyncError('SERVER', message);
  }
  return new SyncError('PULL_REJECTED', message);
}

export async function pullChanges(args: {
  lastPulledAt: number | null;
}): Promise<SyncPullResult> {
  const { lastPulledAt } = args;

  // 1. Fetch server clock via sync_now_ms RPC.
  const clockResult = await supabase.rpc('sync_now_ms');
  if (clockResult.error) throw classifyError(clockResult.error);
  const timestamp = Number(clockResult.data);
  if (!Number.isFinite(timestamp)) {
    throw new SyncError('SERVER', 'sync_now_ms returned non-numeric value');
  }

  // 2. Fetch per-table changes in parallel.
  const iso = lastPulledAt === null ? null : new Date(lastPulledAt).toISOString();

  const results = await Promise.all(
    TABLES.map(async ({ name, map }) => {
      const query = supabase.from(name).select('*');
      const filtered =
        iso === null
          ? query.is('deleted_at', null) // first pull: skip tombstones
          : query.or(`updated_at.gt.${iso},deleted_at.gt.${iso}`);
      const { data, error } = await filtered;
      if (error) throw classifyError(error);
      return { name, rows: (data ?? []) as SupabaseRow[], map };
    }),
  );

  // 3. Partition rows → updated[] (non-deleted) or deleted[] (tombstones).
  const changes: SyncDatabaseChangeSet = {};
  for (const { name, rows, map } of results) {
    const updated: WMDBDirtyRaw[] = [];
    const deleted: string[] = [];
    for (const row of rows) {
      if (row.deleted_at !== null && row.deleted_at !== undefined) {
        deleted.push(row.id);
      } else {
        updated.push(map(row));
      }
    }
    changes[name] = { created: [], updated, deleted };
  }

  return { changes, timestamp };
}
