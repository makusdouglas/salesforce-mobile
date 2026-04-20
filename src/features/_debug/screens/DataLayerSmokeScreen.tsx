import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Subscription } from 'rxjs';

import { colors } from '@/app/theme/colors';
import {
  clientsRepository,
  orderItemsRepository,
  ordersRepository,
  paymentReceiptsRepository,
  salespeopleRepository,
} from '@/data';
// Dev-only: reaches into the private `database` singleton. Feature code must
// never do this (constitution R1 + barrel contract). Smoke screens are an
// intentional exception for raw-row auditing that no public repo API covers
// (e.g., "global count of orders across all clients").
import { database } from '@/data/database';

/**
 * Throwaway dev-only smoke screen for the 002-local-data-layer block.
 *
 * Exercises US1 (seven entities CRUD through the adapter) and verifies
 * FR-012 (reactive reads) by forcing updates via the probe buttons and
 * watching the subscribed observations re-emit.
 *
 * NOTE on reactivity: WatermelonDB mutates Model instances in place on
 * update, so subsequent emissions of `observe()` deliver the SAME object
 * reference. React's `setState` does not re-render when the reference is
 * unchanged — we therefore snapshot the fields we care about into plain
 * objects before `setState`. Real features would typically use Watermelon's
 * `withObservables` HOC or a `useObservable` hook that handles this
 * correctly; here, a throwaway screen, the manual snapshot is fine.
 */

type OrderSnapshot = {
  id: string;
  status: string;
  notes: string | null;
  updatedAt: number;
  syncStatus: string;
};

type OrderItemSnapshot = {
  id: string;
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  updatedAt: number;
  syncStatus: string;
};

type TableAudit = {
  table: string;
  total: number;
  byStatus: { created: number; updated: number; synced: number; deleted: number };
  sampleRow: Record<string, unknown> | null;
};

