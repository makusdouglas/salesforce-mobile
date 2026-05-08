import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrderOverviewRowDTO } from '../types';
import type {
  OrderPaymentStatus,
  OrderStatus,
} from '../../payment/derivePaymentStatus';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

type StatusChipStyle = {
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
};

const STATUS: Record<OrderStatus, StatusChipStyle> = {
  draft: { label: 'Rascunho', bg: '#F4F4F5', fg: '#3F3F46' },
  sent: { label: 'Enviado', bg: '#ECFDF5', fg: '#047857' },
  canceled: { label: 'Cancelado', bg: '#FEE2E2', fg: '#B91C1C' },
};

const PAYMENT: Record<OrderPaymentStatus, StatusChipStyle> = {
  paid: { label: 'Pago', bg: '#DCFCE7', fg: '#15803D' },
  partial: { label: 'Parcial', bg: '#FEF9C3', fg: '#A16207' },
  pending: { label: 'Pendente', bg: '#FFEDD5', fg: '#C2410C' },
  adjust: { label: 'Ajuste', bg: '#FEE2E2', fg: '#B91C1C' },
};

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

function formatShortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()] ?? ''}`;
}

function hoursAgo(ms: number): string | null {
  const diff = Date.now() - ms;
  const hours = diff / (1000 * 60 * 60);
  if (hours < 0) return null;
  if (hours < 1) return 'agora';
  if (hours < 24) return `há ${Math.floor(hours)} h`;
  return null;
}

export type OrdersOverviewRowProps = {
  readonly row: OrderOverviewRowDTO;
  readonly selected?: boolean;
  readonly onPress: () => void;
};

export function OrdersOverviewRow({ row, selected, onPress }: OrdersOverviewRowProps) {
  const isCanceled = row.status === 'canceled';
  const statusChip = STATUS[row.status];
  const paymentChip =
    row.paymentStatus !== null ? PAYMENT[row.paymentStatus] : null;
  const partialDetail =
    row.paymentStatus === 'partial'
      ? ` · R$ ${Math.round(row.received).toLocaleString('pt-BR')}`
      : '';

  const timestamp =
    row.status === 'draft'
      ? hoursAgo(row.effectiveTimestampMs) ?? formatShortDate(row.effectiveTimestampMs)
      : formatShortDate(row.effectiveTimestampMs);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.clientName} · ${currency.format(row.total)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        isCanceled && styles.rowCanceled,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.head}>
        <Text
          style={[styles.client, isCanceled && styles.clientMuted]}
          numberOfLines={1}
        >
          {row.clientName || row.shortId}
        </Text>
        <Text
          style={[styles.total, isCanceled && styles.totalMuted]}
          numberOfLines={1}
        >
          {currency.format(row.total)}
        </Text>
      </View>
      <View style={styles.meta}>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: statusChip.bg }]}>
            <Text style={[styles.chipText, { color: statusChip.fg }]}>
              {statusChip.label}
            </Text>
          </View>
          {paymentChip ? (
            <View style={[styles.chip, { backgroundColor: paymentChip.bg }]}>
              <Text style={[styles.chipText, { color: paymentChip.fg }]}>
                {paymentChip.label}
                {partialDetail}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.timestamp}>
          {`${row.timestampLabel} ${timestamp}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  rowSelected: { borderColor: '#0A0A0A', borderWidth: 2 },
  rowCanceled: { backgroundColor: '#FAFAFA' },
  rowPressed: { opacity: 0.7 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  client: { fontSize: 15, fontWeight: '600', color: '#0A0A0A', flex: 1 },
  clientMuted: { color: '#71717A' },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  totalMuted: { color: '#71717A' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '600' },
  timestamp: { fontSize: 12, color: '#71717A' },
});
