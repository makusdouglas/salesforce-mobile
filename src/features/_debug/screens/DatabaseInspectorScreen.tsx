import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Dev-only: reaches into the private database singleton to enumerate every
// row of every table. Feature code must never do this (R1 / barrel contract);
// this inspector is a deliberate exception, locked behind __DEV__.
import { database } from '@/data/database';

const TABLES = [
  'salespeople',
  'clients',
  'products',
  'product_variants',
  'orders',
  'order_items',
  'payment_receipts',
] as const;
type TableName = (typeof TABLES)[number];

const STATUS_FILTERS = ['all', 'synced', 'created', 'updated', 'deleted'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

type RawRow = {
  id: string;
  _status: string;
  _changed: string;
  [field: string]: unknown;
};

type StatusCounts = { synced: number; created: number; updated: number; deleted: number };

function emptyCounts(): StatusCounts {
  return { synced: 0, created: 0, updated: 0, deleted: 0 };
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') {
    // Heuristic: values that look like ms-epoch → render ISO for readability.
    if (v > 1_000_000_000_000 && v < 4_000_000_000_000) {
      try {
        return `${v} (${new Date(v).toISOString()})`;
      } catch {
        return String(v);
      }
    }
    return String(v);
  }
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'synced':
      return '#16A34A';
    case 'created':
      return '#F59E0B';
    case 'updated':
      return '#3B82F6';
    case 'deleted':
      return '#DC2626';
    default:
      return '#71717A';
  }
}

