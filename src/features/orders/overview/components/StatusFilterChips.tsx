import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { OrdersOverviewStatusFilter } from '../types';

const CHIPS: readonly {
  readonly key: OrdersOverviewStatusFilter;
  readonly label: string;
}[] = [
  { key: 'all', label: 'Todos' },
  { key: 'draft', label: 'Rascunhos' },
  { key: 'pending', label: 'Pendente' },
  { key: 'paid', label: 'Pago' },
  { key: 'canceled', label: 'Cancelados' },
];

export type StatusFilterChipsProps = {
  readonly active: OrdersOverviewStatusFilter;
  readonly onChange: (value: OrdersOverviewStatusFilter) => void;
};

export function StatusFilterChips({ active, onChange }: StatusFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {CHIPS.map((chip) => {
        const isActive = active === chip.key;
        return (
          <Pressable
            key={chip.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={chip.label}
            onPress={() => onChange(chip.key)}
            style={({ pressed }) => [
              styles.chip,
              isActive ? styles.chipActive : styles.chipInactive,
              pressed && styles.chipPressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                isActive ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  chipInactive: { backgroundColor: '#FFFFFF', borderColor: '#E4E4E7' },
  chipPressed: { opacity: 0.7 },
  label: { fontSize: 12, fontWeight: '500' },
  labelActive: { color: '#FFFFFF' },
  labelInactive: { color: '#3F3F46' },
});
