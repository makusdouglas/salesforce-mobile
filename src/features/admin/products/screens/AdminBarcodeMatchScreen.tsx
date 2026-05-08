import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';

import {
  getProductById,
  type ProductWithVariants,
} from '../service/productsApi';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminBarcodeMatch'>;
type Route = RouteProp<AdminStackParamList, 'AdminBarcodeMatch'>;

function formatBRL(n: number): string {
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

export function AdminBarcodeMatchScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [product, setProduct] = useState<ProductWithVariants | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProductById(route.params.productId)
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as { message?: string })?.message ?? 'Erro ao carregar.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [route.params.productId]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Código encontrado</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Produto já cadastrado</Text>
          <Text style={styles.bannerHint}>
            Edite as informações abaixo ou escaneie outro código.
          </Text>
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : product === null ? (
          <View style={styles.loading}><ActivityIndicator color={adminColors.textPrimary} /></View>
        ) : (
          <View style={styles.card}>
            <View style={styles.thumb}>
              {product.image_url ? (
                <Image source={{ uri: product.image_url }} style={styles.thumbImage} />
              ) : null}
            </View>
            <View style={styles.col}>
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.sub}>
                {(product.category ?? 'Sem categoria') + ' · ' + formatBRL(product.base_price)}
              </Text>
              {product.barcode ? (
                <Text style={styles.code}>Código: {product.barcode}</Text>
              ) : null}
            </View>
          </View>
        )}

        <Pressable
          style={styles.primary}
          onPress={() =>
            nav.replace('AdminProductForm', { productId: route.params.productId })
          }
        >
          <Text style={styles.primaryText}>Editar este produto</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={() => nav.replace('AdminBarcodeScanner')}
        >
          <Text style={styles.secondaryText}>Escanear outro código</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: adminColors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: adminColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.stroke,
  },
  back: { color: adminColors.textPrimary, fontSize: 24 },
  title: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 17,
    fontWeight: '600',
  },
  body: { flex: 1, padding: 16, gap: 16 },
  banner: {
    backgroundColor: adminColors.bannerFill,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderColor: adminColors.bannerStroke,
    padding: 14,
    gap: 2,
  },
  bannerTitle: {
    color: adminColors.bannerText,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  bannerHint: {
    color: adminColors.bannerText,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  loading: { padding: 32, alignItems: 'center' },
  errorText: { color: adminColors.textMuted, fontFamily: adminFonts.body },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    padding: 16,
  },
  thumb: {
    // 4:3 landscape thumbnail — consistent with the list row and
    // upload pipeline.
    width: 96,
    height: 72,
    borderRadius: adminRadii.input,
    backgroundColor: adminColors.surfaceMuted,
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  col: { flex: 1, gap: 4 },
  name: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 16,
    fontWeight: '600',
  },
  sub: { color: adminColors.textMuted, fontFamily: adminFonts.body, fontSize: 13 },
  code: { color: adminColors.textFaint, fontFamily: adminFonts.mono, fontSize: 12 },
  primary: {
    height: 48,
    borderRadius: adminRadii.input,
    backgroundColor: adminColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: adminColors.primaryOn,
    fontFamily: adminFonts.body,
    fontSize: 15,
    fontWeight: '600',
  },
  secondary: {
    height: 44,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
});
