import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { useActiveSalespersonId } from '@/features/clients';

import { useViewport } from '../../hooks/useViewport';
import { formatShortOrderId as _fallbackShortId } from '../../formatting/formatShortOrderId';
import { MonthScrubber } from '../components/MonthScrubber';
import { MonthYearPicker } from '../components/MonthYearPicker';
import { OrdersOverviewRow } from '../components/OrdersOverviewRow';
import { SearchField } from '../components/SearchField';
import { StatusFilterChips } from '../components/StatusFilterChips';
import { SummaryBand } from '../components/SummaryBand';
import { useOrdersOverview } from '../hooks/useOrdersOverview';
import { useOrdersOverviewFilters } from '../hooks/useOrdersOverviewFilters';
import { buildReportData } from '../report/buildReportData';
import { exportReport, type ExportFormat } from '../report/exportReport';
import type { OrderOverviewRowDTO } from '../types';

type Props = NativeStackScreenProps<HomeStackParamList, 'OrdersOverview'>;

// Touch the import so it isn't dead-stripped if the row falls back to ids.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _keepAlive = _fallbackShortId;

/**
 * 013-orders-overview: consolidated orders list with month scrubber,
 * filter chips, text search, and a live summary band. Reads exclusively
 * from WatermelonDB; tablet viewport renders a split panel with an
 * in-screen detail preview.
 */
export function OrdersOverviewScreen({ navigation }: Props) {
  const viewport = useViewport();
  const activeSp = useActiveSalespersonId();
  const filters = useOrdersOverviewFilters();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [exportChooserOpen, setExportChooserOpen] = useState<boolean>(false);
  const [exportInFlight, setExportInFlight] = useState<boolean>(false);

  const { rows, summary, isLoading } = useOrdersOverview({
    salespersonId: activeSp.salespersonId,
    filter: filters.filter,
  });

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!activeSp.salespersonId) {
        setExportChooserOpen(false);
        return;
      }
      setExportChooserOpen(false);
      setExportInFlight(true);
      try {
        const data = await buildReportData({
          salespersonId: activeSp.salespersonId,
        });
        await exportReport({ data, format });
      } catch (err) {
        // Surface via console in dev; a toast/snackbar is a nice-to-have.
        // eslint-disable-next-line no-console
        console.warn('[orders-overview] export failed', err);
      } finally {
        setExportInFlight(false);
      }
    },
    [activeSp.salespersonId],
  );

  const countLabel = useMemo(() => {
    const n = summary.ordersCount;
    return n === 1 ? '1 pedido' : `${n} pedidos`;
  }, [summary.ordersCount]);

  const handleRowPress = (row: OrderOverviewRowDTO): void => {
    if (row.status === 'draft') {
      navigation.navigate('Orders', {
        screen: 'OrderDraft',
        params: { orderId: row.id },
      });
      return;
    }
    if (viewport === 'tablet') {
      // On tablet, update the in-screen selection — do NOT navigate.
      setSelectedId(row.id);
      return;
    }
    navigation.navigate('Orders', {
      screen: 'OrderDetail',
      params: { orderId: row.id },
    });
  };

  const searchBlock =
    viewport === 'tablet' ? (
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchField value={filters.filter.query} onChange={filters.setQuery} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exportar relatório"
          onPress={() => setExportChooserOpen(true)}
          disabled={exportInFlight || !activeSp.salespersonId}
          hitSlop={8}
          style={({ pressed }) => [
            styles.exportIconBtn,
            pressed && styles.exportIconBtnPressed,
            (exportInFlight || !activeSp.salespersonId) && styles.exportIconBtnDisabled,
          ]}
        >
          <Feather name="download" size={18} color="#0A0A0A" />
        </Pressable>
      </View>
    ) : (
      <SearchField value={filters.filter.query} onChange={filters.setQuery} />
    );

  const listHeader = (
    <View style={styles.stickyHeader}>
      <MonthScrubber
        monthKey={filters.filter.month}
        subtitle={countLabel}
        onPrev={filters.prevMonth}
        onNext={filters.nextMonth}
        onTitlePress={() => setPickerOpen(true)}
      />
      <View style={{ height: 12 }} />
      <SummaryBand summary={summary} />
      <View style={{ height: 12 }} />
      {searchBlock}
      <View style={{ height: 12 }} />
      <StatusFilterChips
        active={filters.filter.status}
        onChange={filters.setStatus}
      />
      <View style={{ height: 12 }} />
    </View>
  );

  const listEmpty = !isLoading ? (
    <View style={styles.empty}>
      <Feather name="inbox" size={28} color="#A1A1AA" />
      <Text style={styles.emptyTitle}>Sem pedidos neste mês</Text>
      <Text style={styles.emptySubtitle}>
        Use as setas acima para ver outro mês.
      </Text>
    </View>
  ) : null;

  const list = (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => (
        <View style={styles.rowWrap}>
          <OrdersOverviewRow
            row={item}
            selected={viewport === 'tablet' && selectedId === item.id}
            onPress={() => handleRowPress(item)}
          />
        </View>
      )}
      initialNumToRender={12}
      windowSize={5}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.topIcon}
        >
          <Feather name="arrow-left" size={22} color="#0A0A0A" />
        </Pressable>
        <Text style={styles.topTitle}>Pedidos</Text>
        {viewport === 'phone' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exportar relatório"
            onPress={() => setExportChooserOpen(true)}
            disabled={exportInFlight || !activeSp.salespersonId}
            hitSlop={12}
            style={({ pressed }) => [
              styles.topIcon,
              pressed && styles.topIconPressed,
              (exportInFlight || !activeSp.salespersonId) && styles.topIconDisabled,
            ]}
          >
            <Feather name="download" size={20} color="#0A0A0A" />
          </Pressable>
        ) : (
          <View style={styles.topIcon} />
        )}
      </View>
      {viewport === 'tablet' ? (
        <View style={styles.split}>
          <View style={styles.leftPane}>{list}</View>
          <View style={styles.rightPane}>
            {selectedId ? (
              <TabletDetailPreview orderId={selectedId} />
            ) : (
              <View style={styles.rightEmpty}>
                <Feather name="file-text" size={32} color="#D4D4D8" />
                <Text style={styles.rightEmptyTitle}>
                  Selecione um pedido para ver os detalhes
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        list
      )}

      <MonthYearPicker
        visible={pickerOpen}
        activeMonth={filters.filter.month}
        onChange={filters.setMonth}
        onClose={() => setPickerOpen(false)}
      />

      <ExportChooserModal
        visible={exportChooserOpen}
        onClose={() => setExportChooserOpen(false)}
        onPick={handleExport}
        busy={exportInFlight}
      />
    </SafeAreaView>
  );
}

