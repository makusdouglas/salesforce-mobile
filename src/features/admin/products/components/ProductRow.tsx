import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProductWithVariants } from '../service/productsApi';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Props = {
  product: ProductWithVariants;
  onPress: () => void;
  showEditButton?: boolean;
  onEditPress?: () => void;
};

function formatBRL(n: number): string {
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

export function ProductRow({ product, onPress, showEditButton, onEditPress }: Props) {
  const subtitle = [product.category ?? 'Sem categoria', `${product.variants.length} variante${product.variants.length === 1 ? '' : 's'}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.thumb}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.thumbImage} />
        ) : null}
      </View>
      <View style={styles.col}>
        <Text style={styles.title} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={styles.price}>{formatBRL(product.base_price)}</Text>
      {showEditButton ? (
        <Pressable onPress={onEditPress ?? onPress} style={styles.editBtn} hitSlop={8}>
          <Text style={styles.editBtnText}>Editar</Text>
        </Pressable>
      ) : (
        <Text style={styles.chev}>›</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  thumb: {
    // 4:3 landscape thumbnail — matches the uploaded image aspect.
    width: 72,
    height: 54,
    borderRadius: adminRadii.control,
    backgroundColor: adminColors.surfaceMuted,
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  col: { flex: 1, gap: 4 },
  title: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
  price: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 15,
    fontWeight: '600',
  },
  chev: { color: adminColors.textFaint, fontSize: 22, paddingHorizontal: 4 },
  editBtn: {
    height: 32,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    borderRadius: adminRadii.control,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  editBtnText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
});
