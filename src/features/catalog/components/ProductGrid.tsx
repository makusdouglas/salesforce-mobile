import { FlatList, StyleSheet } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type ProductDisplayDTO } from '../types';

import { ProductCard } from './ProductCard';

export type ProductGridProps = {
  products: readonly ProductDisplayDTO[];
  onProductPress: (id: string) => void;
  viewport: Viewport;
};

export function ProductGrid({ products, onProductPress, viewport }: ProductGridProps) {
  const isTablet = viewport === 'tablet';
  const numColumns = isTablet ? 3 : 2;
  const gap = isTablet ? 16 : 12;
  const padding = isTablet ? 28 : 16;

  return (
    <FlatList
      data={products as ProductDisplayDTO[]}
      key={numColumns}
      keyExtractor={(p) => p.id}
      numColumns={numColumns}
      columnWrapperStyle={{ gap }}
      contentContainerStyle={[styles.container, { padding, rowGap: gap }]}
      removeClippedSubviews
      initialNumToRender={8}
      windowSize={5}
      renderItem={({ item }) => (
        <ProductCard product={item} onPress={onProductPress} viewport={viewport} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
});
