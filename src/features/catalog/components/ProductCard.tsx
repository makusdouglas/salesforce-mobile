import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type ProductDisplayDTO } from '../types';

import { CachedImage } from './CachedImage';

export type ProductCardProps = {
  product: ProductDisplayDTO;
  onPress: (id: string) => void;
  viewport: Viewport;
};

function formatPrice(value: number | null): string {
  if (value === null) return '';
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatVariants(n: number): string {
  if (n === 1) return '1 variação';
  return `${n} variações`;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(product.id)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <CachedImage source={product.imageUrl} style={styles.image} resizeMode='contain' />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        {product.basePrice !== null ? (
          <Text style={styles.price}>{formatPrice(product.basePrice)}</Text>
        ) : (
          <Text style={styles.priceUnavailable}>preço indisponível</Text>
        )}
        <Text style={styles.hint}>{formatVariants(product.variantCount)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
  },
  image: {
    width: '100%',
    aspectRatio: 1.6,
  },
  body: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0A0A0A',
  },
  price: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  priceUnavailable: {
    fontSize: 13,
    color: '#71717A',
    fontStyle: 'italic',
  },
  hint: {
    fontSize: 11,
    color: '#71717A',
  },
});
