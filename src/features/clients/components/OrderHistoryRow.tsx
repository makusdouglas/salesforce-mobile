import { Feather } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import {
  type OrderHistoryRowDTO,
  type OrderHistoryStatus,
  type OrderPaymentStatus,
} from '../types';

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
   * own Pressable wins via event stopPropagation).
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

/**
 * 012-payment-receipts: "R$ 150 de R$ 420" style.
 * Strips the centavos when both sides are whole reais to save horizontal
 * space on phone. Shows 2-decimal precision otherwise.
 */
function formatReceivedOverTotal(received: number, total: number): string {
  const isWhole = Number.isInteger(received) && Number.isInteger(total);
  const fmt = (v: number): string =>
    isWhole
      ? `R$ ${Math.round(v).toLocaleString('pt-BR')}`
      : currency.format(v);
  return `${fmt(received)} de ${fmt(total)}`;
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

type PaymentChipStyle = {
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
  readonly border: string;
  readonly icon: 'check-circle' | 'clock' | 'alert-circle' | 'alert-triangle';
};

const PAYMENT: Record<OrderPaymentStatus, PaymentChipStyle> = {
  paid: {
    label: 'Pago',
    bg: '#ECFDF5',
    fg: '#15803D',
    border: '#A7F3D0',
    icon: 'check-circle',
  },
  partial: {
    label: 'Parcial',
    bg: '#FFFBEB',
    fg: '#B45309',
    border: '#FDE68A',
    icon: 'clock',
  },
  pending: {
    label: 'Pendente',
    bg: '#FEF2F2',
    fg: '#B91C1C',
    border: '#FECACA',
    icon: 'alert-circle',
  },
  adjust: {
    label: 'Ajuste pendente',
    bg: '#FEF2F2',
    fg: '#B91C1C',
    border: '#FECACA',
    icon: 'alert-triangle',
  },
};

export function OrderHistoryRow({ row, viewport, trailing, onPress }: OrderHistoryRowProps) {
  const isTablet = viewport === 'tablet';
  const isCanceled = row.status === 'canceled';
  const meta = STATUS[row.status];
  const paymentChip = row.paymentStatus !== null ? PAYMENT[row.paymentStatus] : null;

  const inner = (
    <>
      <View style={styles.content}>
        {/* Top row: date + status pill | total */}
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <Text style={[styles.date, isCanceled && styles.dateMuted]}>
              {formatDate(row.createdAtMs)}
            </Text>
            <View style={[styles.pill, { backgroundColor: meta.pillBg }]}>
              <Text style={[styles.pillLabel, { color: meta.pillFg }]}>{meta.label}</Text>
            </View>
          </View>
          <Text
            style={[styles.total, isCanceled && styles.totalCanceled]}
            numberOfLines={1}
          >
            {formatTotal(row.total)}
          </Text>
        </View>

        {/* Bottom row: payment chip (when sent) | received-over-total */}
        {paymentChip !== null ? (
          <View style={styles.botRow}>
            <View
              style={[
                styles.paymentChip,
                { backgroundColor: paymentChip.bg, borderColor: paymentChip.border },
              ]}
            >
              <Feather name={paymentChip.icon} size={12} color={paymentChip.fg} />
              <Text style={[styles.paymentChipLabel, { color: paymentChip.fg }]}>
                {paymentChip.label}
              </Text>
            </View>
            <Text style={styles.receivedOverTotal} numberOfLines={1}>
              {formatReceivedOverTotal(row.received, row.total)}
            </Text>
          </View>
        ) : null}
      </View>
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
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
    gap: 12,
  },
  rowTablet: {
    minHeight: 80,
    paddingHorizontal: 18,
  },
  rowCanceled: {
    backgroundColor: '#FAFAFA',
    opacity: 0.85,
  },
  rowPressed: {
    opacity: 0.7,
  },
  content: { flex: 1, gap: 6 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  date: {
    fontSize: 14,
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  dateMuted: { color: '#71717A' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillLabel: { fontSize: 11, fontWeight: '600' },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  totalCanceled: { color: '#A1A1AA', textDecorationLine: 'line-through' },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  paymentChipLabel: { fontSize: 11, fontWeight: '600' },
  receivedOverTotal: {
    fontSize: 12,
    fontWeight: '500',
    color: '#525252',
    fontVariant: ['tabular-nums'],
  },
});
