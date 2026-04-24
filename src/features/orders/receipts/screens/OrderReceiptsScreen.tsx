// 012-payment-receipts — US1/US2 MVP: list of receipts for an order +
// totals card + primary CTA. Entry point from ClientProfileScreen's
// sent-order row. Phase 4 (T040–T044) refines row rendering and
// correction-aware captions; this file deliberately ships the minimum
// that makes US1 testable in the field.

import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrdersStackParamList } from '@/app/navigation/types';

import { useViewport } from '../../hooks/useViewport';
import { openStoredPdf } from '../../send/openStoredPdf';
import { useOrderReceipts } from '../hooks/useOrderReceipts';
import { formatBRL, formatShortDatePt, methodLabel } from '../formatting';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderReceipts'>;

export function OrderReceiptsScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const { order, receipts, totals, loading } = useOrderReceipts(orderId);

  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleRegister = (): void => {
    navigation.navigate('PaymentReceiptForm', { orderId });
  };

  const handleReceiptPress = (receiptId: string): void => {
    navigation.navigate('PaymentReceiptDetail', { receiptId });
  };

  const handleViewPdf = (): void => {
    setPdfError(null);
    void openStoredPdf(orderId).catch((err: unknown) => {
      setPdfError(err instanceof Error ? err.message : String(err));
    });
  };

  const title = order?.orderNumber ?? 'Recebimentos';
  const subtitle = order?.orderNumber ? 'Recebimentos' : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Text style={styles.iconBtnText}>‹</Text>
        </Pressable>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle}>{title}</Text>
          {subtitle !== null ? <Text style={styles.topSubtitle}>{subtitle}</Text> : null}
        </View>
        {order?.status === 'sent' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver PDF do pedido"
            onPress={handleViewPdf}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Feather name="file-text" size={20} color="#0A0A0A" />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}
      >
        {pdfError !== null ? (
          <Text style={styles.errorText}>⚠ {pdfError}</Text>
        ) : null}

        <View style={styles.summaryCard}>
          <SummaryRow label="Total do pedido" value={totals.total} tone="neutral" />
          <SummaryRow label="Recebido" value={totals.received} tone="positive" />
          <SummaryRow
            label="Saldo em aberto"
            value={totals.outstanding}
            tone="warning"
          />
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(totals.progressRatio * 100)}%` },
              ]}
            />
          </View>
          {totals.hasOverpayment || totals.hasNegativeBalance ? (
            <View style={styles.adjustChip}>
              <Feather name="alert-circle" size={12} color="#B91C1C" />
              <Text style={styles.adjustChipText}>Ajuste pendente</Text>
            </View>
          ) : null}
        </View>

        {loading && receipts.length === 0 ? (
          <Text style={styles.loadingText}>Carregando recebimentos…</Text>
        ) : receipts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum recebimento ainda</Text>
            <Text style={styles.emptyBody}>
              Registre o primeiro pagamento abaixo.
            </Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {receipts.map((r, i) => {
              const isLast = i === receipts.length - 1;
              const isCorrection = r.correctionOfReceiptId !== null;
              const amountColor = isCorrection
                ? '#B91C1C'
                : r.amount < 0
                  ? '#B91C1C'
                  : '#0A0A0A';
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Recebimento ${formatBRL(r.amount)}`}
                  onPress={() => handleReceiptPress(r.id)}
                  style={({ pressed }) => [
                    styles.row,
                    !isLast && styles.rowDivider,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.rowTopLine}>
                      <Text style={[styles.rowAmount, { color: amountColor }]}>
                        {formatBRL(r.amount)}
                      </Text>
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
                          {isCorrection ? 'Correção' : methodLabel(r.method)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rowSub}>
                      {formatShortDatePt(r.receivedAtMs)}
                      {isCorrection ? ' · correção de recebimento anterior' : ''}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    {r.attachmentUrl !== null || r.attachmentLocalPath !== null ? (
                      <Feather name="paperclip" size={16} color="#737373" />
                    ) : null}
                    <Feather name="chevron-right" size={18} color="#A3A3A3" />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, isTablet && styles.footerTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Registrar recebimento"
          onPress={handleRegister}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.footerBtnPrimary,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="plus" size={16} color="#FAFAFA" />
          <Text style={styles.footerBtnPrimaryText}>Registrar recebimento</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'positive' | 'warning';
}) {
  const valueColor =
    tone === 'positive' ? '#166534' : tone === 'warning' ? '#B45309' : '#0A0A0A';
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>
        {value < 0 ? `− ${formatBRL(Math.abs(value))}` : formatBRL(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  topBarTablet: { height: 64, paddingHorizontal: 28 },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 24, color: '#0A0A0A' },
  pressed: { opacity: 0.7 },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 15, fontWeight: '600', color: '#0A0A0A' },
  topSubtitle: { fontSize: 11, color: '#737373', marginTop: 2 },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  bodyContentTablet: { padding: 28, gap: 16 },
  errorText: { color: '#B91C1C', fontSize: 13 },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 13, color: '#525252', fontWeight: '500' },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  progressTrack: {
    height: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#166534', borderRadius: 999 },
  adjustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
  },
  adjustChipText: { fontSize: 12, fontWeight: '600', color: '#B91C1C' },
  loadingText: { textAlign: 'center', color: '#737373', paddingVertical: 24 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#0A0A0A' },
  emptyBody: { fontSize: 12, color: '#737373', textAlign: 'center' },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    overflow: 'hidden',
  },
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
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 20,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  footerTablet: { padding: 28, paddingBottom: 28, justifyContent: 'center' },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerBtnPrimary: { backgroundColor: '#171717' },
  footerBtnPrimaryText: { color: '#FAFAFA', fontSize: 14, fontWeight: '600' },
});
