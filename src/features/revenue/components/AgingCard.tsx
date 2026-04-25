// 017-revenue-dashboard — receivables aging panel. Four buckets, color
// gradient from green (fresh) → red (overdue). Collapses to empty
// state when every bucket is zero (FR-029).

import { StyleSheet, Text, View } from 'react-native';

import { formatBRL } from '@/features/orders/formatting/formatBRL';

import { emptyStates } from '../shared/empty-states';
import type { AgingBucket } from '../shared/types';

import { PanelEmptyState } from './PanelEmptyState';

export interface AgingCardProps {
  readonly aging: readonly AgingBucket[];
}

const LABEL_PT: Record<AgingBucket['label'], string> = {
  '0-30': '0–30 dias',
  '31-60': '31–60 dias',
  '61-90': '61–90 dias',
  '>90': '>90 dias',
};

const COLOR: Record<AgingBucket['label'], string> = {
  '0-30': '#16A34A',
  '31-60': '#F59E0B',
  '61-90': '#EA580C',
  '>90': '#DC2626',
};

export function AgingCard({ aging }: AgingCardProps) {
  const total = aging.reduce((acc, b) => acc + b.totalPendente, 0);
  const max = aging.reduce((acc, b) => Math.max(acc, b.totalPendente), 0);
  const allZero = total === 0;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Aging de recebíveis</Text>
        {!allZero ? (
          <Text style={styles.subtitle}>{formatBRL(total)} em aberto</Text>
        ) : null}
      </View>
      {allZero ? (
        <PanelEmptyState message={emptyStates.agingNoPending} />
      ) : (
        <View style={styles.list}>
          {aging.map((b) => {
            const ratio = max > 0 ? b.totalPendente / max : 0;
            const isOverdue = b.label === '>90';
            return (
              <View key={b.label} style={styles.row}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{LABEL_PT[b.label]}</Text>
                  <Text
                    style={[
                      styles.value,
                      isOverdue ? styles.valueOverdue : styles.valueDefault,
                    ]}
                  >
                    {formatBRL(b.totalPendente)}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.round(ratio * 100)}%`,
                        backgroundColor: COLOR[b.label],
                      },
                    ]}
                  />
                </View>
              </View>
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
    gap: 12,
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
  subtitle: {
    color: '#525252',
    fontFamily: 'Geist',
    fontSize: 11,
    fontWeight: '500',
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
  label: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
  },
  value: {
    fontFamily: 'Geist',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  valueDefault: {
    color: '#0A0A0A',
  },
  valueOverdue: {
    color: '#DC2626',
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
  },
});