export function DataLayerSmokeScreen() {
  const [status, setStatus] = useState('Initializing…');
  const [order, setOrder] = useState<OrderSnapshot | null>(null);
  const [items, setItems] = useState<OrderItemSnapshot[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [firstItemId, setFirstItemId] = useState<string | null>(null);
  const [orderEmissions, setOrderEmissions] = useState(0);
  const [itemEmissions, setItemEmissions] = useState(0);
  const [audit, setAudit] = useState<TableAudit[] | null>(null);

  useEffect(() => {
    let subOrder: Subscription | undefined;
    let subItems: Subscription | undefined;
    let cancelled = false;

    void (async () => {
      try {
        setStatus('Creating salesperson…');
        const sp = await salespeopleRepository.create({
          name: 'Teste QA',
          email: 'qa@local.dev',
        });
        if (cancelled) return;

        setStatus('Creating client…');
        const client = await clientsRepository.create({
          salespersonId: sp.id,
          name: 'Mercearia Smoke',
          taxId: '00.000.000/0001-00',
        });
        if (cancelled) return;

        setStatus('Creating order…');
        const created = await ordersRepository.create({
          clientId: client.id,
          salespersonId: sp.id,
        });
        if (cancelled) return;
        setOrderId(created.id);

        setStatus('Creating order items…');
        const item1 = await orderItemsRepository.create({
          orderId: created.id,
          productVariantId: 'smoke-variant-1',
          quantity: 2,
          unitPrice: 9.9,
        });
        if (cancelled) return;
        setFirstItemId(item1.id);

        await orderItemsRepository.create({
          orderId: created.id,
          productVariantId: 'smoke-variant-2',
          quantity: 5,
          unitPrice: 4.5,
        });
        if (cancelled) return;

        // Also create a payment receipt so every writable table has rows
        await paymentReceiptsRepository.create({
          orderId: created.id,
          amount: 42.5,
          method: 'pix',
          notes: 'smoke payment',
        });
        if (cancelled) return;

        subOrder = ordersRepository.observe(created.id).subscribe((value) => {
          setOrderEmissions((n) => n + 1);
          setOrder(
            value
              ? {
                  id: value.id,
                  status: value.status,
                  notes: value.notes,
                  updatedAt: value.updatedAt,
                  syncStatus: value.syncStatus,
                }
              : null,
          );
        });
        subItems = orderItemsRepository.observeByOrder(created.id).subscribe((list) => {
          setItemEmissions((n) => n + 1);
          setItems(
            list.map((it) => ({
              id: it.id,
              productVariantId: it.productVariantId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              updatedAt: it.updatedAt,
              syncStatus: it.syncStatus,
            })),
          );
        });
        setStatus('Ready — observations active. Tap a probe button to verify reactivity.');
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
        console.error('[SmokeScreen] init failed', err);
      }
    })();

    return () => {
      cancelled = true;
      subOrder?.unsubscribe();
      subItems?.unsubscribe();
    };
  }, []);

  const probeOrderReactivity = async () => {
    if (!orderId) return;
    const ts = new Date().toISOString();
    console.log('[SmokeScreen] probe order →', ts);
    try {
      const updated = await ordersRepository.update(orderId, {
        notes: `reactivity probe @ ${ts}`,
      });
      console.log('[SmokeScreen] order updated →', updated.notes);
    } catch (err) {
      console.error('[SmokeScreen] order update failed', err);
      setStatus(`order probe failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const probeItemReactivity = async () => {
    if (!firstItemId) return;
    const qty = Math.floor(Math.random() * 99) + 1;
    console.log('[SmokeScreen] probe item → qty', qty);
    try {
      const updated = await orderItemsRepository.update(firstItemId, { quantity: qty });
      console.log('[SmokeScreen] item updated → qty', updated.quantity);
    } catch (err) {
      console.error('[SmokeScreen] item update failed', err);
      setStatus(`item probe failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /**
   * Walks every MVP table and logs row counts + a sample raw row to the Metro
   * console. Used for US1 cold-restart persistence check (counts grow across
   * restarts) and US2 uniform-sync-columns check (all 7 tables carry
   * server_id/updated_at/_status/_changed populated correctly).
   */
  const auditAllTables = async () => {
    console.log('--- [SmokeScreen] AUDIT START ---');
    const results: TableAudit[] = [];

    // Unified reader: Watermelon exposes `syncStatus` as a public accessor but
    // NOT `syncChanged` — we have to reach into `_raw._changed`. So we query
    // every table through the private `database` singleton (which `.query()`
    // returns `Model[]`) and read the 4 sync columns from the raw record +
    // public accessors.
    type ModelWithRaw = {
      id: string;
      serverId: string | null;
      updatedAt: number;
      syncStatus: string;
      _raw: { _changed: string };
    };
    const snap = (m: ModelWithRaw) => ({
      id: m.id,
      server_id: m.serverId,
      updated_at: m.updatedAt,
      _status: m.syncStatus,
      _changed: m._raw._changed,
    });

    const allTables = [
      'salespeople',
      'clients',
      'products',
      'product_variants',
      'orders',
      'order_items',
      'payment_receipts',
    ] as const;

    for (const table of allTables) {
      try {
        const rows = (await database.get(table).query().fetch()) as unknown as ModelWithRaw[];
        const byStatus = { created: 0, updated: 0, synced: 0, deleted: 0 };
        for (const r of rows) {
          const s = r.syncStatus;
          if (s === 'created' || s === 'updated' || s === 'synced' || s === 'deleted') {
            byStatus[s] += 1;
          }
        }
        const sampleRow = rows[0] ? snap(rows[0]) : null;
        results.push({ table, total: rows.length, byStatus, sampleRow });
        console.log(`[${table}] total=${rows.length}`, byStatus, 'sample:', sampleRow);
      } catch (err) {
        console.error(`[${table}] audit failed`, err);
        results.push({
          table,
          total: -1,
          byStatus: { created: 0, updated: 0, synced: 0, deleted: 0 },
          sampleRow: { error: String(err) },
        });
      }
    }

    console.log('--- [SmokeScreen] AUDIT END ---');
    setAudit(results);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Data-Layer Smoke</Text>

        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{status}</Text>

        <Text style={styles.label}>{`Order  (${orderEmissions} emissions)`}</Text>
        <Text style={styles.value}>
          {order
            ? `id=${order.id}
status=${order.status}
_status=${order.syncStatus}
notes=${order.notes ?? '(none)'}
updated_at=${order.updatedAt}`
            : '(not loaded yet)'}
        </Text>

        <Text
          style={styles.label}
        >{`Order items (${items.length})  (${itemEmissions} emissions)`}</Text>
        {items.map((it) => (
          <Text key={it.id} style={styles.item}>
            {`- ${it.productVariantId}  qty=${it.quantity}  unit=${it.unitPrice}  _status=${it.syncStatus}  updated_at=${it.updatedAt}`}
          </Text>
        ))}

        {audit ? (
          <View style={styles.auditBlock}>
            <Text style={styles.label}>Audit (last run)</Text>
            {audit.map((row) => (
              <Text key={row.table} style={styles.item}>
                {`${row.table}: total=${row.total}  _status=${JSON.stringify(row.byStatus)}
  sample: ${row.sampleRow ? JSON.stringify(row.sampleRow) : '(no rows)'}`}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={probeOrderReactivity}
          >
            <Text style={styles.buttonLabel}>Probe order reactivity (update notes)</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={probeItemReactivity}
          >
            <Text style={styles.buttonLabel}>Probe item reactivity (random quantity)</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={auditAllTables}
          >
            <Text style={styles.buttonLabel}>Audit all tables (row counts + sync cols)</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 6 },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 10 },
  value: { fontSize: 13, color: colors.foreground },
  item: { fontSize: 12, color: colors.foreground },
  auditBlock: { marginTop: 8, padding: 10, borderRadius: 6, backgroundColor: '#f5f5f5' },
  buttons: { marginTop: 20, gap: 10 },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
