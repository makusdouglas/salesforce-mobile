// 009-order-assembly: quantity stepper.
//
// UX1 — +/- taps are the PRIMARY path. The numeric value is also
// tap-to-edit: pressing the number swaps it for a TextInput that accepts
// the keyboard SECONDARY path. See feedback_ux1_input_modes memory.

import { useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export type QtySize = 'sm' | 'md' | 'lg';

export interface QtyStepperProps {
  readonly value: number;
  readonly onChange: (next: number) => void;
  /** Minimum allowed value. Defaults to 1. Setting 0 lets qty drop to zero. */
  readonly min?: number;
  /** Optional maximum; not clamped if absent. */
  readonly max?: number;
  readonly size?: QtySize;
  /** When true, the number cell shows a unit label beneath (e.g. "unidades"). */
  readonly showUnit?: boolean;
  readonly unitLabel?: string;
  readonly accessibilityLabel?: string;
}

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  size = 'sm',
  showUnit = false,
  unitLabel = 'unidades',
  accessibilityLabel,
}: QtyStepperProps) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState<string>('');

  const dec = (): void => {
    const next = Math.max(min, value - 1);
    if (next !== value) onChange(next);
  };
  const inc = (): void => {
    const next = max !== undefined ? Math.min(max, value + 1) : value + 1;
    if (next !== value) onChange(next);
  };
  const commit = (): void => {
    const parsed = Number.parseInt(buffer, 10);
    if (Number.isFinite(parsed)) {
      let next = parsed;
      if (next < min) next = min;
      if (max !== undefined && next > max) next = max;
      if (next !== value) onChange(next);
    }
    setEditing(false);
    Keyboard.dismiss();
  };

  const s = SIZE[size];

  const valueNode = editing ? (
    <TextInput
      autoFocus
      value={buffer}
      onChangeText={setBuffer}
      keyboardType="number-pad"
      onBlur={commit}
      onSubmitEditing={commit}
      returnKeyType="done"
      style={[styles.value, s.value, styles.input]}
      accessibilityLabel={`${accessibilityLabel ?? 'Quantidade'} - digitar`}
    />
  ) : (
    <Pressable
      onPress={() => {
        setBuffer(String(value));
        setEditing(true);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel ?? 'Quantidade'} - tocar para digitar`}
      style={styles.valueTouchable}
    >
      <Text style={[styles.value, s.value]}>{value}</Text>
      {showUnit ? <Text style={styles.unit}>{unitLabel}</Text> : null}
    </Pressable>
  );

  return (
    <View style={[styles.row, s.row]} accessibilityLabel={accessibilityLabel}>
      <Pressable
        onPress={dec}
        accessibilityRole="button"
        accessibilityLabel="Diminuir"
        disabled={value <= min}
        style={({ pressed }) => [
          styles.btn,
          s.btn,
          styles.btnGhost,
          pressed && styles.pressed,
          value <= min && styles.disabled,
        ]}
      >
        <Text style={[styles.btnLabel, s.btnLabel]}>−</Text>
      </Pressable>
      <View style={[styles.valueWrap, s.valueWrap]}>{valueNode}</View>
      <Pressable
        onPress={inc}
        accessibilityRole="button"
        accessibilityLabel="Aumentar"
        style={({ pressed }) => [
          styles.btn,
          s.btn,
          styles.btnFilled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.btnLabel, s.btnLabel, styles.btnLabelFilled]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  btnGhost: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  btnFilled: {
    backgroundColor: '#171717',
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  btnLabel: {
    color: '#0A0A0A',
    fontWeight: '600',
  } as TextStyle,
  btnLabelFilled: {
    color: '#FAFAFA',
  },
  valueWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  value: {
    color: '#0A0A0A',
    fontWeight: '700',
    textAlign: 'center',
  } as TextStyle,
  unit: {
    color: '#A3A3A3',
    fontSize: 10,
  },
  input: {
    minWidth: 40,
    paddingVertical: 0,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.35,
  },
});

const SIZE: Record<
  QtySize,
  {
    row: ViewStyle;
    btn: ViewStyle;
    btnLabel: TextStyle;
    valueWrap: ViewStyle;
    value: TextStyle;
  }
> = {
  sm: {
    row: {},
    btn: { width: 36, height: 36 },
    btnLabel: { fontSize: 18 },
    valueWrap: { width: 44, height: 36 },
    value: { fontSize: 15 },
  },
  md: {
    row: {},
    btn: { width: 40, height: 40 },
    btnLabel: { fontSize: 20 },
    valueWrap: { width: 56, height: 40 },
    value: { fontSize: 18 },
  },
  lg: {
    row: {},
    btn: { width: 48, height: 48 },
    btnLabel: { fontSize: 24 },
    valueWrap: { width: 80, height: 48 },
    value: { fontSize: 28 },
  },
};
