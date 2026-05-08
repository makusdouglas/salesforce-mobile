// 012-payment-receipts: payment-method chip used in the receipt form's
// segmented control. 5 instances render as a 3 + 2 grid on both phone
// and tablet per design/screens.md.

import { Pressable, StyleSheet, Text } from 'react-native';

import type { PaymentMethod } from '@/data/types';

export interface MethodChipProps {
  readonly method: PaymentMethod;
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: (next: PaymentMethod) => void;
}

export function MethodChip({ method, label, selected, onPress }: MethodChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Método: ${label}`}
      accessibilityState={{ selected }}
      onPress={() => onPress(method)}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: '#171717',
    borderColor: '#171717',
  },
  chipUnselected: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E4E4E7',
  },
  chipPressed: { opacity: 0.75 },
  label: { fontSize: 14, fontWeight: '600' },
  labelSelected: { color: '#FAFAFA' },
  labelUnselected: { color: '#0A0A0A' },
});
