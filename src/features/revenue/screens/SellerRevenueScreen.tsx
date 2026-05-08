// 017-revenue-dashboard — seller scope. Hidden ranking, no vendedor
// filter, fully offline (FR-017, FR-032, FR-043).

import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { useActiveSalespersonId } from '@/features/clients';

import {
  AgingCard,
  KpiBand,
  TopClientsCard,
  TopProductsCard,
  TrendChartCard,
  TwoUp,
} from '../components';
import { useViewport } from '../hooks/useViewport';
import { useSellerRevenue } from '../hooks/useSellerRevenue';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Revenue'>;

const PT_MONTH = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatPeriodLabel(monthKey: string): string {
  const month = Number.parseInt(monthKey.slice(5, 7), 10);
  const year = monthKey.slice(0, 4);
  return `${PT_MONTH[month - 1] ?? '???'} ${year}`;
}

export function SellerRevenueScreen() {
  const nav = useNavigation<Nav>();
  const isTablet = useViewport() === 'tablet';
  const activeSp = useActiveSalespersonId();
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const { snapshot, comparisonAvailable } = useSellerRevenue({
    salespersonId: activeSp.salespersonId,
    comparisonEnabled,
  });

  const periodLabel = formatPeriodLabel(snapshot.filter.month);
  const sellerId = activeSp.salespersonId;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          onPress={() => nav.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Feather name="chevron-left" size={isTablet ? 26 : 24} color="#0A0A0A" />
        </Pressable>
        <Text style={[styles.topTitle, isTablet && styles.topTitleTablet]}>Minha receita</Text>
        <Text style={[styles.topPeriod, isTablet && styles.topPeriodTablet]}>{periodLabel}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, isTablet && styles.bodyTablet]}
      >
        <KpiBand kpis={snapshot.kpis} />

        <TrendChartCard
          trend={snapshot.trend}
          priorYearTrend={snapshot.priorYearTrend}
          comparisonEnabled={comparisonEnabled}
          comparisonAvailable={comparisonAvailable}
          onToggleComparison={setComparisonEnabled}
          onMonthPress={(month) =>
            nav.navigate('OrdersOverview', {
              month,
              salespersonId: sellerId,
            })
          }
        />

        <TwoUp
          gap={isTablet ? 16 : 12}
          left={
            <TopClientsCard
              topClients={snapshot.topClients}
              onClientPress={(clientId) => nav.navigate('ClientProfile', { clientId })}
            />
          }
          right={
            <TopProductsCard
              topProducts={snapshot.topProducts}
              onProductPress={(productId) =>
                nav.navigate('ProductDetail', { productId })
              }
            />
          }
        />

        <AgingCard aging={snapshot.aging} />
      </ScrollView>
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
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  topBarTablet: { height: 64, paddingHorizontal: 28, gap: 12 },
  topTitle: {
    color: '#0A0A0A',
    fontFamily: 'Funnel Sans',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  topTitleTablet: { fontSize: 22, fontWeight: '700' },
  topPeriod: {
    color: '#525252',
    fontFamily: 'Geist',
    fontSize: 12,
    fontWeight: '500',
  },
  topPeriodTablet: { fontSize: 14 },
  scroll: { flex: 1 },
  body: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  bodyTablet: {
    padding: 28,
    paddingBottom: 32,
    gap: 20,
  },
});
