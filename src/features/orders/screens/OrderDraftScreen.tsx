// 009-order-assembly: the core US1 screen. Lists the draft's items,
// hosts per-line qty steppers, offers an inline per-line discount editor,
// and a footer with the running total + "Continuar" CTA to OrderSummary.
// Cancel is an inline two-step affordance (design decision — no modal).

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrdersStackParamList } from '@/app/navigation/types';

import { DiscountControl } from '../components/DiscountControl';
import { OrderHeaderChip } from '../components/OrderHeaderChip';
import { OrderLineCard } from '../components/OrderLineCard';
import { formatBRL } from '../formatting/formatBRL';
import { useDraftOrder } from '../hooks/useDraftOrder';
import { useOrderItems } from '../hooks/useOrderItems';
import { useOrderTotals } from '../hooks/useOrderTotals';
import { useViewport } from '../hooks/useViewport';
import { ordersService } from '../services/ordersService';
import type { DiscountInput } from '../totals/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderDraft'>;

const CANCEL_CONFIRM_WINDOW_MS = 3_000;

export function OrderDraftScreen({ navigation, route }: Props) {
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const params = route.params;
  const { order, isReady, error } = useDraftOrder(
    'orderId' in params && params.orderId !== undefined
      ? { orderId: params.orderId }
      : { clientId: params.clientId as string },
  );
  const itemsWithCatalog = useOrderItems(order?.id ?? null);
  const lines = itemsWithCatalog.map(({ line }) => line);
  const totals = useOrderTotals(order, lines);

  // Inline per-line discount editor state — which line is currently open.
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [cancelArmedAt, setCancelArmedAt] = useState<number | null>(null);
  const cancelArmed =
    cancelArmedAt !== null &&
    Date.now() - cancelArmedAt < CANCEL_CONFIRM_WINDOW_MS;

  if (error !== null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Não foi possível abrir o pedido</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.primaryBtnText}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!isReady || order === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando rascunho…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const itemCount = lines.length;
  const canContinue = itemCount > 0;

  const handleBack = (): void => navigation.goBack();
  const handleAddItem = (): void => {
    // Navigate to catalog in order-context. Catalog is in HomeStack
    // (one level up — getParent) and we pass inOrderId.
    const parent = navigation.getParent();
    if (parent !== undefined) {
      parent.navigate('Catalog', { inOrderId: order.id });
    }
  };
  const handleContinue = (): void => {
    if (!canContinue) return;
    navigation.navigate('OrderSummary', { orderId: order.id });
  };
  const handleCancelPress = (): void => {
    if (!cancelArmed) {
      setCancelArmedAt(Date.now());
      // Auto-disarm after the window.
      setTimeout(() => setCancelArmedAt(null), CANCEL_CONFIRM_WINDOW_MS);
      return;
    }
    void ordersService
      .cancel({ orderId: order.id })
      .then(() => navigation.getParent()?.navigate('HomePlaceholder'))
      .catch((err: unknown) => {
                  // 010-repeat-last-order debug: previously swallowed silently.
                   
                  console.warn('[OrderDraft] mutation failed:', err);
                });
  };

  const renderedTopBar = (
    <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
      <View style={styles.topLeft}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={handleBack}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Text style={styles.iconBtnText}>‹</Text>
        </Pressable>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle}>Novo pedido</Text>
          <Text style={styles.topSubtitle}>{itemCount} itens · Salvo agora</Text>
        </View>
      </View>
      <OrderHeaderChip />
    </View>
  );

  const addItemButton = (
    <Pressable
      onPress={handleAddItem}
      accessibilityRole="button"
      accessibilityLabel="Adicionar item do catálogo"
      style={({ pressed }) => [styles.addDashed, pressed && styles.pressed]}
    >
      <Text style={styles.addDashedText}>+ Adicionar item do catálogo</Text>
    </Pressable>
  );

  const renderedList = itemsWithCatalog.length === 0 ? (
    <View style={styles.list}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Rascunho vazio</Text>
        <Text style={styles.emptyBody}>
          Adicione itens do catálogo para começar.
        </Text>
      </View>
      {addItemButton}
    </View>
  ) : (
    <View style={styles.list}>
      {itemsWithCatalog.map(({ line, variant, product }) => {
        const perLine = totals.perLine.find((p) => p.lineId === line.id);
        if (!perLine) return null;
        const isEditing = editingLineId === line.id;
        return (
          <View key={line.id} style={styles.lineWrap}>
            <OrderLineCard
              line={line}
              variant={variant}
              product={product}
              totals={perLine}
              viewport={viewport}
              onQtyChange={(next) =>
                void ordersService
                  .updateLineQty({ orderItemId: line.id, quantity: next })
                  .catch((err: unknown) => {
                  // 010-repeat-last-order debug: previously swallowed silently.
                   
                  console.warn('[OrderDraft] mutation failed:', err);
                })
              }
              onRemove={() =>
                void ordersService
                  .removeLine({ orderItemId: line.id })
                  .catch((err: unknown) => {
                  // 010-repeat-last-order debug: previously swallowed silently.
                   
                  console.warn('[OrderDraft] mutation failed:', err);
                })
              }
              onEditDiscount={() =>
                setEditingLineId(isEditing ? null : line.id)
              }
            />
            {isEditing ? (
              <View style={styles.discountEditor}>
                <Text style={styles.discountEditorLabel}>
                  Desconto da linha
                </Text>
                <DiscountControl
                  value={{
                    mode: line.discountMode,
                    value: line.discountAmount,
                  }}
                  amountMax={line.quantity * line.unitPrice}
                  onChange={(next: DiscountInput) =>
                    void ordersService
                      .setLineDiscount({
                        orderItemId: line.id,
                        discount: next,
                      })
                      .catch((err: unknown) => {
                  // 010-repeat-last-order debug: previously swallowed silently.
                   
                  console.warn('[OrderDraft] mutation failed:', err);
                })
                  }
                />
                <View style={styles.discountEditorFooter}>
                  <Pressable
                    onPress={() =>
                      void ordersService
                        .setLineDiscount({
                          orderItemId: line.id,
                          discount: null,
                        })
                        .catch((err: unknown) => {
                  // 010-repeat-last-order debug: previously swallowed silently.
                   
                  console.warn('[OrderDraft] mutation failed:', err);
                })
                    }
                    style={({ pressed }) => [
                      styles.linkBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.linkBtnText}>Remover desconto</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditingLineId(null)}
                    style={({ pressed }) => [
                      styles.linkBtnPrimary,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.linkBtnPrimaryText}>Fechar</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      {addItemButton}
    </View>
  );

  const summaryCard = (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Resumo</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Subtotal</Text>
        <Text style={styles.summaryValue}>{formatBRL(totals.subtotal)}</Text>
      </View>
      {totals.lineDiscountsTotal > 0 ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, styles.summaryPositive]}>
            Descontos por item
          </Text>
          <Text style={[styles.summaryValue, styles.summaryPositive]}>
            −{formatBRL(totals.lineDiscountsTotal)}
          </Text>
        </View>
      ) : null}
      {totals.orderDiscount > 0 ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, styles.summaryPositive]}>
            Desconto do pedido
          </Text>
          <Text style={[styles.summaryValue, styles.summaryPositive]}>
            −{formatBRL(totals.orderDiscount)}
          </Text>
        </View>
      ) : null}
      <View style={[styles.summaryRow, styles.summaryTotalRow]}>
        <Text style={styles.summaryTotalLabel}>Total</Text>
        <Text style={styles.summaryTotalValue}>{formatBRL(totals.total)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continuar para revisão"
        onPress={handleContinue}
        disabled={!canContinue}
        style={({ pressed }) => [
          styles.summaryCTA,
          !canContinue && styles.disabled,
          pressed && canContinue && styles.pressed,
        ]}
      >
        <Text style={styles.summaryCTAText}>Continuar →</Text>
      </Pressable>
      <Text style={styles.summaryNote}>
        Preços do catálogo não são alterados.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {renderedTopBar}
      {isTablet ? (
        <View style={styles.splitBody}>
          <ScrollView
            style={styles.splitLeft}
            contentContainerStyle={styles.splitLeftContent}
          >
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Itens do pedido</Text>
              <Text style={styles.listHeaderCount}>
                {itemCount} {itemCount === 1 ? 'item' : 'itens'} · salvo localmente
              </Text>
            </View>
            {renderedList}
          </ScrollView>
          <View style={styles.splitRight}>{summaryCard}</View>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
        >
          {renderedList}
        </ScrollView>
      )}
      {isTablet ? null : (
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerLabel}>Total do rascunho</Text>
            <Text style={styles.footerTotal}>{formatBRL(totals.total)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuar para revisão"
            onPress={handleContinue}
            disabled={!canContinue}
            style={({ pressed }) => [
              styles.primaryBtn,
              !canContinue && styles.disabled,
              pressed && canContinue && styles.pressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>Continuar →</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.cancelRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            cancelArmed ? 'Confirmar cancelamento' : 'Cancelar rascunho'
          }
          onPress={handleCancelPress}
          style={({ pressed }) => [
            styles.cancelBtn,
            cancelArmed && styles.cancelBtnArmed,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.cancelBtnText,
              cancelArmed && styles.cancelBtnTextArmed,
            ]}
          >
            {cancelArmed ? 'Confirmar cancelamento' : 'Cancelar rascunho'}
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
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 22, color: '#0A0A0A' },
  topTitleWrap: { gap: 2 },
  topTitle: { fontSize: 15, fontWeight: '700', color: '#0A0A0A' },
  topSubtitle: { fontSize: 11, color: '#737373' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 10, flexGrow: 1 },
  splitBody: { flex: 1, flexDirection: 'row' },
  splitLeft: { flex: 1 },
  splitLeftContent: { padding: 28, paddingBottom: 40, gap: 14 },
  splitRight: {
    width: 340,
    padding: 28,
    paddingLeft: 0,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  listHeaderTitle: { fontSize: 14, fontWeight: '700', color: '#0A0A0A' },
  listHeaderCount: { fontSize: 11, color: '#737373' },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 14,
    padding: 20,
    gap: 10,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0A0A',
    marginBottom: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: { fontSize: 13, color: '#525252' },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  summaryPositive: { color: '#047857' },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 10,
    marginTop: 4,
  },
  summaryTotalLabel: { fontSize: 15, fontWeight: '700', color: '#0A0A0A' },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  summaryCTA: {
    backgroundColor: '#171717',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  summaryCTAText: { color: '#FAFAFA', fontSize: 14, fontWeight: '600' },
  summaryNote: {
    fontSize: 11,
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 2,
  },
  list: { gap: 10 },
  lineWrap: { gap: 10 },
  addDashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D4D4D8',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  addDashedText: { color: '#525252', fontSize: 13, fontWeight: '600' },
  emptyState: { padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0A0A0A' },
  emptyBody: { fontSize: 13, color: '#525252', textAlign: 'center' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: { gap: 2 },
  footerLabel: { color: '#737373', fontSize: 11 },
  footerTotal: { color: '#0A0A0A', fontSize: 22, fontWeight: '700' },
  primaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#171717',
    borderRadius: 10,
  },
  primaryBtnText: { color: '#FAFAFA', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  discountEditor: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 14,
    gap: 10,
  },
  discountEditorLabel: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '600',
  },
  discountEditorFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  linkBtnText: { color: '#525252', fontSize: 12, fontWeight: '600' },
  linkBtnPrimary: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#E4E4E7',
    borderRadius: 8,
  },
  linkBtnPrimaryText: { color: '#0A0A0A', fontSize: 12, fontWeight: '600' },
  cancelRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelBtnText: { color: '#A3A3A3', fontSize: 12, fontWeight: '600' },
  cancelBtnArmed: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  cancelBtnTextArmed: { color: '#B91C1C' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#737373' },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#0A0A0A' },
  errorBody: { fontSize: 12, color: '#525252', textAlign: 'center' },
});

