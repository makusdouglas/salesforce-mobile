// 017-revenue-dashboard — Top 3 products by units sold (FR-021).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { emptyStates } from '../shared/empty-states';
import type { TopProduct } from '../shared/types';

import { PanelEmptyState } from './PanelEmptyState';

export interface TopProductsCardProps {
  readonly topProducts: readonly TopProduct[];
  readonly onProductPress?: ((productId: string) => void) | undefined;
}

function formatUnits(units: number): string {
  return `${Math.round(units)} un`;
}

export function TopProductsCard({ topProducts, onProductPress }: TopProductsCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Top produtos</Text>
      {topProducts.length === 0 ? (
        <PanelEmptyState message={emptyStates.topProductsNoData} />
      ) : (
        <View style={styles.list}>
          {topProducts.map((p, i) => (
            <Pressable
              key={p.productId}
              onPress={() => onProductPress?.(p.productId)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${p.productName}`}
            >
              <View style={styles.left}>
                <View style={styles.rank}>
                  <Text style={styles.rankText}>{i + 1}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {p.productName}
                </Text>
              </View>
              <Text style={styles.value}>{formatUnits(p.units)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 14,
    gap: 10,
  },
  title: {
    color: '#0A0A0A',
    fontFamily: 'Funnel Sans',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  rank: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#0A0A0A',
    fontFamily: 'Geist',
    fontSize: 10,
    fontWeight: '700',
  },
  name: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  value: {
    color: '#0A0A0A',
    fontFamily: 'Geist',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
