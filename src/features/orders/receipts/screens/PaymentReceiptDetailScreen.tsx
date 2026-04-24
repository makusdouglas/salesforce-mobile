// 012-payment-receipts US3 — read-only receipt detail. Amount + method +
// metadata + notes + Registrar correção CTA. Attachment preview block is
// intentionally stubbed until Phase 6 (T052) — the receipt's attachment
// state badge already renders here so Phase 6 only has to drop in the
// <Image>/viewer.
//
// FR-006 locks: no `editar` / `excluir` affordances anywhere on this
// screen — the only write path from here is the correction CTA, which
// leads to the form with `correctionOf` pre-wired.

import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrdersStackParamList } from '@/app/navigation/types';

import { useViewport } from '../../hooks/useViewport';
import { AttachmentPreview } from '../components/AttachmentPreview';
import { useOrderReceipts } from '../hooks/useOrderReceipts';
import { useReceipt } from '../hooks/useReceipt';
import { formatBRL, formatShortDatePt, methodLabel } from '../formatting';

type Props = NativeStackScreenProps<OrdersStackParamList, 'PaymentReceiptDetail'>;

export function PaymentReceiptDetailScreen({ navigation, route }: Props) {
  const { receiptId } = route.params;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const { receipt, loading } = useReceipt(receiptId);
  // For the "Correção de #…" caption we need the original receipt, which
  // lives in the same order. Observe by order and look up in-memory.
  const { receipts: orderReceipts, order } = useOrderReceipts(
    receipt?.orderId ?? '',
  );
  const original =
    receipt?.correctionOfReceiptId !== undefined &&
    receipt?.correctionOfReceiptId !== null
      ? orderReceipts.find((x) => x.id === receipt.correctionOfReceiptId) ?? null
      : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando recebimento…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (receipt === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Recebimento não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCorrection = receipt.correctionOfReceiptId !== null;
  const signedAmount =
    receipt.amount < 0 ? `− ${formatBRL(Math.abs(receipt.amount))}` : formatBRL(receipt.amount);

  const handleCorrect = (): void => {
    navigation.navigate('PaymentReceiptForm', {
      orderId: receipt.orderId,
      correctionOf: receipt.id,
    });
  };

  // Sync-state badge derivation.
  let syncBadge: { label: string; icon: 'cloud-off' | 'upload-cloud' | 'alert-triangle'; fg: string; bg: string } | null = null;
  if (receipt.attachmentUploadState === 'pending') {
    syncBadge = {
      label: 'Aguardando sync',
      icon: 'upload-cloud',
      fg: '#7C2D12',
      bg: '#FFF7ED',
    };
  } else if (receipt.attachmentUploadState === 'synced') {
    syncBadge = {
      label: 'Sincronizado',
      icon: 'cloud-off',
      fg: '#166534',
      bg: '#DCFCE7',
    };
  } else if (receipt.attachmentUploadState === 'failed') {
    syncBadge = {
      label: 'Falha ao enviar',
      icon: 'alert-triangle',
      fg: '#B91C1C',
      bg: '#FEF2F2',
    };
  }

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
          <Text style={styles.topTitle}>Recebimento</Text>
          {order?.orderNumber !== null && order?.orderNumber !== undefined ? (
            <Text style={styles.topSubtitle}>{order.orderNumber}</Text>
          ) : null}
        </View>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}
      >
        {/* Amount + method badge */}
        <View style={styles.amountCard}>
          <Text style={[styles.amountBig, isCorrection && styles.amountCorrection]}>
            {signedAmount}
          </Text>
          <View
            style={[styles.methodBadge, isCorrection && styles.methodBadgeCorrection]}
          >
            <Text
              style={[
                styles.methodBadgeText,
                isCorrection && styles.methodBadgeTextCorrection,
              ]}
            >
              {isCorrection ? 'Correção' : methodLabel(receipt.method)}
            </Text>
          </View>
        </View>

        {/* Metadata card */}
        <View style={styles.card}>
          <MetaRow label="Data" value={formatShortDatePt(receipt.receivedAtMs)} />
          {isCorrection && original !== null ? (
            <MetaRow
              label="Corrige"
              value={`${formatBRL(original.amount)} · ${methodLabel(original.method)} · ${formatShortDatePt(original.receivedAtMs)}`}
            />
          ) : null}
          {isCorrection && original === null ? (
            <MetaRow label="Corrige" value="recebimento não sincronizado" />
          ) : null}
          {order?.orderNumber !== null && order?.orderNumber !== undefined ? (
            <MetaRow label="Pedido" value={order.orderNumber} />
          ) : null}
          {syncBadge !== null ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Comprovante</Text>
              <View style={[styles.syncBadge, { backgroundColor: syncBadge.bg }]}>
                <Feather name={syncBadge.icon} size={12} color={syncBadge.fg} />
                <Text style={[styles.syncBadgeText, { color: syncBadge.fg }]}>
                  {syncBadge.label}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Notes */}
        {receipt.notes !== null && receipt.notes.trim() !== '' ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Observações</Text>
            <Text style={styles.notesText}>{receipt.notes}</Text>
          </View>
        ) : null}

        {/* Attachment preview — live from Phase 6 */}
        {receipt.attachmentLocalPath !== null || receipt.attachmentUrl !== null ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Comprovante</Text>
            <AttachmentPreview receipt={receipt} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, isTablet && styles.footerTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Registrar correção"
          onPress={handleCorrect}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.footerBtnOutline,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="rotate-ccw" size={16} color="#B91C1C" />
          <Text style={styles.footerBtnOutlineText}>Registrar correção</Text>
        </Pressable>
        <Text style={styles.appendOnlyHint}>
          <Feather name="info" size={12} color="#737373" /> Recebimentos são imutáveis.
          Correções criam um novo registro.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#737373', fontSize: 14 },
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
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 24, color: '#0A0A0A' },
  pressed: { opacity: 0.7 },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 15, fontWeight: '600', color: '#0A0A0A' },
  topSubtitle: { fontSize: 11, color: '#737373', marginTop: 2 },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  bodyContentTablet: { padding: 28, gap: 16 },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  amountBig: { fontSize: 32, fontWeight: '700', color: '#0A0A0A' },
  amountCorrection: { color: '#B91C1C' },
  methodBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  methodBadgeCorrection: { backgroundColor: '#FEF2F2' },
  methodBadgeText: { fontSize: 12, fontWeight: '600', color: '#3730A3' },
  methodBadgeTextCorrection: { color: '#B91C1C' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  cardLabel: { fontSize: 12, fontWeight: '500', color: '#525252' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  metaLabel: { fontSize: 13, color: '#737373', fontWeight: '500' },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0A0A0A',
    flex: 1,
    textAlign: 'right',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  syncBadgeText: { fontSize: 12, fontWeight: '600' },
  notesText: { fontSize: 13, color: '#404040', lineHeight: 18 },
  attachmentStub: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 32,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  attachmentStubText: { fontSize: 11, color: '#737373', textAlign: 'center' },
  footer: {
    padding: 16,
    paddingBottom: 20,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  footerTablet: { padding: 28, paddingBottom: 28 },
  footerBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  footerBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  footerBtnOutlineText: { color: '#B91C1C', fontSize: 14, fontWeight: '600' },
  appendOnlyHint: {
    fontSize: 11,
    color: '#737373',
    textAlign: 'center',
    marginTop: 4,
  },
});
