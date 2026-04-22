import { StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type VariantDisplayDTO } from '../types';

export type VariantRowProps = {
  variant: VariantDisplayDTO;
  viewport: Viewport;
};

function formatPrice(value: number | null): string | null {
  if (value === null) return null;
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function VariantRow({ variant, viewport }: VariantRowProps) {
  const isTablet = viewport === 'tablet';
  const priceLabel = formatPrice(variant.price);
  const hasAttributes = variant.attributes !== null && variant.attributes !== variant.label;

  return (
    <View
      style={[
        styles.row,
        {
          paddingVertical: isTablet ? 14 : 12,
          paddingHorizontal: isTablet ? 16 : 14,
        },
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.label, isTablet && styles.labelTablet]}>{variant.label}</Text>
        {hasAttributes ? (
          <Text style={[styles.attributes, isTablet && styles.attributesTablet]}>
            {variant.attributes}
          </Text>
        ) : null}
      </View>
      {priceLabel !== null ? (
        <Text style={[styles.price, isTablet && styles.priceTablet]}>{priceLabel}</Text>
      ) : (
        <Text style={[styles.priceUnavailable, isTablet && styles.priceUnavailableTablet]}>
          preço indisponível
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    gap: 12,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0A0A0A',
  },
  labelTablet: {
    fontSize: 15,
  },
  attributes: {
    fontSize: 12,
    color: '#71717A',
  },
  attributesTablet: {
    fontSize: 13,
  },
  price: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  priceTablet: {
    fontSize: 16,
  },
  priceUnavailable: {
    fontSize: 13,
    color: '#71717A',
    fontStyle: 'italic',
  },
  priceUnavailableTablet: {
    fontSize: 14,
  },
});