function ExportChooserModal({
  visible,
  onClose,
  onPick,
  busy,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onPick: (format: ExportFormat) => void;
  readonly busy: boolean;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.chooserBackdrop} onPress={onClose}>
        <Pressable style={styles.chooserSheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.chooserGrabber} />
            <Text style={styles.chooserTitle}>Exportar relatório</Text>
            <Text style={styles.chooserSub}>
              Inclui todos os meses com pedidos deste vendedor.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onPick('pdf')}
              disabled={busy}
              style={({ pressed }) => [
                styles.chooserBtn,
                styles.chooserBtnPrimary,
                pressed && styles.chooserBtnPressed,
              ]}
            >
              <Feather name="file-text" size={16} color="#FFFFFF" />
              <Text style={[styles.chooserBtnLabel, { color: '#FFFFFF' }]}>
                Exportar como PDF
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onPick('csv')}
              disabled={busy}
              style={({ pressed }) => [
                styles.chooserBtn,
                styles.chooserBtnSecondary,
                pressed && styles.chooserBtnPressed,
              ]}
            >
              <Feather name="grid" size={16} color="#0A0A0A" />
              <Text style={[styles.chooserBtnLabel, { color: '#0A0A0A' }]}>
                Exportar como CSV
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              disabled={busy}
              style={({ pressed }) => [
                styles.chooserBtn,
                styles.chooserBtnGhost,
                pressed && styles.chooserBtnPressed,
              ]}
            >
              <Text style={[styles.chooserBtnLabel, { color: '#525252' }]}>
                Cancelar
              </Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Lazy-ish local wrap to keep the module graph simple for the tablet split.
function TabletDetailPreview({ orderId }: { readonly orderId: string }) {
  const { OrderDetailEmbedded } = require('../../detail/screens/OrderDetailScreen');
  return <OrderDetailEmbedded orderId={orderId} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E4E4E7',
    borderBottomWidth: 1,
  },
  topIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  topIconPressed: { backgroundColor: '#F4F4F5' },
  topIconDisabled: { opacity: 0.4 },
  topTitle: { fontSize: 15, fontWeight: '600', color: '#0A0A0A' },
  stickyHeader: { paddingTop: 0, paddingBottom: 4 },
  listContent: { paddingBottom: 24 },
  rowWrap: { paddingHorizontal: 16 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#3F3F46' },
  emptySubtitle: { fontSize: 12, color: '#71717A' },
  split: { flex: 1, flexDirection: 'row' },
  leftPane: {
    width: 420,
    backgroundColor: '#FAFAFA',
    borderRightColor: '#E4E4E7',
    borderRightWidth: 1,
  },
  rightPane: { flex: 1, backgroundColor: '#FAFAFA' },
  rightEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  exportIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
  },
  exportIconBtnPressed: { opacity: 0.7 },
  exportIconBtnDisabled: { opacity: 0.4 },
  rightEmptyTitle: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'center',
  },
  chooserBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.4)',
    justifyContent: 'flex-end',
  },
  chooserSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  chooserGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E4E4E7',
    marginBottom: 18,
  },
  chooserTitle: { fontSize: 16, fontWeight: '700', color: '#0A0A0A', marginBottom: 4 },
  chooserSub: { fontSize: 12, color: '#737373', marginBottom: 16 },
  chooserBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  chooserBtnPrimary: { backgroundColor: '#171717' },
  chooserBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
  },
  chooserBtnGhost: { backgroundColor: '#F5F5F5' },
  chooserBtnPressed: { opacity: 0.85 },
  chooserBtnLabel: { fontSize: 13, fontWeight: '600' },
});
