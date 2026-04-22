import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type ProductDisplayDTO } from '../types';

export type FilterChipRowProps = {
  products: readonly ProductDisplayDTO[];
  activeCategory: string | null;
  onChange: (next: string | null) => void;
  viewport: Viewport;
};

const TODOS_SENTINEL = '__todos__';

function computeCategories(products: readonly ProductDisplayDTO[]): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const raw = p.category ?? '';
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], 'pt-BR', { sensitivity: 'base' });
    })
    .map(([name]) => name);
}

export function FilterChipRow({
  products,
  activeCategory,
  onChange,
  viewport,
}: FilterChipRowProps) {
  const isTablet = viewport === 'tablet';
  const categories = useMemo(() => computeCategories(products), [products]);

  if (categories.length === 0) return null;

  const data = [TODOS_SENTINEL, ...categories];

  return (
    <FlatList
      data={data}
      horizontal
      keyExtractor={(item) => item}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => {
        const isTodos = item === TODOS_SENTINEL;
        const isActive = isTodos ? activeCategory === null : activeCategory === item;
        const label = isTodos ? 'Todos' : item;
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (isTodos) {
                onChange(null);
                return;
              }
              onChange(isActive ? null : item);
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                height: isTablet ? 36 : 32,
                borderRadius: isTablet ? 18 : 16,
                paddingHorizontal: isTablet ? 16 : 12,
              },
              isActive ? styles.chipActive : styles.chipInactive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                { fontSize: isTablet ? 14 : 13 },
                isActive ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      }}
      ItemSeparatorComponent={() => <View style={{ width: isTablet ? 10 : 8 }} />}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#18181B',
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    fontWeight: '500',
  },
  labelActive: {
    color: '#FAFAFA',
  },
  labelInactive: {
    color: '#0A0A0A',
  },
});
