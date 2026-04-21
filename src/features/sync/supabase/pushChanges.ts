import { supabase } from '@/data';

import { SyncError } from '../service/errors';

import {
  mapClientWMDBRecordToServerPayload,
  mapOrderItemWMDBRecordToServerPayload,
  mapOrderWMDBRecordToServerPayload,
  mapPaymentReceiptWMDBRecordToServerPayload,
  type WMDBRawRecord,
} from './mappers';

/**
 * Tables the device pushes. Order matters for referential integrity:
 * parents before children on inserts.
 */
type PushableTable = 'clients' | 'orders' | 'order_items' | 'payment_receipts';

const PUSH_ORDER: readonly PushableTable[] = [
  'clients',
  'orders',
  'order_items',
  'payment_receipts',
];

type Payload = Record<string, unknown>;

type PayloadMapper = (rec: WMDBRawRecord) => Payload;

const PAYLOAD_MAPPERS: Record<PushableTable, PayloadMapper> = {
  clients: mapClientWMDBRecordToServerPayload,
  orders: mapOrderWMDBRecordToServerPayload,
  order_items: mapOrderItemWMDBRecordToServerPayload,
  payment_receipts: mapPaymentReceiptWMDBRecordToServerPayload,
};

const READ_ONLY_TABLES: ReadonlySet<string> = new Set([
  'salespeople',
  'products',
  'product_variants',
]);

type WMDBTableChangeSet = {
  created: WMDBRawRecord[];
  updated: WMDBRawRecord[];
  deleted: string[];
};

type SyncDatabaseChangeSet = {
  [table: string]: WMDBTableChangeSet | undefined;
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
  if (status === 403 || code === '42501') {
    return new SyncError('PUSH_REJECTED', message);
  }
  if (status === 400 || /check|constraint/i.test(message)) {
    return new SyncError('PUSH_REJECTED', message);
  }
  if (/network|fetch|timeout|connection/i.test(message)) {
    return new SyncError('NETWORK', message);
  }
  if (status >= 500) {
    return new SyncError('SERVER', message);
  }
  return new SyncError('PUSH_REJECTED', message);
}

export async function pushChanges(args: {
  changes: SyncDatabaseChangeSet;
  lastPulledAt: number;
}): Promise<void> {
  const { changes } = args;

  // Defensive guard: drop any changes for read-only (catalog) tables.
  for (const table of Object.keys(changes)) {
    if (READ_ONLY_TABLES.has(table)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
          `[sync] dropping unexpected change for read-only table: ${table}`,
        );
      }
      delete changes[table];
    }
  }

  // Process tables sequentially in referential-integrity order.
  for (const table of PUSH_ORDER) {
    const tableChanges = changes[table];
    if (!tableChanges) continue;

    const toPayload = PAYLOAD_MAPPERS[table];

    // Inserts: records with server_id === null.
    // Note: with T000, record.id IS the server id for device-created rows.
    // The insert payload includes `id` so the server accepts our uuid.
    const inserts = tableChanges.created.filter((r) => r.server_id === null);
    if (inserts.length > 0) {
      await Promise.all(
        inserts.map(async (rec) => {
          const payload = { ...toPayload(rec), id: rec.id };
          const { data, error } = await supabase
            .from(table)
            .insert(payload)
            .select('id, updated_at')
            .single();
          if (error) throw classifyError(error);
          if (!data) throw new SyncError('SERVER', 'insert returned no data');
          // Server confirms our uuid and stamps updated_at; Watermelon's sync
          // machinery persists these when pushChanges resolves.
          rec.server_id = (data as { id: string }).id;
          rec.updated_at = Date.parse(
            (data as { updated_at: string }).updated_at,
          );
        }),
      );
    }

    // Some `created[]` records may already have a server_id — treat as idempotent
    // upsert (previous pass failed after server accepted the insert). Merge those
    // with `updated[]` below for a single UPDATE path.
    const seededCreated = tableChanges.created.filter((r) => r.server_id !== null);

    const updates = [...tableChanges.updated, ...seededCreated];
    if (updates.length > 0) {
      await Promise.all(
        updates.map(async (rec) => {
          if (rec.server_id === null) {
            // Shouldn't reach here, but safeguard
            return;
          }
          const payload = toPayload(rec);
          const { data, error } = await supabase
            .from(table)
            .update(payload)
            .eq('id', rec.server_id)
            .select('updated_at')
            .single();
          if (error) throw classifyError(error);
          if (data) {
            rec.updated_at = Date.parse(
              (data as { updated_at: string }).updated_at,
            );
          }
        }),
      );
    }

    // Deletes: rows marked deleted locally. We only propagate if a server_id
    // exists; rows that were created + deleted before first sync have nothing
    // to tell the server about.
    if (tableChanges.deleted.length > 0) {
      await Promise.all(
        tableChanges.deleted.map(async (serverId) => {
          // Watermelon's sync changeset gives us the Watermelon `id` for
          // deleted rows. With T000, local.id === server.id, so we can use
          // this value directly as the server id.
          const { error } = await supabase
            .from(table)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', serverId);
          if (error) throw classifyError(error);
        }),
      );
    }
  }
}
