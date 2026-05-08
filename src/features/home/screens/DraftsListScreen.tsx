// 009-order-assembly: Home → Rascunhos em andamento list.
// Renders one row per draft with client name, item count, current total,
// and last-saved timestamp formatted via the 008 relative-time helper.
// Tapping a row enters the OrdersStack at OrderDraft.

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { formatBRL } from '@/features/orders/formatting/formatBRL';

import { useDraftsList, type DraftListEntry } from '../hooks/useDraftsList';
import { useViewport } from '../hooks/useViewport';
import { formatRelativeSyncAge } from '../sync/formatRelativeSyncAge';

type Props = NativeStackScreenProps<HomeStackParamList, 'DraftsList'>;

export function DraftsListScreen({ navigation }: Props) {
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const rows = useDraftsList();

  const handleOpen = (orderId: string) => {
    navigation.navigate('Orders', {
      screen: 'OrderDraft',
      params: { orderId },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Text style={styles.iconBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>Rascunhos em andamento</Text>
        <View style={styles.iconBtn} />
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhum rascunho em andamento</Text>
          <Text style={styles.emptyBody}>
            Quando você começar um pedido, ele aparece aqui até ser enviado ou
            cancelado.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={[
            styles.bodyContent,
            isTablet && styles.bodyContentTablet,
          ]}
        >
          {rows.map((row) => (
            <DraftRow
              key={row.orderId}
              row={row}
              nowMs={Date.now()}
              onPress={() => handleOpen(row.orderId)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DraftRow({
  row,
  nowMs,
  onPress,
}: {
  readonly row: DraftListEntry;
  readonly nowMs: number;
  readonly onPress: () => void;
}) {
  const age = formatRelativeSyncAge(nowMs, row.lastSavedAtMs);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir rascunho de ${row.clientName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.rowClient} numberOfLines={1}>
          {row.clientName}
        </Text>
        <Text style={styles.rowSub}>
          {row.itemCount} {row.itemCount === 1 ? 'item' : 'itens'} ·{' '}
          {formatBRL(row.total)} · {age}
        </Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  topBarTablet: { height: 64, paddingHorizontal: 28 },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 22, color: '#0A0A0A' },
  topTitle: { fontSize: 15, fontWeight: '700', color: '#0A0A0A' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 10 },
  bodyContentTablet: { padding: 28, gap: 14 },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flex: 1, gap: 4 },
  rowClient: { fontSize: 14, fontWeight: '700', color: '#0A0A0A' },
  rowSub: { fontSize: 12, color: '#737373' },
  rowChevron: { fontSize: 20, color: '#A3A3A3' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0A0A0A' },
  emptyBody: {
    fontSize: 13,
    color: '#525252',
    textAlign: 'center',
    lineHeight: 19,
  },
  pressed: { opacity: 0.6 },
});
