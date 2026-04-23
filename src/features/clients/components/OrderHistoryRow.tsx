import { StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type OrderHistoryRowDTO, type OrderHistoryStatus } from '../types';

export type OrderHistoryRowProps = {
  readonly row: OrderHistoryRowDTO;
  readonly viewport: Viewport;
};

function formatDate(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatTotal(value: number): string {
  return currency.format(value);
}

type StatusStyle = {
  readonly label: string;
  readonly pillBg: string;
  readonly pillFg: string;
};

const STATUS: Record<OrderHistoryStatus, StatusStyle> = {
  draft: { label: 'Rascunho', pillBg: '#F4F4F5', pillFg: '#52525B' },
  sent: { label: 'Enviado', pillBg: '#DCFCE7', pillFg: '#166534' },
  canceled: { label: 'Cancelado', pillBg: '#FEE2E2', pillFg: '#991B1B' },
};

export function OrderHistoryRow({ row, viewport }: OrderHistoryRowProps) {
  const isTablet = viewport === 'tablet';
  const isCanceled = row.status === 'canceled';
  const meta = STATUS[row.status];

  return (
    <View
      style={[
        styles.row,
        isTablet && styles.rowTablet,
        isCanceled && styles.rowCanceled,
      ]}
    >
      <View style={styles.leading}>
        <Text style={[styles.date, isCanceled && styles.dateMuted]}>
          {formatDate(row.createdAtMs)}
        </Text>
        <View style={[styles.pill, { backgroundColor: meta.pillBg }]}>
          <Text style={[styles.pillLabel, { color: meta.pillFg }]}>{meta.label}</Text>
        </View>
      </View>
      <Text
        style={[
          styles.total,
          isCanceled && styles.totalCanceled,
        ]}
        numberOfLines={1}
      >
        {formatTotal(row.total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
    gap: 8,
  },
  rowTablet: {
    minHeight: 72,
    paddingHorizontal: 16,
  },
  rowCanceled: {
    backgroundColor: '#FAFAFA',
    opacity: 0.85,
  },
  leading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  date: {
    fontSize: 14,
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  dateMuted: {
    color: '#71717A',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  total: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  totalCanceled: {
    color: '#A1A1AA',
    textDecorationLine: 'line-through',
  },
});
