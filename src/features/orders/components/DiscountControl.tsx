// 009-order-assembly: two-mode (%/R$) discount editor.
//
// UX1 — in `%` mode the value control is stepper-only (no keyboard). In
// `R$` mode the value control is a stepper PLUS a tap-to-edit TextInput.
// See feedback_ux1_input_modes.

import { useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { DiscountInput, DiscountMode } from '../totals/types';

export interface DiscountControlProps {
  readonly value: DiscountInput;
  readonly onChange: (next: DiscountInput) => void;
  /**
   * Upper bound for amount-mode (usually the line subtotal or
   * post-line-subtotal). Percent mode is always capped at 100.
   */
  readonly amountMax?: number;
  readonly accessibilityLabel?: string;
}

const PERCENT_STEP = 5;
const AMOUNT_STEP = 1;

export function DiscountControl({
  value,
  onChange,
  amountMax,
  accessibilityLabel,
}: DiscountControlProps) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState('');

  const setMode = (mode: DiscountMode): void => {
    if (mode === value.mode) return;
    // Preserve zero on switch; non-zero values don't translate meaningfully
    // between modes without additional context, so we reset to 0.
    onChange({ mode, value: 0 });
    setEditing(false);
  };

  const dec = (): void => {
    const step = value.mode === 'percent' ? PERCENT_STEP : AMOUNT_STEP;
    const next = Math.max(0, value.value - step);
    if (next !== value.value) onChange({ ...value, value: next });
  };
  const inc = (): void => {
    const step = value.mode === 'percent' ? PERCENT_STEP : AMOUNT_STEP;
    const maxHere =
      value.mode === 'percent' ? 100 : amountMax ?? Number.POSITIVE_INFINITY;
    const next = Math.min(maxHere, value.value + step);
    if (next !== value.value) onChange({ ...value, value: next });
  };
  const commitEdit = (): void => {
    const parsed = Number.parseFloat(buffer.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) {
      const capped =
        amountMax !== undefined ? Math.min(amountMax, parsed) : parsed;
      onChange({ ...value, value: capped });
    }
    setEditing(false);
    Keyboard.dismiss();
  };

  const canEdit = value.mode === 'amount';
  const unit = value.mode === 'percent' ? '%' : 'R$';

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={styles.wrapper}
    >
      <View style={styles.segmented}>
        <Pressable
          onPress={() => setMode('percent')}
          accessibilityRole="button"
          accessibilityState={{ selected: value.mode === 'percent' }}
          style={({ pressed }) => [
            styles.segment,
            value.mode === 'percent' && styles.segmentActive,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              value.mode === 'percent' && styles.segmentTextActive,
            ]}
          >
            %
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('amount')}
          accessibilityRole="button"
          accessibilityState={{ selected: value.mode === 'amount' }}
          style={({ pressed }) => [
            styles.segment,
            value.mode === 'amount' && styles.segmentActive,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              value.mode === 'amount' && styles.segmentTextActive,
            ]}
          >
            R$
          </Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable
          onPress={dec}
          disabled={value.value <= 0}
          accessibilityRole="button"
          accessibilityLabel="Diminuir desconto"
          style={({ pressed }) => [
            styles.btn,
            pressed && styles.pressed,
            value.value <= 0 && styles.disabled,
          ]}
        >
          <Text style={styles.btnLabel}>−</Text>
        </Pressable>

        {editing && canEdit ? (
          <TextInput
            autoFocus
            value={buffer}
            onChangeText={setBuffer}
            keyboardType="decimal-pad"
            onBlur={commitEdit}
            onSubmitEditing={commitEdit}
            returnKeyType="done"
            style={styles.valueInput}
            accessibilityLabel="Digitar valor do desconto"
          />
        ) : (
          <Pressable
            onPress={() => {
              if (!canEdit) return;
              setBuffer(String(value.value));
              setEditing(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              canEdit
                ? 'Valor do desconto — tocar para digitar'
                : 'Valor do desconto (em %)'
            }
            style={styles.valueWrap}
          >
            <Text style={styles.valueText}>
              {value.mode === 'amount' ? unit + ' ' : ''}
              {value.mode === 'amount'
                ? value.value.toFixed(2).replace('.', ',')
                : value.value}
              {value.mode === 'percent' ? ' ' + unit : ''}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={inc}
          accessibilityRole="button"
          accessibilityLabel="Aumentar desconto"
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        >
          <Text style={styles.btnLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  segmented: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    padding: 3,
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
  },
  segment: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  segmentText: {
    color: '#A3A3A3',
    fontSize: 12,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#0A0A0A',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  valueWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '700',
  },
  valueInput: {
    flex: 1,
    textAlign: 'center',
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
