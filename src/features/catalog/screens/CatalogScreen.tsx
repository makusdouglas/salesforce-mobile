import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { SearchBar } from '@/components/SearchBar';
import { onPullToRefresh, SyncStatusIndicator, useSyncStatus } from '@/features/sync';

import { CatalogEmptyView } from '../components/CatalogEmptyView';
import { CatalogNoMatchesView } from '../components/CatalogNoMatchesView';
import { FilterChipRow } from '../components/FilterChipRow';
import { ProductGrid } from '../components/ProductGrid';
import { useCatalog } from '../hooks/useCatalog';
import { useCatalogCacheWarmer } from '../hooks/useCatalogCacheWarmer';
import { useCatalogFilter } from '../hooks/useCatalogFilter';
import { useViewport } from '../hooks/useViewport';

import { OrderContextSummaryBar } from './OrderContextSummaryBar';

type Props = NativeStackScreenProps<HomeStackParamList, 'Catalog'>;

export function CatalogScreen({ navigation, route }: Props) {
  const { products, hasAny } = useCatalog();
  const viewport = useViewport();
  const { status } = useSyncStatus();
  const filter = useCatalogFilter(products);
  // 009-order-assembly: when the catalog is opened in "order context",
  // the sticky bottom summary bar is rendered and ProductDetail swaps its
  // primary CTA to "Adicionar ao pedido" (see route param forwarding below).
  const inOrderId = route.params?.inOrderId ?? null;

  useCatalogCacheWarmer();

  const handleProductPress = (productId: string) => {
    navigation.navigate('ProductDetail', {
      productId,
      ...(inOrderId !== null ? { inOrderId } : {}),
    });
  };

  const handleSummaryBackToOrder = useCallback(() => {
    if (inOrderId === null) return;
    navigation.navigate('Orders', {
      screen: 'OrderDraft',
      params: { orderId: inOrderId },
    });
  }, [inOrderId, navigation]);

  const handleSyncPress = useCallback(async () => {
    // Offline is communicated inline by the SyncStatusIndicator pill per
    // constitution UX4 ("sync feedback — never a modal or alert"); tapping
    // refresh while offline is a no-op.
    if (status === 'offline') return;
    await onPullToRefresh();
  }, [status]);

  const isTablet = viewport === 'tablet';
  const hasActiveFilter = filter.query !== '' || filter.activeCategory !== null;
  const noMatches = hasAny && filter.filtered.length === 0 && hasActiveFilter;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Catálogo</Text>
        <View style={styles.syncSlot}>
          <SyncStatusIndicator />
        </View>
      </View>

      {!hasAny ? (
        <CatalogEmptyView onSyncPress={handleSyncPress} viewport={viewport} />
      ) : (
        <>
          <View
            style={[
              styles.filterArea,
              {
                paddingHorizontal: isTablet ? 28 : 16,
                paddingTop: isTablet ? 20 : 12,
                gap: isTablet ? 14 : 10,
              },
            ]}
          >
            <SearchBar
              value={filter.query}
              onChangeText={filter.setQuery}
              placeholder="Buscar produto"
            />
            <FilterChipRow
              products={products}
              activeCategory={filter.activeCategory}
              onChange={filter.setActiveCategory}
              viewport={viewport}
            />
          </View>
          {noMatches ? (
            <CatalogNoMatchesView onReset={filter.reset} viewport={viewport} />
          ) : (
            <ProductGrid
              products={filter.filtered}
              onProductPress={handleProductPress}
              viewport={viewport}
            />
          )}
        </>
      )}
      {inOrderId !== null ? (
        <OrderContextSummaryBar
          orderId={inOrderId}
          onPress={handleSummaryBackToOrder}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  backChevron: {
    fontSize: 32,
    color: '#0A0A0A',
    marginTop: -4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  syncSlot: {
    width: 40,
    alignItems: 'flex-end',
  },
  filterArea: {
    backgroundColor: '#FAFAFA',
    paddingBottom: 8,
  },
});
