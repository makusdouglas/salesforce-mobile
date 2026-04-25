import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { colors } from '@/app/theme/colors';
import { useSession } from '@/features/auth';
import { useActiveSalespersonId } from '@/features/clients';
import { onPullToRefresh, useSyncStatus } from '@/features/sync';

import { GreetingBlock } from '../components/GreetingBlock';
import { HomeSyncPill } from '../components/HomeSyncPill';
import { HomeTopBar } from '../components/HomeTopBar';
import { QuickActionCard } from '../components/QuickActionCard';
import { RecentActivityCard } from '../components/RecentActivityCard';
import { useActiveSalespersonName } from '../hooks/useActiveSalespersonName';
import { useCatalogSummary } from '../hooks/useCatalogSummary';
import { useClientsSummary } from '../hooks/useClientsSummary';
import { useDraftsSummary } from '../hooks/useDraftsSummary';
import { useLastSentOrder } from '../hooks/useLastSentOrder';
import { useViewport } from '../hooks/useViewport';
import { deriveHomeSnapshot } from '../snapshot/deriveHomeSnapshot';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomePlaceholder'>;

/**
 * Home — the salesperson's hub screen.
 *
 * Composition is centralized in `deriveHomeSnapshot` so the screen has no
 * derivation logic of its own. Reactivity flows from WatermelonDB (counts)
 * and `syncStatusStore` (sync state) through the summary hooks; React
 * re-renders, the snapshot is recomputed, cards pick up the new shape.
 *
 * Body is a <ScrollView> with `contentContainerStyle={{ flexGrow: 1 }}`
 * to host <RefreshControl>. The content fits the phone reference viewport
 * so there is no visible scroll (spec FR-020); the ScrollView exists
 * purely so the pull-to-refresh gesture works — the only way the seller
 * has to force a sync from Home.
 */
