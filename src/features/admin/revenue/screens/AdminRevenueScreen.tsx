// 017-revenue-dashboard — admin scope. Aggregated cross-seller view
// with optional vendedor filter + período picker. Online-first per P6.

import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';
import { MonthYearPicker } from '@/features/orders/overview/components/MonthYearPicker';
import {
  AgingCard,
  emptyStates,
  KpiBand,
  SellerRankingCard,
  TopClientsCard,
  TopProductsCard,
  TrendChartCard,
  TwoUp,
 useViewport } from '@/features/revenue';

import { VendedorFilterSheet } from '../components/VendedorFilterSheet';
import { useActiveSellersForFilter } from '../hooks/useActiveSellersForFilter';
import { useAdminRevenue } from '../hooks/useAdminRevenue';
import { useAdminRevenueFilters } from '../hooks/useAdminRevenueFilters';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminRevenue'>;

const PT_MONTH = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatPeriodLabel(monthKey: string): string {
  const month = Number.parseInt(monthKey.slice(5, 7), 10);
  const year = monthKey.slice(0, 4);
  return `${PT_MONTH[month - 1] ?? '???'} ${year}`;
}

function formatStaleTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function AdminRevenueScreen() {
  const nav = useNavigation<Nav>();
  const isTablet = useViewport() === 'tablet';
  const { filter, setSellerId, setMonth } = useAdminRevenueFilters();
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [vendorSheetOpen, setVendorSheetOpen] = useState(false);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const sellersList = useActiveSellersForFilter();

  const { state, snapshot, comparisonAvailable, refetch } = useAdminRevenue({
    filter,
    comparisonEnabled,
  });

  const isLoading = state.kind === 'loading';
  const isStale = state.kind === 'ready_stale';
  const isError = state.kind === 'error';

  const sellerLabel =
    filter.sellerId === null
      ? 'Todos'
      : sellersList.sellers.find((s) => s.id === filter.sellerId)?.name ?? 'Vendedor';

  const periodLabel = formatPeriodLabel(filter.month);

  const onMonthDrillDown = (monthKey: string): void => {
    // Cross-tab navigation (admin tab → home tab → OrdersOverview).
    // React Navigation's typed surface doesn't carry sibling tabs across
    // the parent boundary cleanly, so we widen at the call site only.
    const parent = nav.getParent() as { navigate: (name: string, params: unknown) => void } | undefined;
    parent?.navigate('HomeTab', {
      screen: 'OrdersOverview',
      params: { month: monthKey, salespersonId: filter.sellerId },
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          onPress={() => nav.goBack()}
          hitSlop={8}
          accessibilityLabel="Voltar"
        >
          <Feather name="chevron-left" size={isTablet ? 26 : 24} color="#0A0A0A" />
        </Pressable>
        <Text style={[styles.topTitle, isTablet && styles.topTitleTablet]}>Receita</Text>
        <Pressable
          onPress={refetch}
          disabled={isLoading}
          hitSlop={8}
          accessibilityLabel="Atualizar"
        >
          <Feather
            name="refresh-cw"
            size={isTablet ? 22 : 20}
            color={isLoading ? '#A3A3A3' : '#525252'}
          />
        </Pressable>
      </View>

      <View style={[styles.filterBar, isTablet && styles.filterBarTablet]}>
        <Pressable
          onPress={() => setVendorSheetOpen(true)}
          style={({ pressed }) => [
            styles.chipPrimary,
            pressed && { opacity: 0.85 },
            isTablet && styles.chipTablet,
          ]}
        >
          <Feather name="users" size={14} color="#FAFAFA" />
          <Text style={styles.chipPrimaryText} numberOfLines={1}>
            {sellerLabel}
          </Text>
          <Feather name="chevron-down" size={14} color="#FAFAFA" />
        </Pressable>
        <Pressable
          onPress={() => setPeriodPickerOpen(true)}
          style={({ pressed }) => [
            styles.chipOutline,
            pressed && { opacity: 0.85 },
            isTablet && styles.chipTablet,
          ]}
        >
          <Feather name="calendar" size={14} color="#525252" />
          <Text style={styles.chipOutlineText}>{periodLabel}</Text>
          <Feather name="chevron-down" size={14} color="#525252" />
        </Pressable>
      </View>

      {isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorMsg}>
            {state.kind === 'error' && state.lastError === 'forbidden'
              ? 'Sem permissão para ver esta área.'
              : state.kind === 'error' && state.lastError === 'network'
                ? emptyStates.errorNoConnection
                : 'Não foi possível carregar a receita. Verifique se a migration 0020 foi aplicada.'}
          </Text>
          <Pressable
            onPress={refetch}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.retryText}>{emptyStates.errorRetryCta}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.body, isTablet && styles.bodyTablet]}
        >
          {isStale && snapshot ? (
            <View style={styles.staleBanner}>
              <Feather name="alert-triangle" size={14} color="#525252" />
              <Text style={styles.staleText}>
                {emptyStates.staleSnapshotPrefix}{' '}
                {formatStaleTime(snapshot.fetchedAt)}
              </Text>
              <Pressable onPress={refetch} hitSlop={8}>
                <Text style={styles.staleRetry}>Atualizar</Text>
              </Pressable>
            </View>
          ) : null}

          {snapshot ? (
            <View style={[styles.panels, isLoading && { opacity: 0.55 }]}>
              <KpiBand kpis={snapshot.kpis} />

              <TrendChartCard
                trend={snapshot.trend}
                priorYearTrend={snapshot.priorYearTrend}
                comparisonEnabled={comparisonEnabled}
                comparisonAvailable={comparisonAvailable}
                onToggleComparison={setComparisonEnabled}
                onMonthPress={onMonthDrillDown}
              />

              <SellerRankingCard
                ranking={snapshot.sellerRanking ?? []}
                periodLabel={periodLabel}
                onSellerPress={(id) => setSellerId(id)}
              />

              <TwoUp
                gap={isTablet ? 16 : 12}
                left={
                  <TopClientsCard
                    topClients={snapshot.topClients}
                    onClientPress={(clientId) => {
                      const parent = nav.getParent() as
                        | { navigate: (name: string, params: unknown) => void }
                        | undefined;
                      parent?.navigate('HomeTab', {
                        screen: 'ClientProfile',
                        params: { clientId },
                      });
                    }}
                  />
                }
                right={
                  <TopProductsCard
                    topProducts={snapshot.topProducts}
                    onProductPress={(productId) =>
                      nav.navigate('AdminProductForm', { productId })
                    }
                  />
                }
              />

              <AgingCard aging={snapshot.aging} />
            </View>
          ) : (
            <View style={styles.loadingBox}>
              <Text style={styles.loadingText}>Carregando dados…</Text>
            </View>
          )}
        </ScrollView>
      )}

      <VendedorFilterSheet
        visible={vendorSheetOpen}
        sellers={sellersList.sellers}
        loading={sellersList.loading}
        currentSellerId={filter.sellerId}
        onSelect={setSellerId}
        onClose={() => setVendorSheetOpen(false)}
      />

      <MonthYearPicker
        visible={periodPickerOpen}
        activeMonth={filter.month}
        onChange={setMonth}
        onClose={() => setPeriodPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    gap: 10,
  },
  topBarTablet: { height: 64, paddingHorizontal: 28 },
  topTitle: {
    color: '#0A0A0A',
    fontFamily: 'Funnel Sans',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginLeft: 6,
  },
  topTitleTablet: { fontSize: 22, fontWeight: '700' },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    gap: 8,
    alignItems: 'center',
  },
  filterBarTablet: {
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  chipPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    backgroundColor: '#171717',
    borderRadius: 16,
    maxWidth: 220,
  },
  chipPrimaryText: {
    color: '#FAFAFA',
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
  },
  chipOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  chipOutlineText: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTablet: { height: 36, paddingHorizontal: 14 },
  scroll: { flex: 1 },
  body: { padding: 16, paddingBottom: 32, gap: 16 },
  bodyTablet: { padding: 28, paddingBottom: 32, gap: 20 },
  panels: { gap: 16 },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  errorMsg: {
    color: '#525252',
    fontFamily: 'Inter',
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
  },
  retryText: {
    color: '#FAFAFA',
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#737373',
    fontFamily: 'Geist',
    fontSize: 13,
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
  },
  staleText: {
    flex: 1,
    color: '#525252',
    fontFamily: 'Geist',
    fontSize: 12,
    fontWeight: '500',
  },
  staleRetry: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
  },
});
