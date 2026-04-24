import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { adminColors, adminFonts, adminRadii } from '../theme';
import type { VariantFormItem } from '../hooks/useProductForm';

type Props = {
  item: VariantFormItem;
  onChange: (patch: { label?: string; price?: number }) => void;
  onRemove: () => void;
};

function priceToInput(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return value.toFixed(2).replace('.', ',');
}

/**
 * Parse "R$"-free text using either comma or dot as decimal separator.
 * Returns `null` when the input is incomplete (empty, only a separator,
 * or ends with a trailing separator) so the caller does NOT overwrite
 * the form state mid-typing and lose the user's in-progress comma.
 */
function parseInputPrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // Keep only digits and separators.
  const sanitized = trimmed.replace(/[^0-9.,]/g, '');
  if (sanitized.length === 0) return null;
  // If the value ends with a separator the user is still typing
  // decimals — don't commit yet.
  if (/[.,]$/.test(sanitized)) return null;
  // Normalize separators: treat "," as decimal, drop "." that might be
  // a thousands separator. Users in pt-BR rarely type thousands on a
  // phone, so the simpler rule is: last "," or "." is the decimal
  // separator.
  const lastComma = sanitized.lastIndexOf(',');
  const lastDot = sanitized.lastIndexOf('.');
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = sanitized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = sanitized.replace(/,/g, '');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function VariantRow({ item, onChange, onRemove }: Props) {
  const [text, setText] = useState<string>(() => priceToInput(item.price));
  const lastCommittedRef = useRef<number>(item.price);

  // Re-sync local text when the parent drops a new numeric value that
  // the user did NOT just type (e.g. after a successful save re-hydrates
  // the form from the server row).
  useEffect(() => {
    if (item.price !== lastCommittedRef.current) {
      setText(priceToInput(item.price));
      lastCommittedRef.current = item.price;
    }
  }, [item.price]);

  const handleText = (raw: string) => {
    // Sanitize for display but keep partial input (trailing "," etc.).
    const visual = raw.replace(/[^0-9.,]/g, '');
    setText(visual);
    const parsed = parseInputPrice(visual);
    if (parsed !== null && parsed !== item.price) {
      lastCommittedRef.current = parsed;
      onChange({ price: parsed });
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.col}>
        <TextInput
          value={item.label}
          onChangeText={(label) => onChange({ label })}
          placeholder="Pequeno · 500g"
          placeholderTextColor={adminColors.textFaint}
          style={styles.label}
        />
        <View style={styles.priceRow}>
          <Text style={styles.currency}>R$</Text>
          <TextInput
            value={text}
            onChangeText={handleText}
            placeholder="0,00"
            placeholderTextColor={adminColors.textFaint}
            // `numeric` on Android / iOS shows a keypad that includes
            // both "," and "." so pt-BR users can type their native
            // decimal separator.
            keyboardType="numeric"
            style={styles.priceInput}
          />
        </View>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
        <Text style={styles.removeText}>Remover</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  col: { flex: 1, gap: 6 },
  label: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currency: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  priceInput: {
    flex: 1,
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    paddingVertical: 0,
  },
  removeBtn: { paddingHorizontal: 8 },
  removeText: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 12,
    fontWeight: '500',
  },
});