export function DatabaseInspectorScreen() {
  const [selectedTable, setSelectedTable] = useState<TableName>('clients');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<RawRow[]>([]);
  const [counts, setCounts] = useState<Record<TableName, { total: number; byStatus: StatusCounts }>>(() => {
    const init = {} as Record<TableName, { total: number; byStatus: StatusCounts }>;
    for (const t of TABLES) init[t] = { total: 0, byStatus: emptyCounts() };
    return init;
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load row counts for every table whenever we refresh.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextCounts = {} as Record<TableName, { total: number; byStatus: StatusCounts }>;
        for (const table of TABLES) {
          const fetched = (await database
            .get(table)
            .query()
            .fetch()) as unknown as { _raw: RawRow }[];
          const byStatus = emptyCounts();
          for (const m of fetched) {
            const s = m._raw._status;
            if (s === 'created' || s === 'updated' || s === 'synced' || s === 'deleted') {
              byStatus[s] += 1;
            }
          }
          nextCounts[table] = { total: fetched.length, byStatus };
        }
        if (!cancelled) setCounts(nextCounts);
      } catch (e) {
        if (!cancelled) setError(`counts: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Load rows for the selected table.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fetched = (await database
          .get(selectedTable)
          .query()
          .fetch()) as unknown as { _raw: RawRow }[];
        if (cancelled) return;
        const rawRows = fetched.map((m) => m._raw);
        setRows(rawRows);
        setExpanded(new Set());
      } catch (e) {
        if (!cancelled) {
          setError(`rows(${selectedTable}): ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTable, refreshKey]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r._status !== statusFilter) return false;
      if (q.length === 0) return true;
      // Search across all scalar field values.
      for (const v of Object.values(r)) {
        if (typeof v === 'string' || typeof v === 'number') {
          if (String(v).toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [rows, statusFilter, search]);

  const toggleExpanded = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const selectedCounts = counts[selectedTable];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>[dev] DB Inspector</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRefreshKey((k) => k + 1)}
          style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}
        >
          <Text style={styles.refreshLabel}>Atualizar</Text>
        </Pressable>
      </View>

      {error !== null ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        style={styles.tableChipsScroll}
        contentContainerStyle={styles.tableChips}
        showsHorizontalScrollIndicator={false}
      >
        {TABLES.map((table) => {
          const c = counts[table];
          const active = table === selectedTable;
          return (
            <Pressable
              key={table}
              accessibilityRole="button"
              onPress={() => setSelectedTable(table)}
              style={({ pressed }) => [
                styles.tableChip,
                active ? styles.tableChipActive : styles.tableChipInactive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={active ? styles.tableChipLabelActive : styles.tableChipLabelInactive}>
                {table}
              </Text>
              <Text style={active ? styles.tableChipBadgeActive : styles.tableChipBadge}>
                {c.total}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.subHeader}>
        <View style={styles.statusLegend}>
          {(['synced', 'created', 'updated', 'deleted'] as const).map((s) => (
            <View key={s} style={styles.statusChip}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(s) }]} />
              <Text style={styles.statusChipLabel}>
                {s}: {selectedCounts.byStatus[s]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        horizontal
        style={styles.filtersScroll}
        contentContainerStyle={styles.filters}
        showsHorizontalScrollIndicator={false}
      >
        {STATUS_FILTERS.map((s) => {
          const active = s === statusFilter;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              onPress={() => setStatusFilter(s)}
              style={({ pressed }) => [
                styles.filterChip,
                active ? styles.filterChipActive : styles.filterChipInactive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={active ? styles.filterChipLabelActive : styles.filterChipLabelInactive}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar (id, nome, email, qualquer campo)"
        placeholderTextColor="#A1A1AA"
        style={styles.searchInput}
        autoCorrect={false}
        autoCapitalize="none"
      />

      <Text style={styles.resultLabel}>
        {filteredRows.length} de {rows.length} {rows.length === 1 ? 'linha' : 'linhas'}
      </Text>

      <ScrollView style={styles.rowsScroll} contentContainerStyle={styles.rowsContent}>
        {filteredRows.map((row) => {
          const isOpen = expanded.has(row.id);
          const sync = `${row._status}${row._changed ? ` · ${row._changed}` : ''}`;
          const primary =
            (typeof row.name === 'string' && row.name) ||
            (typeof row.label === 'string' && row.label) ||
            (typeof row.email === 'string' && row.email) ||
            '(sem nome)';
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => toggleExpanded(row.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowHeader}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(row._status) }]} />
                <Text style={styles.rowPrimary} numberOfLines={1}>
                  {primary}
                </Text>
                <Text style={styles.rowChevron}>{isOpen ? '▾' : '▸'}</Text>
              </View>
              <Text style={styles.rowSecondary} numberOfLines={1}>
                {row.id}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {sync}
              </Text>
              {isOpen ? (
                <View style={styles.detailBlock}>
                  {Object.entries(row)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => (
                      <View key={key} style={styles.detailRow}>
                        <Text style={styles.detailKey}>{key}</Text>
                        <Text style={styles.detailValue} selectable>
                          {formatValue(value)}
                        </Text>
                      </View>
                    ))}
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {filteredRows.length === 0 ? (
          <Text style={styles.emptyHint}>
            {rows.length === 0 ? 'tabela vazia' : 'nenhuma linha passa no filtro atual'}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0A0A0A' },
  refreshBtn: {
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshLabel: { color: '#FAFAFA', fontSize: 13, fontWeight: '600' },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  errorText: { color: '#991B1B', fontSize: 12, fontFamily: 'Courier' },
  tableChipsScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 44 },
  tableChips: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  tableChipActive: { backgroundColor: '#18181B', borderColor: '#18181B' },
  tableChipInactive: { backgroundColor: '#FFFFFF', borderColor: '#E4E4E7' },
  tableChipLabelActive: { color: '#FAFAFA', fontSize: 12, fontWeight: '600' },
  tableChipLabelInactive: { color: '#18181B', fontSize: 12, fontWeight: '500' },
  tableChipBadge: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableChipBadgeActive: {
    color: '#FAFAFA',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#27272A',
    paddingHorizontal: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  subHeader: { paddingHorizontal: 16, paddingBottom: 4 },
  statusLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusChipLabel: { color: '#52525B', fontSize: 11 },
  filtersScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 40 },
  filters: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipActive: { backgroundColor: '#18181B', borderColor: '#18181B' },
  filterChipInactive: { backgroundColor: '#FFFFFF', borderColor: '#E4E4E7' },
  filterChipLabelActive: { color: '#FAFAFA', fontSize: 12, fontWeight: '600' },
  filterChipLabelInactive: { color: '#52525B', fontSize: 12, fontWeight: '500' },
  searchInput: {
    marginHorizontal: 16,
    marginTop: 6,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0A0A0A',
  },
  resultLabel: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 11,
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowsScroll: { flex: 1 },
  rowsContent: { padding: 16, paddingTop: 8, gap: 8 },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 10,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowPrimary: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0A0A0A' },
  rowChevron: { fontSize: 14, color: '#71717A' },
  rowSecondary: { fontSize: 11, color: '#71717A', fontFamily: 'Courier' },
  rowMeta: { fontSize: 11, color: '#52525B', marginTop: 2 },
  detailBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    gap: 4,
  },
  detailRow: { flexDirection: 'row', gap: 8 },
  detailKey: { width: 120, fontSize: 11, fontWeight: '600', color: '#52525B' },
  detailValue: { flex: 1, fontSize: 11, color: '#0A0A0A', fontFamily: 'Courier' },
  emptyHint: {
    textAlign: 'center',
    paddingVertical: 24,
    color: '#A1A1AA',
    fontSize: 12,
    fontStyle: 'italic',
  },
  pressed: { opacity: 0.7 },
});
