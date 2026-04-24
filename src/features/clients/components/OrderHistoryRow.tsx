import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type OrderHistoryRowDTO, type OrderHistoryStatus } from '../types';

export type OrderHistoryRowProps = {
  readonly row: OrderHistoryRowDTO;
  readonly viewport: Viewport;
  /**
   * 010-repeat-last-order: optional slot rendered on the trailing edge
   * (after the total). Callers pass <RepeatIconButton /> here.
   */
  readonly trailing?: ReactNode;
  /**
   * 011-order-email-delivery: optional tap handler. When provided, the
   * entire row becomes pressable (excluding the trailing button, whose
   * own Pressable wins via event stopPropagation). Used on sent rows to
   * re-open the stored PDF (FR-016).
   */
  readonly onPress?: () => void;
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

export function OrderHistoryRow({ row, viewport, trailing, onPress }: OrderHistoryRowProps) {
  const isTablet = viewport === 'tablet';
  const isCanceled = row.status === 'canceled';
  const meta = STATUS[row.status];

  const inner = (
    <>
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
      {trailing ?? null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          isTablet && styles.rowTablet,
          isCanceled && styles.rowCanceled,
          pressed && styles.rowPressed,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.row,
        isTablet && styles.rowTablet,
        isCanceled && styles.rowCanceled,
      ]}
    >
      {inner}
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
  rowPressed: {
    opacity: 0.7,
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