export function HomeScreen({ navigation }: Props) {
  const viewport = useViewport();
  const { email } = useSession();
  const activeSp = useActiveSalespersonId();
  const salespersonName = useActiveSalespersonName(activeSp.salespersonId);
  const sync = useSyncStatus();
  const catalog = useCatalogSummary();
  const clients = useClientsSummary(activeSp.salespersonId);
  const drafts = useDraftsSummary();
  const recentActivity = useLastSentOrder();

  const snapshot = deriveHomeSnapshot({
    name: salespersonName,
    email,
    sync,
    nowMs: Date.now(),
    catalog,
    clients,
    drafts,
    recentActivity,
  });

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onPullToRefresh();
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Cold-start auto-sync: when the app opens with a persisted session,
  // `startLoginTrigger` does NOT fire (it only fires on transitions into
  // Authenticated). Without this, the pill would stay at "Sincronizado"
  // without an age label indefinitely until the user pulls to refresh.
  // Here we detect the shape on Home's first mount (online, in-sync,
  // never-synced-this-session) and fire one silent sync so the label
  // fills in with "agora" and then ticks forward.
  const coldStartFired = useRef(false);
  useEffect(() => {
    if (coldStartFired.current) return;
    if (sync.status !== 'in-sync') return;
    if (sync.lastOkAt !== null) return;
    coldStartFired.current = true;
    void onPullToRefresh();
  }, [sync.status, sync.lastOkAt]);

  const isTablet = viewport === 'tablet';
  const sectionLabelStyle = isTablet ? styles.sectionLabelTablet : styles.sectionLabelPhone;
  const cardGap = isTablet ? 16 : 10;

  const goCatalog = (): void => {
    navigation.navigate('Catalog');
  };
  const goClients = (): void => {
    navigation.navigate('Clients');
  };
  const goClientForm = (): void => {
    navigation.navigate('ClientForm');
  };
  const goSettings = (): void => {
    navigation.navigate('Settings');
  };
  const syncNow = (): void => {
    void onPullToRefresh();
  };
  const goDraftsPlaceholder = (): void => {
    navigation.navigate('DraftsList');
  };
  const goOrders = (): void => {
    navigation.navigate('OrdersOverview');
  };
  // 013-orders-overview: the single-item RecentActivityCard taps into the
  // full orders surface (the seller can then inspect any sent/canceled
  // row from there). A dedicated deep-link into OrderDetail requires the
  // snapshot to carry the orderId, which is a cross-feature DTO change
  // deferred to a follow-up.
  const goRecentActivityPlaceholder = (): void => {
    navigation.navigate('OrdersOverview');
  };
  // 017-revenue-dashboard
  const goRevenue = (): void => {
    navigation.navigate('Revenue');
  };

  const catalogHandlers = {
    onPress: goCatalog,
    onEmptyCtaPress: syncNow,
  };
  const clientsHandlers = {
    onPress: goClients,
    onEmptyCtaPress: goClientForm,
  };
  const draftsHandlers = {
    onPress: goDraftsPlaceholder,
  };
  const ordersHandlers = {
    onPress: goOrders,
  };

  const quickActionsTablet = (
    <View style={styles.tabletGrid}>
      <View style={[styles.tabletRow, { gap: cardGap }]}>
        <View style={styles.tabletCell}>
          <QuickActionCard card={snapshot.catalog} viewport={viewport} {...catalogHandlers} />
        </View>
        <View style={styles.tabletCell}>
          <QuickActionCard card={snapshot.clients} viewport={viewport} {...clientsHandlers} />
        </View>
      </View>
      <View style={[styles.tabletRow, { gap: cardGap, marginTop: cardGap }]}>
        <View style={styles.tabletCell}>
          <QuickActionCard card={snapshot.drafts} viewport={viewport} {...draftsHandlers} />
        </View>
        <View style={styles.tabletCell}>
          <QuickActionCard card={snapshot.orders} viewport={viewport} {...ordersHandlers} />
        </View>
      </View>
      <View style={[styles.tabletRow, { gap: cardGap, marginTop: cardGap }]}>
        <View style={{ flex: 1 }}>
          <RevenueTile isTablet onPress={goRevenue} />
        </View>
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );

  const quickActionsPhone = (
    <View style={[styles.phoneStack, { gap: cardGap }]}>
      <QuickActionCard card={snapshot.catalog} viewport={viewport} {...catalogHandlers} />
      <QuickActionCard card={snapshot.clients} viewport={viewport} {...clientsHandlers} />
      <QuickActionCard card={snapshot.drafts} viewport={viewport} {...draftsHandlers} />
      <QuickActionCard card={snapshot.orders} viewport={viewport} {...ordersHandlers} />
      <RevenueTile isTablet={false} onPress={goRevenue} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HomeTopBar
        viewport={viewport}
        onSettingsPress={goSettings}
        syncPillSlot={<HomeSyncPill viewport={viewport} />}
      />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <GreetingBlock viewport={viewport} greeting={snapshot.greeting} />

        <View style={isTablet ? styles.sectionActionsTablet : styles.sectionActionsPhone}>
          <Text style={sectionLabelStyle}>
            {isTablet ? snapshot.sectionActionsLabel.toUpperCase() : snapshot.sectionActionsLabel}
          </Text>
          {isTablet ? quickActionsTablet : quickActionsPhone}
        </View>

        <View style={isTablet ? styles.sectionRecentTablet : styles.sectionRecentPhone}>
          <Text style={sectionLabelStyle}>
            {isTablet ? snapshot.sectionRecentLabel.toUpperCase() : snapshot.sectionRecentLabel}
          </Text>
          <RecentActivityCard
            viewport={viewport}
            activity={snapshot.recentActivity}
            empty={snapshot.recentActivityEmpty}
            nowMs={Date.now()}
            onPress={goRecentActivityPlaceholder}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    flexGrow: 1,
  },
  sectionActionsPhone: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  sectionActionsTablet: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 14,
  },
  sectionRecentPhone: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 10,
  },
  sectionRecentTablet: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 14,
  },
  sectionLabelPhone: {
    color: '#52525B',
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  sectionLabelTablet: {
    color: '#52525B',
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  phoneStack: {
    flexDirection: 'column',
  },
  tabletGrid: {
    flexDirection: 'column',
  },
  tabletRow: {
    flexDirection: 'row',
  },
  tabletCell: {
    flex: 1,
  },
  // 017-revenue-dashboard tile
  revTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    minHeight: 72,
  },
  revTileTablet: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 12,
    minHeight: 140,
  },
  revIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revIconBoxTablet: { width: 52, height: 52, borderRadius: 12 },
  revBody: { flex: 1, gap: 4 },
  revTitle: {
    color: '#0A0A0A',
    fontFamily: 'Funnel Sans',
    fontSize: 16,
    fontWeight: '600',
  },
  revTitleTablet: { fontSize: 18 },
  revSubtitle: {
    color: '#525252',
    fontFamily: 'Inter',
    fontSize: 13,
  },
});

// 017-revenue-dashboard — small inline tile placed alongside the
// catalog / clients / pedidos / rascunhos quick actions on the seller
// home (FR-002). Always visible to any signed-in seller.
function RevenueTile(props: { readonly isTablet: boolean; readonly onPress: () => void }) {
  const { isTablet, onPress } = props;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Minha receita"
      style={({ pressed }) => [
        styles.revTile,
        isTablet && styles.revTileTablet,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.revIconBox, isTablet && styles.revIconBoxTablet]}>
        <Ionicons name="trending-up-outline" size={isTablet ? 26 : 22} color="#15803D" />
      </View>
      <View style={styles.revBody}>
        <Text style={[styles.revTitle, isTablet && styles.revTitleTablet]}>Minha receita</Text>
        <Text style={styles.revSubtitle}>KPIs, tendência e aging dos seus pedidos.</Text>
      </View>
    </Pressable>
  );
}
