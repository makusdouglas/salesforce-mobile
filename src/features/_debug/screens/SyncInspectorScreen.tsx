import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { onPullToRefresh, SyncStatusIndicator } from '@/features/sync';
import { syncLogger, type SyncLogEntry } from '@/features/sync/service/syncLogger';

function logColor(type: string): string {
  switch (type) {
    case 'info':
      return '#3B82F6';
    case 'conflict':
      return '#F59E0B';
    case 'error':
      return '#DC2626';
    default:
      return '#71717A';
  }
}

export function SyncInspectorScreen() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLogs(syncLogger.getSnapshot());
    return syncLogger.subscribe(() => {
      setLogs(syncLogger.getSnapshot());
    });
  }, []);

  const toggleExpanded = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleCopyJSON = (entry: SyncLogEntry) => {
    void Share.share({ message: JSON.stringify(entry, null, 2) });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <SyncStatusIndicator />
          <Pressable
            accessibilityRole="button"
            onPress={() => syncLogger.clear()}
            style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
          >
            <Text style={styles.clearLabel}>Limpar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void onPullToRefresh()}
            style={({ pressed }) => [styles.syncBtn, pressed && styles.pressed]}
          >
            <Text style={styles.syncLabel}>Sincronizar</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyHint}>Nenhum log registrado na sessão atual.</Text>
        }
        renderItem={({ item: log }) => {
          const isOpen = expanded.has(log.id);
          const time = new Date(log.timestamp).toLocaleTimeString();
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => toggleExpanded(log.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowHeader}>
                <View style={[styles.statusDot, { backgroundColor: logColor(log.type) }]} />
                <Text style={styles.rowPrimary} numberOfLines={2}>
                  {log.message}
                </Text>
                <Text style={styles.rowChevron}>{isOpen ? '▾' : '▸'}</Text>
              </View>
              <Text style={styles.rowSecondary} numberOfLines={1}>
                {time} • {log.type.toUpperCase()}
              </Text>

              {isOpen && log.details ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailText} selectable>
                    {JSON.stringify(log.details, null, 2)}
                  </Text>
                  
                  <View style={styles.rowActions}>
                    <Pressable
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                      onPress={() => handleCopyJSON(log)}
                    >
                      <Text style={styles.actionLabel}>Copiar JSON</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearLabel: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
  syncBtn: {
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncLabel: { color: '#FAFAFA', fontSize: 13, fontWeight: '600' },
  listScroll: { flex: 1 },
  listContent: { padding: 16, paddingTop: 8, gap: 8 },
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
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  detailBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  detailText: {
    fontSize: 11,
    color: '#0A0A0A',
    fontFamily: 'Courier',
    maxHeight: 300,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#18181B',
  },
  emptyHint: {
    textAlign: 'center',
    paddingVertical: 24,
    color: '#A1A1AA',
    fontSize: 12,
    fontStyle: 'italic',
  },
  pressed: { opacity: 0.7 },
});
