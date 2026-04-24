// 012-payment-receipts T040: single row in the receipts list. Renders
// amount + method/Correção badge + date caption + optional attachment
// paperclip + chevron. Correction rows use the destructive palette and
// reference the original receipt's method + date via a caption ("estorno
// de 10 abr · Dinheiro").

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatBRL, formatShortDatePt, methodLabel } from '../formatting';
import type { PaymentMethod } from '@/data/types';

export interface ReceiptRowProps {
  readonly id: string;
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly receivedAtMs: number;
  readonly hasAttachment: boolean;
  readonly isCorrection: boolean;
  /**
   * When the row is a correction AND the original receipt is known, the
   * caption is enriched with the original's method + date. When the
   * original has not yet synced in (orphan correction), this is null and
   * the row renders the raw amount + badge without the enriching caption
   * (R8 in research.md).
   */
  readonly correctionCaption: string | null;
  readonly hasDivider: boolean;
  readonly onPress: (receiptId: string) => void;
}

export function ReceiptRow(props: ReceiptRowProps) {
  const {
    id,
    amount,
    method,
    receivedAtMs,
    hasAttachment,
    isCorrection,
    correctionCaption,
    hasDivider,
    onPress,
  } = props;

  const amountColor = isCorrection || amount < 0 ? '#B91C1C' : '#0A0A0A';
  const formattedAmount = amount < 0 ? `− ${formatBRL(Math.abs(amount))}` : formatBRL(amount);
  const dateText = formatShortDatePt(receivedAtMs);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Recebimento ${formattedAmount}`}
      onPress={() => onPress(id)}
      style={({ pressed }) => [
        styles.row,
        hasDivider && styles.rowDivider,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.rowAmount, { color: amountColor }]}>{formattedAmount}</Text>
          <View
            style={[
              styles.methodBadge,
              isCorrection && styles.methodBadgeCorrection,
            ]}
          >
            <Text
              style={[
                styles.methodBadgeText,
                isCorrection && styles.methodBadgeTextCorrection,
              ]}
            >
              {isCorrection ? 'Correção' : methodLabel(method)}
            </Text>
          </View>
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {isCorrection && correctionCaption !== null ? correctionCaption : dateText}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {hasAttachment ? <Feather name="paperclip" size={16} color="#737373" /> : null}
        <Feather name="chevron-right" size={18} color="#A3A3A3" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 10,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F5F5F5',
  },
  pressed: { opacity: 0.7 },
  rowLeft: { flex: 1, gap: 4 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowAmount: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, color: '#737373' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  methodBadgeCorrection: { backgroundColor: '#FEF2F2' },
  methodBadgeText: { fontSize: 11, fontWeight: '600', color: '#3730A3' },
  methodBadgeTextCorrection: { color: '#B91C1C' },
});
