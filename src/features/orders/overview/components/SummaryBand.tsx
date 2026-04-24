import { StyleSheet, Text, View } from 'react-native';

import type { OrdersOverviewSummaryDTO } from '../types';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export type SummaryBandProps = {
  readonly summary: OrdersOverviewSummaryDTO;
};

export function SummaryBand({ summary }: SummaryBandProps) {
  return (
    <View style={styles.card}>
      <Line label="Faturado" value={currency.format(summary.billed)} tone="neutral" />
      <Line
        label="Recebido"
        value={currency.format(summary.received)}
        tone="positive"
      />
      <Line
        label="Pendente"
        value={currency.format(summary.pending)}
        tone="warning"
      />
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(summary.progressRatio * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: 'neutral' | 'positive' | 'warning';
}) {
  const color =
    tone === 'positive' ? '#166534' : tone === 'warning' ? '#B45309' : '#0A0A0A';
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, { color }]}>{value}</Text>
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
    marginHorizontal: 16,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineLabel: { fontSize: 12, fontWeight: '500', color: '#525252' },
  lineValue: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#166534',
  },
});
