// 009-order-assembly: modal sheet that adds one product variant to the
// current draft. Entered from the catalog when it carries `inOrderId`.

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrdersStackParamList } from '@/app/navigation/types';

import type Product from '@/data/models/Product';
import type ProductVariant from '@/data/models/ProductVariant';
import { productsRepository } from '@/data/repositories/productsRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';

import { DiscountControl } from '../components/DiscountControl';
import { QtyStepper } from '../components/QtyStepper';
import { formatBRL } from '../formatting/formatBRL';
import { useViewport } from '../hooks/useViewport';
import { ordersService } from '../services/ordersService';
import { computeOrderTotals } from '../totals/computeOrderTotals';
import type { DiscountInput } from '../totals/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'AddToOrder'>;

export function AddToOrderScreen({ navigation, route }: Props) {
  const { orderId, productId } = route.params;
  const initialVariantId = route.params.variantId ?? null;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    initialVariantId,
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [discount, setDiscount] = useState<DiscountInput>({
    mode: 'amount',
    value: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load product + variants on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await productsRepository.findById(productId);
      if (cancelled) return;
      setProduct(p);
      if (p !== null) {
        const sub = productVariantsRepository.observeByProduct(productId).subscribe({
          next: (vs) => {
            if (cancelled) return;
            setVariants(vs);
            if (selectedVariantId === null && vs.length > 0 && vs[0]) {
              setSelectedVariantId(vs[0].id);
            }
          },
        });
        return () => sub.unsubscribe();
      }
      return undefined;
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, selectedVariantId]);

  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) ?? null;

  // 016-product-lifecycle-roles — block additions when the product was
  // deactivated by an admin (FR-009). The catalog already filters these
  // out, but the seller can reach this screen via a deep link, a cached
  // "Repeat last order" path, or a mid-navigation sync pull.
  const productInactive = product !== null && product.active === false;

  const preview = useMemo(() => {
    if (selectedVariant === null) {
      return { subtotal: 0, lineTotal: 0, discountAmount: 0 };
    }
    const totals = computeOrderTotals(
      { discount: { mode: 'amount', value: 0 } },
      [
        {
          id: 'preview',
          quantity,
          unitPrice: selectedVariant.price,
          discount,
        },
      ],
    );
    const first = totals.perLine[0];
    return {
      subtotal: first?.lineSubtotal ?? 0,
      lineTotal: first?.lineTotal ?? 0,
      discountAmount: first?.lineDiscountAmount ?? 0,
    };
  }, [selectedVariant, quantity, discount]);

  const canAdd =
    selectedVariant !== null && quantity >= 1 && !submitting && !productInactive;

  const handleAdd = async (): Promise<void> => {
    if (!canAdd || selectedVariant === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const { orderItemId } = await ordersService.addItem({
        orderId,
        productVariantId: selectedVariant.id,
        quantity,
      });
      if (discount.value > 0) {
        await ordersService.setLineDiscount({ orderItemId, discount });
      }
      // Return to the catalog list (skipping ProductDetail) so the user can
      // keep browsing/adding. `navigate('Catalog', ...)` on the parent stack
      // pops both AddToOrder and ProductDetail back to the existing Catalog
      // screen, preserving the inOrderId context.
      const parent = navigation.getParent();
      if (parent) {
        parent.navigate('Catalog', { inOrderId: orderId });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const productCard = (
    <View style={styles.productCard}>
      <View style={styles.productImageSlot}>
        <Text style={styles.productImagePlaceholder}>▢</Text>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product?.name ?? 'Produto'}</Text>
        {product?.description ? (
          <Text style={styles.productMeta}>{product.description}</Text>
        ) : product?.category ? (
          <Text style={styles.productMeta}>{product.category}</Text>
        ) : null}
        {selectedVariant !== null ? (
          <Text style={styles.productPrice}>
            {formatBRL(selectedVariant.price)}
            <Text style={styles.productPriceUnit}> / unidade</Text>
          </Text>
        ) : (
          <Text style={styles.productPrice}>—</Text>
        )}
      </View>
      {variants.length > 0 ? (
        <View style={styles.productVariants}>
          <Text style={styles.sectionLabel}>Variante</Text>
          <View style={styles.chipRow}>
            {variants.map((v) => {
              const active = v.id === selectedVariantId;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setSelectedVariantId(v.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.chip,
                    active ? styles.chipActive : styles.chipIdle,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={active ? styles.chipTextActive : styles.chipText}
                  >
                    {v.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );

  const controlsCard = (
    <View style={styles.controlsCard}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Quantidade</Text>
          <Text style={styles.sectionHint}>Toque +/− ou toque no número</Text>
        </View>
        <View style={styles.qtyRow}>
          <QtyStepper
            value={quantity}
            onChange={setQuantity}
            size="lg"
            min={1}
            showUnit
            unitLabel="unidades"
            accessibilityLabel="Quantidade"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Desconto por item (opcional)</Text>
        <DiscountControl
          value={discount}
          onChange={setDiscount}
          amountMax={preview.subtotal}
          accessibilityLabel="Desconto por item"
        />
      </View>

      <View style={styles.previewCard}>
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>
            Subtotal ({quantity} ×{' '}
            {selectedVariant !== null ? formatBRL(selectedVariant.price) : '—'}
            )
          </Text>
          <Text style={styles.previewValue}>{formatBRL(preview.subtotal)}</Text>
        </View>
        {preview.discountAmount > 0 ? (
          <View style={styles.previewRow}>
            <Text style={styles.previewLabelDisc}>
              Desconto
              {discount.mode === 'percent' && discount.value > 0
                ? ` (${discount.value}%)`
                : ''}
            </Text>
            <Text style={styles.previewValueDisc}>
              −{formatBRL(preview.discountAmount)}
            </Text>
          </View>
        ) : null}
        <View style={[styles.previewRow, styles.previewTotalRow]}>
          <Text style={styles.previewTotalLabel}>Total da linha</Text>
          <Text style={styles.previewTotalValue}>
            {formatBRL(preview.lineTotal)}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adicionar ao pedido"
        disabled={!canAdd}
        onPress={() => void handleAdd()}
        style={({ pressed }) => [
          styles.primaryBtn,
          !canAdd && styles.disabled,
          pressed && canAdd && styles.pressed,
        ]}
      >
        <Text style={styles.primaryBtnText}>🛒  Adicionar ao pedido</Text>
      </Pressable>

      <Text style={styles.footNote}>
        % ajusta com +/− · R$ aceita valor digitado. Preço de catálogo não é
        alterado.
      </Text>

      {error !== null ? <Text style={styles.errorText}>⚠ {error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Text style={styles.iconBtnText}>⌄</Text>
        </Pressable>
        <Text style={styles.topTitle}>Adicionar ao pedido</Text>
        {isTablet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Text style={styles.iconBtnText}>×</Text>
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {productInactive ? (
        <View style={styles.inactiveBanner}>
          <Text style={styles.inactiveBannerTitle}>Produto descontinuado</Text>
          <Text style={styles.inactiveBannerBody}>
            {product?.name ?? 'Este produto'} foi desativado pelo admin e não
            pode ser adicionado a novos pedidos.
          </Text>
        </View>
      ) : null}

      {isTablet ? (
        <View style={styles.splitBody}>
          <ScrollView
            style={styles.splitLeft}
            contentContainerStyle={styles.splitPaneContent}
          >
            {productCard}
          </ScrollView>
          <ScrollView
            style={styles.splitRight}
            contentContainerStyle={styles.splitPaneContent}
          >
            {controlsCard}
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.hero}>
            <Text style={styles.heroName}>{product?.name ?? 'Produto'}</Text>
            {selectedVariant !== null ? (
              <Text style={styles.heroPrice}>
                {formatBRL(selectedVariant.price)} / un
              </Text>
            ) : (
              <Text style={styles.heroPrice}>—</Text>
            )}
          </View>

          {variants.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Variante</Text>
              <View style={styles.chipRow}>
                {variants.map((v) => {
                  const active = v.id === selectedVariantId;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setSelectedVariantId(v.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.chip,
                        active ? styles.chipActive : styles.chipIdle,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={active ? styles.chipTextActive : styles.chipText}
                      >
                        {v.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Quantidade</Text>
              <Text style={styles.sectionHint}>Toque +/− ou toque no número</Text>
            </View>
            <View style={styles.qtyRow}>
              <QtyStepper
                value={quantity}
                onChange={setQuantity}
                size="lg"
                min={1}
                showUnit
                unitLabel="unidades"
                accessibilityLabel="Quantidade"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Desconto por item (opcional)</Text>
            <DiscountControl
              value={discount}
              onChange={setDiscount}
              amountMax={preview.subtotal}
              accessibilityLabel="Desconto por item"
            />
            <Text style={styles.sectionHint}>
              % ajusta com +/− · R$ aceita valor digitado. Preço de catálogo não
              é alterado.
            </Text>
          </View>

          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>
                Subtotal ({quantity} ×{' '}
                {selectedVariant !== null
                  ? formatBRL(selectedVariant.price)
                  : '—'}
                )
              </Text>
              <Text style={styles.previewValue}>
                {formatBRL(preview.subtotal)}
              </Text>
            </View>
            {preview.discountAmount > 0 ? (
              <View style={styles.previewRow}>
                <Text style={styles.previewLabelDisc}>Desconto</Text>
                <Text style={styles.previewValueDisc}>
                  −{formatBRL(preview.discountAmount)}
                </Text>
              </View>
            ) : null}
            <View style={[styles.previewRow, styles.previewTotalRow]}>
              <Text style={styles.previewTotalLabel}>Total da linha</Text>
              <Text style={styles.previewTotalValue}>
                {formatBRL(preview.lineTotal)}
              </Text>
            </View>
          </View>

          {error !== null ? (
            <Text style={styles.errorText}>⚠ {error}</Text>
          ) : null}
        </ScrollView>
      )}

      {isTablet ? null : (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adicionar ao pedido"
            disabled={!canAdd}
            onPress={() => void handleAdd()}
            style={({ pressed }) => [
              styles.primaryBtn,
              !canAdd && styles.disabled,
              pressed && canAdd && styles.pressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>Adicionar ao pedido</Text>
          </Pressable>
        </View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  iconBtnText: { fontSize: 22, color: '#0A0A0A' },
  topTitle: { fontSize: 15, fontWeight: '700', color: '#0A0A0A' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 20, flexGrow: 1 },
  splitBody: { flex: 1, flexDirection: 'row', gap: 16, padding: 20 },
  splitLeft: { flex: 1 },
  splitRight: { width: 360 },
  splitPaneContent: { gap: 14, paddingBottom: 20 },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  productImageSlot: {
    width: '100%',
    aspectRatio: 1.1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImagePlaceholder: {
    fontSize: 48,
    color: '#D4D4D8',
  },
  productInfo: { gap: 4 },
  productName: { fontSize: 18, fontWeight: '700', color: '#0A0A0A' },
  productMeta: { fontSize: 12, color: '#737373' },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0A',
    marginTop: 2,
  },
  productPriceUnit: { fontSize: 13, fontWeight: '500', color: '#737373' },
  productVariants: { gap: 8, paddingTop: 4 },
  controlsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 14,
    padding: 18,
    gap: 16,
  },
  footNote: {
    fontSize: 11,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
  },
  heroName: { fontSize: 16, fontWeight: '700', color: '#0A0A0A' },
  heroPrice: { fontSize: 14, fontWeight: '600', color: '#0A0A0A' },
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionHint: { fontSize: 11, color: '#A3A3A3' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#171717', borderColor: '#171717' },
  chipIdle: { borderColor: '#E4E4E7' },
  chipText: { fontSize: 12, color: '#525252', fontWeight: '500' },
  chipTextActive: { fontSize: 12, color: '#FAFAFA', fontWeight: '600' },
  qtyRow: { alignItems: 'center' },
  previewCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: { color: '#525252', fontSize: 12 },
  previewLabelDisc: { color: '#047857', fontSize: 12 },
  previewValue: { color: '#0A0A0A', fontSize: 13, fontWeight: '600' },
  previewValueDisc: { color: '#047857', fontSize: 13, fontWeight: '600' },
  previewTotalRow: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D4D4D8',
    marginTop: 2,
    alignItems: 'center',
  },
  previewTotalLabel: { color: '#0A0A0A', fontSize: 13, fontWeight: '700' },
  previewTotalValue: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#B91C1C', fontSize: 12 },
  inactiveBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 4,
  },
  inactiveBannerTitle: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
  },
  inactiveBannerBody: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  primaryBtn: {
    height: 52,
    backgroundColor: '#171717',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FAFAFA', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
