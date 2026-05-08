import { Feather } from '@expo/vector-icons';
import type {
  CompositeScreenProps,
  RouteProp,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  HomeStackParamList,
  OrdersStackParamList,
} from '@/app/navigation/types';

import { useViewport } from '../../hooks/useViewport';
import { useOrderItems } from '../../hooks/useOrderItems';
import type {
  OrderPaymentStatus,
  OrderStatus,
} from '../../payment/derivePaymentStatus';
import { openStoredPdf } from '../../send/openStoredPdf';
import { useOrderDetail, type OrderDetailDTO } from '../hooks/useOrderDetail';

type StackProps = NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'>;
type ComposedProps = CompositeScreenProps<
  StackProps,
  NativeStackScreenProps<HomeStackParamList>
>;

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const STATUS_META: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Rascunho', bg: '#F4F4F5', fg: '#3F3F46' },
  sent: { label: 'Enviado', bg: '#ECFDF5', fg: '#047857' },
  canceled: { label: 'Cancelado', bg: '#FEE2E2', fg: '#B91C1C' },
};

const PAYMENT_META: Record<OrderPaymentStatus, { label: string; bg: string; fg: string }> = {
  paid: { label: 'Pago', bg: '#DCFCE7', fg: '#15803D' },
  partial: { label: 'Parcial', bg: '#FEF9C3', fg: '#A16207' },
  pending: { label: 'Pendente', bg: '#FFEDD5', fg: '#C2410C' },
  adjust: { label: 'Ajuste', bg: '#FEE2E2', fg: '#B91C1C' },
};

