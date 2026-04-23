// 009-order-assembly: review step + send / cancel. Uses the shared
// DiscountControl for the order-level discount and TotalsBreakdown for
// the four-row breakdown.

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrdersStackParamList } from '@/app/navigation/types';
import { clientsRepository } from '@/data/repositories/clientsRepository';

import { DiscountControl } from '../components/DiscountControl';
import { DroppedItemsNotice } from '../components/DroppedItemsNotice';
import { SendHint } from '../components/SendHint';
import { TotalsBreakdown } from '../components/TotalsBreakdown';
import { formatBRL } from '../formatting/formatBRL';
import { useDraftOrder } from '../hooks/useDraftOrder';
import { useOrderItems } from '../hooks/useOrderItems';
import { useOrderTotals } from '../hooks/useOrderTotals';
import { useViewport } from '../hooks/useViewport';
import { isLikelyEmail } from '../send/clientSlug';
import { useSendOrder } from '../send/useSendOrder';
import { ordersService } from '../services/ordersService';
import type { DiscountInput } from '../totals/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderSummary'>;

export function OrderSummaryScreen({ navigation, route }: Props) {
  const { orderId, droppedNames } = route.params;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const { order, isReady, error } = useDraftOrder({ orderId });
  const itemsWithCatalog = useOrderItems(order?.id ?? null);
  const lines = itemsWithCatalog.map(({ line }) => line);
  const totals = useOrderTotals(order, lines);

  const [sendError, setSendError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 011-order-email-delivery: pull the client's email so the SendHint and
  // the send button label can branch on it. One-shot fetch (email doesn't
  // change mid-session); a full observation would be overkill here.
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!order?.clientId) return;
    void clientsRepository
      .findById(order.clientId)
      .then((c) => {
        if (!cancelled) setClientEmail(c?.email ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [order?.clientId]);

  const { send: runSend } = useSendOrder();

  if (error !== null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Não foi possível carregar</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isReady || order === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando resumo…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const itemCount = lines.length;
  const canSend = itemCount > 0 && !submitting;

  const handleSend = async (): Promise<void> => {
    if (!canSend) return;
    setSubmitting(true);
    setSendError(null);
    try {
      const result = await runSend(orderId);
      if (result.kind === 'sent') {
        navigation.replace('OrderSent', {
          orderId,
          orderNumber: result.orderNumber,
          pdfPath: result.pdfPath,
          recipientEmail: result.recipientEmail,
          clientId: order.clientId,
        });
        return;
      }
      if (result.kind === 'cancelled') {
        // Salesperson dismissed the share sheet; draft stays intact.
        setSubmitting(false);
        return;
      }
      switch (result.reason) {
        case 'empty_draft':
          setSendError('O rascunho está vazio. Adicione pelo menos um item.');
          break;
        case 'not_draft':
          setSendError('Este pedido já foi enviado ou cancelado.');
          break;
        case 'not_found':
          setSendError('Pedido não encontrado.');
          break;
        case 'pdf_failed':
          setSendError('Não foi possível gerar o PDF. Tente novamente.');
          break;
        case 'intent_unavailable':
          setSendError('Este dispositivo não tem app de email ou compartilhamento configurado.');
          break;
      }
      setSubmitting(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleSave = (): void => {
    // The draft is already persistent. "Salvar" is a UX reassurance; just
    // dismiss back to Home.
    navigation.getParent()?.navigate('HomePlaceholder');
  };

  const handleOrderDiscountChange = (next: DiscountInput): void => {
    void ordersService
      .setOrderDiscount({ orderId, discount: next })
      .catch(() => undefined);
  };

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
          <Text style={styles.topTitle}>Revisar pedido</Text>
          <Text style={styles.topSubtitle}>
            Passo 2 de 2 · Rascunho salvo localmente
          </Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          isTablet && styles.bodyContentTablet,
        ]}
      >
        <DroppedItemsNotice names={droppedNames ?? []} />
        <View style={styles.itemsCard}>
          <View style={styles.itemsHeader}>
            <Text style={styles.itemsHeaderText}>{itemCount} itens</Text>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Text style={styles.itemsHeaderLink}>Editar</Text>
            </Pressable>
          </View>
          {itemsWithCatalog.map(({ line, variant, product }, idx) => {
            const perLine = totals.perLine.find((p) => p.lineId === line.id);
            if (!perLine) return null;
            return (
              <View
                key={line.id}
                style={[styles.itemRow, idx > 0 && styles.itemRowTopBorder]}
              >
                <Text style={styles.itemRowQty}>{line.quantity}×</Text>
                <View style={styles.itemRowNameCol}>
                  <Text style={styles.itemRowName}>
                    {product?.name ?? '—'} · {variant?.label ?? '—'}
                  </Text>
                  <Text
                    style={
                      line.discountAmount > 0
                        ? styles.itemRowSubDisc
                        : styles.itemRowSub
                    }
                  >
                    {formatBRL(line.unitPrice)} / un
                    {line.discountAmount > 0
                      ? ` · Desc. ${
                          line.discountMode === 'percent'
                            ? `${line.discountAmount}%`
                            : formatBRL(line.discountAmount)
                        }`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.itemRowTotal}>
                  {formatBRL(perLine.lineTotal)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.discountCard}>
          <View style={styles.discountHeader}>
            <Text style={styles.discountTitle}>Desconto do pedido (opcional)</Text>
          </View>
          <DiscountControl
            value={{ mode: order.discountMode, value: order.discountAmount }}
            onChange={handleOrderDiscountChange}
            amountMax={totals.postLineSubtotal}
            accessibilityLabel="Desconto do pedido"
          />
          <Text style={styles.discountHint}>
            % ajusta com +/− · R$ aceita valor digitado. Os preços de catálogo
            não são alterados.
          </Text>
        </View>

        <TotalsBreakdown totals={totals} />

        {sendError !== null ? (
          <Text style={styles.errorText}>⚠ {sendError}</Text>
        ) : null}

        <View style={styles.statusNote}>
          <Text style={styles.statusNoteText}>
            ℹ Status: draft → sent ao enviar
          </Text>
        </View>

        <SendHint recipientEmail={clientEmail} itemCount={itemCount} />
      </ScrollView>

      <View style={[styles.footer, isTablet && styles.footerTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar rascunho"
          onPress={handleSave}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.footerBtnSecondary,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.footerBtnSecondaryText}>Salvar rascunho</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar pedido"
          onPress={() => void handleSend()}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.footerBtnPrimary,
            !canSend && styles.disabled,
            pressed && canSend && styles.pressed,
          ]}
        >
          <Text style={styles.footerBtnPrimaryText}>
            {isLikelyEmail(clientEmail) ? 'Enviar por email' : 'Compartilhar PDF'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  topBarTablet: { height: 72, paddingHorizontal: 28 },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 22, color: '#0A0A0A' },
  topTitleWrap: { alignItems: 'center' },
  topTitle: { fontSize: 15, fontWeight: '700', color: '#0A0A0A' },
  topSubtitle: { fontSize: 11, color: '#737373' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 14, flexGrow: 1 },
  bodyContentTablet: { padding: 28, gap: 18 },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  itemsHeader: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F5F5F5',
  },
  itemsHeaderText: { fontSize: 13, fontWeight: '700', color: '#0A0A0A' },
  itemsHeaderLink: {
    fontSize: 11,
    fontWeight: '600',
    color: '#525252',
    textDecorationLine: 'underline',
  },
  itemRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemRowTopBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F5F5F5',
  },
  itemRowQty: { fontSize: 13, fontWeight: '700', color: '#525252' },
  itemRowNameCol: { flex: 1, gap: 2 },
  itemRowName: { fontSize: 12, fontWeight: '600', color: '#0A0A0A' },
  itemRowSub: { fontSize: 11, color: '#737373' },
  itemRowSubDisc: { fontSize: 11, color: '#047857' },
  itemRowTotal: { fontSize: 13, fontWeight: '700', color: '#0A0A0A' },
  discountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 14,
    gap: 10,
  },
  discountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountTitle: { fontSize: 13, fontWeight: '700', color: '#0A0A0A' },
  discountHint: { fontSize: 11, color: '#737373' },
  errorText: { color: '#B91C1C', fontSize: 12 },
  statusNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  statusNoteText: { fontSize: 11, color: '#737373' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  footerTablet: { paddingHorizontal: 28 },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  footerBtnSecondaryText: { color: '#0A0A0A', fontSize: 13, fontWeight: '600' },
  footerBtnPrimary: { backgroundColor: '#171717' },
  footerBtnPrimaryText: { color: '#FAFAFA', fontSize: 13, fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#737373' },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#0A0A0A' },
  errorBody: { fontSize: 12, color: '#525252', textAlign: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
