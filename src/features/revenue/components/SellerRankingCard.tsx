// 017-revenue-dashboard — admin-only ranking of sellers by Recebido in
// the active month. Tap a row → setSellerFilter(salespersonId) on the
// dashboard (FR-018). Top 10 cap is enforced upstream (SQL) but we
// guard here too.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatBRL } from '@/features/orders/formatting/formatBRL';

import { emptyStates } from '../shared/empty-states';
import type { RankedSeller } from '../shared/types';

import { PanelEmptyState } from './PanelEmptyState';

export interface SellerRankingCardProps {
  readonly ranking: readonly RankedSeller[];
  readonly periodLabel: string;
  readonly onSellerPress?: ((salespersonId: string) => void) | undefined;
}

export function SellerRankingCard({
  ranking,
  periodLabel,
  onSellerPress,
}: SellerRankingCardProps) {
  const topNonZero = ranking.filter((r) => r.recebido > 0).slice(0, 10);
  const max = topNonZero.length > 0 ? (topNonZero[0] as RankedSeller).recebido : 0;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Ranking de vendedores</Text>
        <Text style={styles.period}>{periodLabel}</Text>
      </View>
      {topNonZero.length === 0 ? (
        <PanelEmptyState message={emptyStates.rankingNoData} />
      ) : (
        <View style={styles.list}>
          {topNonZero.map((row) => {
            const ratio = max > 0 ? row.recebido / max : 0;
            return (
              <Pressable
                key={row.salespersonId}
                onPress={() => onSellerPress?.(row.salespersonId)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar por ${row.salespersonName}`}
              >
                <View style={styles.labelRow}>
                  <Text style={styles.name}>{row.salespersonName}</Text>
                  <Text style={styles.value}>{formatBRL(row.recebido)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.round(ratio * 100)}%` },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
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
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#0A0A0A',
    fontFamily: 'Funnel Sans',
    fontSize: 14,
    fontWeight: '600',
  },
  period: {
    color: '#737373',
    fontFamily: 'Geist',
    fontSize: 11,
  },
  list: {
    gap: 8,
  },
  row: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
  },
  value: {
    color: '#0A0A0A',
    fontFamily: 'Geist',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
});