const METHOD_LABELS = {
  cash: 'Dinheiro',
  pix: 'Pix',
  transfer: 'Transferência',
  check: 'Cheque',
  other: 'Outro',
} as const;

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
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()] ?? ''}`;
}

function methodLabel(method: string): string {
  if ((METHOD_LABELS as Record<string, string>)[method]) {
    return (METHOD_LABELS as Record<string, string>)[method] ?? method;
  }
  return method;
}

export function OrderDetailScreen({ navigation, route }: ComposedProps) {
  const viewport = useViewport();
  const { orderId, deepLinked } = route.params;
  const { detail } = useOrderDetail(orderId);
  const isTablet = viewport === 'tablet' && deepLinked === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar onBack={() => navigation.goBack()} detail={detail} />
      {detail ? (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <DetailBody detail={detail} wide={isTablet} />
        </ScrollView>
      ) : (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando…</Text>
        </View>
      )}
      {detail ? (
        <FooterBar
          detail={detail}
          onViewPdf={() => {
            void openStoredPdf(detail.header.id).catch((err) => {
               
              console.warn('[order-detail] openStoredPdf failed', err);
            });
          }}
          onRegisterReceipt={() =>
            navigation.navigate('Orders', {
              screen: 'PaymentReceiptForm',
              params: { orderId: detail.header.id },
            })
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * Embedded variant used by the tablet split panel of OrdersOverview.
 * Renders a compact header (title + status chips + primary actions) and
 * then the shared DetailBody. No screen chrome — the parent screen
 * provides the top bar.
 */
export function OrderDetailEmbedded({
  orderId,
}: {
  readonly orderId: string;
}) {
  const navigation = useNavigation<ComposedProps['navigation']>();
  const { detail } = useOrderDetail(orderId);
  if (!detail) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Carregando…</Text>
      </View>
    );
  }

  const statusMeta = STATUS_META[detail.header.status];
  const paymentMeta =
    detail.header.paymentStatus !== null
      ? PAYMENT_META[detail.header.paymentStatus]
      : null;
  const canCollect = detail.header.status === 'sent';
  // `openStoredPdf` regenerates from the persisted order_number when the
  // file is missing (FR-017 of feature 011), so the button is enabled
  // for any sent order regardless of whether the PDF materialized yet.
  // Drafts can't have a PDF — hide it there.
  const canViewPdf = detail.header.status !== 'draft';

  return (
    <ScrollView contentContainerStyle={styles.embeddedContent}>
      <View style={styles.embeddedHead}>
        <Text style={styles.embeddedTitle}>{detail.header.shortId}</Text>
        <View style={styles.embeddedChips}>
          <View style={[styles.topChip, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.topChipText, { color: statusMeta.fg }]}>
              {`${statusMeta.label}${
                detail.header.effectiveTimestampMs > 0
                  ? ` · ${formatShortDate(detail.header.effectiveTimestampMs)}`
                  : ''
              }`}
            </Text>
          </View>
          {paymentMeta ? (
            <View style={[styles.topChip, { backgroundColor: paymentMeta.bg }]}>
              <Text style={[styles.topChipText, { color: paymentMeta.fg }]}>
                {paymentMeta.label}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.embeddedActions}>
          {canViewPdf ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver PDF"
              onPress={() => {
                void openStoredPdf(detail.header.id).catch((err) => {
                   
                  console.warn('[order-detail] openStoredPdf failed', err);
                });
              }}
              style={({ pressed }) => [
                styles.embeddedBtn,
                styles.embeddedBtnSecondary,
                pressed && styles.embeddedBtnPressed,
              ]}
            >
              <Feather name="file-text" size={14} color="#0A0A0A" />
              <Text style={[styles.embeddedBtnLabel, { color: '#0A0A0A' }]}>
                Ver PDF
              </Text>
            </Pressable>
          ) : null}
          {canCollect ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('Orders', {
                  screen: 'PaymentReceiptForm',
                  params: { orderId: detail.header.id },
                })
              }
              style={({ pressed }) => [
                styles.embeddedBtn,
                styles.embeddedBtnPrimary,
                pressed && styles.embeddedBtnPressed,
              ]}
            >
              <Feather name="credit-card" size={14} color="#FAFAFA" />
              <Text style={[styles.embeddedBtnLabel, { color: '#FAFAFA' }]}>
                Lançar recebimento
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <DetailBody detail={detail} wide />
    </ScrollView>
  );
}

function TopBar({
  onBack,
  detail,
}: {
  readonly onBack: () => void;
  readonly detail: OrderDetailDTO | null;
}) {
  const statusMeta =
    detail ? STATUS_META[detail.header.status] : STATUS_META.draft;
  const paymentMeta =
    detail && detail.header.paymentStatus !== null
      ? PAYMENT_META[detail.header.paymentStatus]
      : null;
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        hitSlop={12}
        style={styles.topIcon}
      >
        <Feather name="arrow-left" size={22} color="#0A0A0A" />
      </Pressable>
      <View style={styles.topMid}>
        <Text style={styles.topTitle}>
          {detail ? detail.header.shortId : 'Pedido'}
        </Text>
        <View style={styles.topChips}>
          <View style={[styles.topChip, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.topChipText, { color: statusMeta.fg }]}>
              {statusMeta.label}
              {detail && detail.header.effectiveTimestampMs > 0
                ? ` · ${formatShortDate(detail.header.effectiveTimestampMs)}`
                : ''}
            </Text>
          </View>
          {paymentMeta ? (
            <View style={[styles.topChip, { backgroundColor: paymentMeta.bg }]}>
              <Text style={[styles.topChipText, { color: paymentMeta.fg }]}>
                {paymentMeta.label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.topIcon} />
    </View>
  );
}

function DetailBody({
  detail,
  wide,
}: {
  readonly detail: OrderDetailDTO;
  readonly wide: boolean;
}) {
  // Resolve product descriptions via the existing catalog-joined hook so
  // we stay consistent with OrderSummary.
  const itemsWithCatalog = useOrderItems(detail.header.id);
  const nameByLineId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of itemsWithCatalog) {
      const label = `${entry.product?.name ?? '—'} · ${entry.variant?.label ?? '—'}`;
      map.set(entry.line.id, label);
    }
    return map;
  }, [itemsWithCatalog]);

  return (
    <View style={[styles.body, wide ? styles.bodyWide : styles.bodyPhone]}>
      {detail.client ? (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>{detail.client.name}</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            {[detail.client.addressLine, detail.client.phone]
              .filter(Boolean)
              .join(' · ') || 'Sem endereço cadastrado'}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={[styles.cardRow, styles.cardHead]}>
          <Text style={styles.cardTitle}>
            {`${detail.items.length} ${detail.items.length === 1 ? 'item' : 'itens'}`}
          </Text>
          <Text style={styles.readOnly}>Somente leitura</Text>
        </View>
        {detail.items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemLabel} numberOfLines={1}>
                {nameByLineId.get(it.id) ?? '—'}
              </Text>
              <Text style={styles.itemMeta}>
                {`${it.quantity} × ${currency.format(it.unitPrice)}`}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{currency.format(it.lineTotal)}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, styles.totalsCard]}>
        <TotalsLine label="Subtotal" value={detail.totals.subtotal} />
        {detail.totals.itemDiscounts > 0 ? (
          <TotalsLine
            label="Descontos por item"
            value={-detail.totals.itemDiscounts}
            tone="positive"
          />
        ) : null}
        {detail.totals.orderDiscount > 0 ? (
          <TotalsLine
            label="Desconto do pedido"
            value={-detail.totals.orderDiscount}
            tone="positive"
          />
        ) : null}
        <View style={styles.totalFinalRow}>
          <Text style={styles.totalFinalLabel}>Total</Text>
          <Text style={styles.totalFinalValue}>
            {currency.format(detail.totals.total)}
          </Text>
        </View>
      </View>

      <ReceiptsCard detail={detail} />
    </View>
  );
}

function TotalsLine({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly tone?: 'positive';
}) {
  const color = tone === 'positive' ? '#047857' : '#0A0A0A';
  const sign = value < 0 ? '−' : '';
  const formatted = currency.format(Math.abs(value));
  return (
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsLabel, tone === 'positive' && { color }]}>
        {label}
      </Text>
      <Text style={[styles.totalsValue, { color }]}>{`${sign}${formatted}`}</Text>
    </View>
  );
}

function ReceiptsCard({ detail }: { readonly detail: OrderDetailDTO }) {
  const navigation = useNavigation<ComposedProps['navigation']>();
  const paymentMeta =
    detail.header.paymentStatus !== null
      ? PAYMENT_META[detail.header.paymentStatus]
      : null;

  if (detail.receipts.length === 0) {
    return (
      <View style={styles.card}>
        <View style={[styles.cardRow, styles.cardHead]}>
          <Text style={styles.cardTitle}>Recebimentos</Text>
          {paymentMeta ? (
            <View style={[styles.pill, { backgroundColor: paymentMeta.bg }]}>
              <Text style={[styles.pillText, { color: paymentMeta.fg }]}>
                {paymentMeta.label}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.emptyReceipts}>
          <Text style={styles.emptyReceiptsText}>Nenhum recibo lançado.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          navigation.navigate('Orders', {
            screen: 'OrderReceipts',
            params: { orderId: detail.header.id },
          })
        }
        style={({ pressed }) => [styles.cardHead, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Recebimentos</Text>
            <Text style={styles.cardSubtitle}>
              {`${detail.receipts.length} ${
                detail.receipts.length === 1 ? 'recibo' : 'recibos'
              } · ${currency.format(detail.header.received)}`}
            </Text>
          </View>
          {paymentMeta ? (
            <View style={[styles.pill, { backgroundColor: paymentMeta.bg }]}>
              <Text style={[styles.pillText, { color: paymentMeta.fg }]}>
                {paymentMeta.label}
              </Text>
            </View>
          ) : null}
          <Feather name="chevron-right" size={18} color="#71717A" />
        </View>
      </Pressable>
      {detail.receipts.slice(0, 3).map((r) => (
        <View key={r.id} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemLabel}>
              {`${methodLabel(r.method)} · ${formatShortDate(r.receivedAtMs)}${
                r.correctionOfReceiptId ? ' · correção' : ''
              }`}
            </Text>
            <Text style={styles.itemMeta}>
              {r.attachmentLocalPath || r.attachmentUrl
                ? 'Comprovante anexado'
                : 'Sem comprovante'}
            </Text>
          </View>
          <Text style={styles.itemTotal}>{currency.format(r.amount)}</Text>
        </View>
      ))}
      {detail.receipts.length > 3 ? (
        <View style={styles.moreRow}>
          <Text style={styles.moreLabel}>Ver todos</Text>
        </View>
      ) : null}
    </View>
  );
}

function FooterBar({
  detail,
  onViewPdf,
  onRegisterReceipt,
}: {
  readonly detail: OrderDetailDTO;
  readonly onViewPdf: () => void;
  readonly onRegisterReceipt: () => void;
}) {
  const canCollect = detail.header.status === 'sent';
  // `openStoredPdf` regenerates when the file is missing (FR-017 of 011),
  // so the button is enabled for any sent/canceled order. Hide on draft.
  const canViewPdf = detail.header.status !== 'draft';
  return (
    <View style={styles.footer}>
      {canViewPdf ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver PDF"
          onPress={onViewPdf}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.footerBtnSecondary,
            pressed && styles.footerBtnPressed,
          ]}
        >
          <Feather name="file-text" size={15} color="#0A0A0A" />
          <Text style={[styles.footerLabel, { color: '#0A0A0A' }]}>
            Ver PDF
          </Text>
        </Pressable>
      ) : null}
      {canCollect ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRegisterReceipt}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.footerBtnPrimary,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name="credit-card" size={15} color="#FAFAFA" />
          <Text style={[styles.footerLabel, { color: '#FAFAFA' }]}>
            Lançar recebimento
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Expose the embedded variant for the tablet split panel. */
export const _OrderDetailEmbeddedShim = OrderDetailEmbedded;

// Keep the route type exported for any downstream consumer that wants
// to write fully-typed navigate() calls.
export type OrderDetailRouteProp = RouteProp<OrdersStackParamList, 'OrderDetail'>;
export type OrderDetailScreenProps = ComposedProps;

// Make sure the hook import isn't dead-stripped.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ensureRouteHookReference = useRoute;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E4E4E7',
    borderBottomWidth: 1,
  },
  topIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topMid: { flex: 1, alignItems: 'center', gap: 4 },
  topTitle: { fontSize: 16, fontWeight: '700', color: '#0A0A0A' },
  topChips: { flexDirection: 'row', gap: 6 },
  topChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  topChipText: { fontSize: 11, fontWeight: '600' },
  body: { flex: 1 },
  bodyPhone: { padding: 16, gap: 14 },
  bodyWide: { padding: 24, gap: 16 },
  bodyContent: { paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 14,
    gap: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHead: { paddingBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0A0A0A' },
  cardSubtitle: { fontSize: 12, color: '#737373' },
  readOnly: { fontSize: 11, color: '#A1A1AA', fontWeight: '500' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
  },
  itemLabel: { fontSize: 13, fontWeight: '600', color: '#0A0A0A' },
  itemMeta: { fontSize: 11, color: '#737373', marginTop: 2 },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  totalsCard: {
    backgroundColor: '#F5F5F5',
    borderWidth: 0,
    gap: 6,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalsLabel: { fontSize: 12, color: '#525252' },
  totalsValue: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  totalFinalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  totalFinalLabel: { fontSize: 14, fontWeight: '700', color: '#0A0A0A' },
  totalFinalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '600' },
  emptyReceipts: {
    paddingVertical: 8,
  },
  emptyReceiptsText: { fontSize: 12, color: '#A1A1AA' },
  moreRow: { paddingTop: 6, alignItems: 'flex-end' },
  moreLabel: { fontSize: 12, fontWeight: '600', color: '#525252' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E4E4E7',
    borderTopWidth: 1,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    height: 48,
  },
  footerBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
  },
  footerBtnPrimary: { backgroundColor: '#171717' },
  footerBtnPressed: { opacity: 0.85 },
  footerBtnDisabled: { opacity: 0.5 },
  footerLabel: { fontSize: 13, fontWeight: '600' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { fontSize: 14, color: '#71717A' },
  embeddedContent: { paddingBottom: 40 },
  embeddedHead: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 10,
  },
  embeddedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  embeddedChips: {
    flexDirection: 'row',
    gap: 8,
  },
  embeddedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 4,
  },
  embeddedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  embeddedBtnPrimary: { backgroundColor: '#171717' },
  embeddedBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
  },
  embeddedBtnDisabled: { opacity: 0.5 },
  embeddedBtnPressed: { opacity: 0.85 },
  embeddedBtnLabel: { fontSize: 13, fontWeight: '600' },
});
