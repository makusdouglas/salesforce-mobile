import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { combineLatest, type Subscription } from 'rxjs';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { productsRepository } from '@/data/repositories/productsRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';
import { SyncStatusIndicator } from '@/features/sync';

import { CachedImage } from '../components/CachedImage';
import { VariantRow } from '../components/VariantRow';
import { toVariantDTO } from '../hooks/useCatalog';
import { useViewport } from '../hooks/useViewport';
import { deriveProductDTO, type ProductDisplayDTO } from '../types';

import { OrderContextSummaryBar } from './OrderContextSummaryBar';

type Props = NativeStackScreenProps<HomeStackParamList, 'ProductDetail'>;

function useProduct(productId: string): { product: ProductDisplayDTO | null; loading: boolean } {
  const [product, setProduct] = useState<ProductDisplayDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: Subscription | null = null;
    setLoading(true);
    sub = combineLatest([
      productsRepository.observe(productId),
      productVariantsRepository.observeByProduct(productId),
    ]).subscribe({
      next: ([p, variants]) => {
        if (p === null) {
          setProduct(null);
          setLoading(false);
          return;
        }
        const dto = deriveProductDTO(
          {
            id: p.id,
            name: p.name,
            description: p.description,
            imageUrl: p.imageUrl,
            unit: p.unit,
            category: p.category,
          },
          variants.map(toVariantDTO),
        );
        setProduct(dto);
        setLoading(false);
      },
      error: () => {
        setProduct(null);
        setLoading(false);
      },
    });
    return () => sub?.unsubscribe();
  }, [productId]);

  return { product, loading };
}

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function sortVariantsByLabel(variants: readonly ProductDisplayDTO['variants'][number][]) {
  return [...variants].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));
}

export function ProductDetailScreen({ navigation, route }: Props) {
  const { productId } = route.params;
  // 009-order-assembly: when present, the screen is in "add-to-order" mode.
  const inOrderId = route.params.inOrderId ?? null;
  const { product, loading } = useProduct(productId);
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';

  const handleAddToOrder = () => {
    if (inOrderId === null) return;
    navigation.navigate('Orders', {
      screen: 'AddToOrder',
      params: { orderId: inOrderId, productId },
    });
  };
  const handleBackToOrder = () => {
    if (inOrderId === null) return;
    navigation.navigate('Orders', {
      screen: 'OrderDraft',
      params: { orderId: inOrderId },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <Text style={[styles.title, isTablet && styles.titleTablet]}>Produto</Text>
        <View style={styles.syncSlot}>
          <SyncStatusIndicator />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingView} />
      ) : product === null ? (
        <View style={styles.unavailableView}>
          <Text style={styles.unavailableText}>Produto não disponível</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.unavailableButton, pressed && styles.pressed]}
          >
            <Text style={styles.unavailableButtonLabel}>Voltar ao catálogo</Text>
          </Pressable>
        </View>
      ) : isTablet ? (
        <View style={styles.tabletBody}>
          <View style={styles.tabletHeroColumn}>
            <CachedImage source={product.imageUrl} style={styles.heroTablet} />
          </View>
          <ScrollView style={styles.tabletInfoColumn} contentContainerStyle={styles.tabletInfoContent}>
            <InfoPanel product={product} isTablet />
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.phoneContent}>
          <CachedImage source={product.imageUrl} style={styles.heroPhone} />
          <View style={styles.phoneInfo}>
            <InfoPanel product={product} isTablet={false} />
          </View>
        </ScrollView>
      )}
      {inOrderId !== null && product !== null ? (
        <View style={ctaStyles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adicionar ao pedido"
            onPress={handleAddToOrder}
            style={({ pressed }) => [
              ctaStyles.btn,
              pressed && ctaStyles.pressed,
            ]}
          >
            <Text style={ctaStyles.btnText}>Adicionar ao pedido</Text>
          </Pressable>
        </View>
      ) : null}
      {inOrderId !== null ? (
        <OrderContextSummaryBar orderId={inOrderId} onPress={handleBackToOrder} />
      ) : null}
    </SafeAreaView>
  );
}

const ctaStyles = StyleSheet.create({
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  btn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#FAFAFA', fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});

function InfoPanel({
  product,
  isTablet,
}: {
  product: ProductDisplayDTO;
  isTablet: boolean;
}) {
  const sortedVariants = sortVariantsByLabel(product.variants);

  return (
    <View style={styles.infoPanel}>
      <View style={styles.nameBlock}>
        <Text style={[styles.productName, isTablet && styles.productNameTablet]}>
          {product.name}
        </Text>
        {product.description !== null ? (
          <Text style={[styles.description, isTablet && styles.descriptionTablet]}>
            {product.description}
          </Text>
        ) : null}
      </View>

      {product.basePrice !== null ? (
        <View style={styles.priceRow}>
          <Text style={[styles.priceLabel, isTablet && styles.priceLabelTablet]}>A partir de</Text>
          <Text style={[styles.priceValue, isTablet && styles.priceValueTablet]}>
            {formatPrice(product.basePrice)}
          </Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <Text style={[styles.sectionHeader, isTablet && styles.sectionHeaderTablet]}>
        Variações
      </Text>

      <View style={styles.variantsList}>
        {sortedVariants.map((v) => (
          <VariantRow key={v.id} variant={v} viewport={isTablet ? 'tablet' : 'phone'} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  topBarTablet: {
    height: 64,
    paddingHorizontal: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  backChevron: {
    fontSize: 32,
    color: '#0A0A0A',
    marginTop: -4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  titleTablet: {
    fontSize: 20,
  },
  syncSlot: {
    width: 80,
    alignItems: 'flex-end',
  },
  loadingView: {
    flex: 1,
  },
  unavailableView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 32,
  },
  unavailableText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#0A0A0A',
  },
  unavailableButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#18181B',
  },
  unavailableButtonLabel: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
  },
  phoneContent: {
    paddingBottom: 32,
  },
  heroPhone: {
    width: '100%',
    height: 260,
  },
  phoneInfo: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  tabletBody: {
    flex: 1,
    flexDirection: 'row',
    padding: 28,
    gap: 28,
  },
  tabletHeroColumn: {
    width: 360,
  },
  heroTablet: {
    width: 360,
    height: 420,
    borderRadius: 16,
  },
  tabletInfoColumn: {
    flex: 1,
  },
  tabletInfoContent: {
    paddingBottom: 32,
  },
  infoPanel: {
    gap: 16,
  },
  nameBlock: {
    gap: 6,
  },
  productName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  productNameTablet: {
    fontSize: 28,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: '#71717A',
  },
  descriptionTablet: {
    fontSize: 14,
    lineHeight: 21,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  priceLabel: {
    fontSize: 12,
    color: '#71717A',
    marginBottom: 2,
  },
  priceLabelTablet: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  priceValueTablet: {
    fontSize: 28,
  },
  divider: {
    height: 1,
    backgroundColor: '#E4E4E7',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52525B',
    letterSpacing: 0.5,
  },
  sectionHeaderTablet: {
    fontSize: 14,
  },
  variantsList: {
    gap: 10,
  },
});
