import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
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
 * Root element is intentionally a <View>, NOT a <ScrollView>. Home MUST
 * NOT scroll on the phone reference viewport per spec FR-020.
 *
 * The sync-pill slot is a <View /> placeholder until Phase 5 (US3) lands
 * the real HomeSyncPill component.
 */
export function HomeScreen({ navigation }: Props) {
  const viewport = useViewport();
  const { email } = useSession();
  const activeSp = useActiveSalespersonId();
  const sync = useSyncStatus();
  const catalog = useCatalogSummary();
  const clients = useClientsSummary(activeSp.salespersonId);
  const drafts = useDraftsSummary();
  const recentActivity = useLastSentOrder();

  const snapshot = deriveHomeSnapshot({
    email,
    sync,
    nowMs: Date.now(),
    catalog,
    clients,
    drafts,
    recentActivity,
  });

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
  // TODO(009-orders): replace with navigation to the drafts list.
  const goDraftsPlaceholder = (): void => {};
  // TODO(009-orders): replace with navigation to the sent-order detail.
  const goRecentActivityPlaceholder = (): void => {};

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

  const quickActionsTablet = (
    <View style={styles.tabletGrid}>
      <View style={[styles.tabletRow, { gap: cardGap }]}>
        <View style={styles.tabletCell}>
          <QuickActionCard
            card={snapshot.catalog}
            viewport={viewport}
            {...catalogHandlers}
          />
        </View>
        <View style={styles.tabletCell}>
          <QuickActionCard
            card={snapshot.clients}
            viewport={viewport}
            {...clientsHandlers}
          />
        </View>
      </View>
      <View style={[styles.tabletRow, { gap: cardGap, marginTop: cardGap }]}>
        <View style={styles.tabletCell}>
          <QuickActionCard
            card={snapshot.drafts}
            viewport={viewport}
            {...draftsHandlers}
          />
        </View>
        {/* Neutral spacer balances the 2-column grid per design/home-tablet.png */}
        <View style={styles.tabletCell} />
      </View>
    </View>
  );

  const quickActionsPhone = (
    <View style={[styles.phoneStack, { gap: cardGap }]}>
      <QuickActionCard
        card={snapshot.catalog}
        viewport={viewport}
        {...catalogHandlers}
      />
      <QuickActionCard
        card={snapshot.clients}
        viewport={viewport}
        {...clientsHandlers}
      />
      <QuickActionCard
        card={snapshot.drafts}
        viewport={viewport}
        {...draftsHandlers}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HomeTopBar
        viewport={viewport}
        onSettingsPress={goSettings}
        syncPillSlot={<HomeSyncPill viewport={viewport} />}
      />
      <View style={styles.body}>
        <GreetingBlock viewport={viewport} greeting={snapshot.greeting} />

        <View
          style={isTablet ? styles.sectionActionsTablet : styles.sectionActionsPhone}
        >
          <Text style={sectionLabelStyle}>
            {isTablet
              ? snapshot.sectionActionsLabel.toUpperCase()
              : snapshot.sectionActionsLabel}
          </Text>
          {isTablet ? quickActionsTablet : quickActionsPhone}
        </View>

        <View
          style={isTablet ? styles.sectionRecentTablet : styles.sectionRecentPhone}
        >
          <Text style={sectionLabelStyle}>
            {isTablet
              ? snapshot.sectionRecentLabel.toUpperCase()
              : snapshot.sectionRecentLabel}
          </Text>
          <RecentActivityCard
            viewport={viewport}
            activity={snapshot.recentActivity}
            empty={snapshot.recentActivityEmpty}
            nowMs={Date.now()}
            onPress={goRecentActivityPlaceholder}
          />
        </View>
      </View>
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
});
