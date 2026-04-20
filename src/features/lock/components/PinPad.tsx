// Design tokens imported directly from @/features/auth/theme — documented
// cross-feature exception for shared visual constants (see @/features/lock
// barrel docstring).
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font } from '@/features/auth/theme/tokens';

type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  maxLength: 4 | 5 | 6;
  onSubmit?: () => void;
  disabled?: boolean;
  size?: 'phone' | 'tablet';
};

const LAYOUT: readonly (readonly (string | null)[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'backspace'],
];

export function PinPad({
  value,
  onChange,
  maxLength,
  onSubmit,
  disabled = false,
  size = 'phone',
}: PinPadProps) {
  const tablet = size === 'tablet';
  const keyHeight = tablet ? 64 : 56;
  const fontSize = tablet ? 26 : 22;
  const gap = tablet ? 12 : 10;
  const radius = tablet ? 10 : 8;

  const press = (key: string): void => {
    if (disabled) return;
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= maxLength) return;
    const next = value + key;
    onChange(next);
    if (next.length === maxLength && onSubmit !== undefined) {
      onSubmit();
    }
  };

  return (
    <View style={[styles.pad, { gap }]}>
      {LAYOUT.map((row, rowIdx) => (
        <View key={rowIdx} style={[styles.row, { gap }]}>
          {row.map((key, colIdx) => {
            if (key === null) {
              return (
                <View
                  key={`blank-${rowIdx}-${colIdx}`}
                  style={[styles.keyBlank, { height: keyHeight }]}
                />
              );
            }
            const isBackspace = key === 'backspace';
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={isBackspace ? 'Apagar dígito' : `Digitar ${key}`}
                disabled={disabled}
                onPress={() => press(key)}
                style={({ pressed }) => [
                  styles.keyBase,
                  {
                    height: keyHeight,
                    borderRadius: radius,
                    backgroundColor: colors.muted,
                  },
                  pressed && !disabled ? styles.keyPressed : null,
                  disabled ? styles.keyDisabled : null,
                ]}
              >
                {isBackspace ? (
                  <Feather
                    name="delete"
                    size={tablet ? 26 : 22}
                    color={colors.foreground}
                  />
                ) : (
                  <Text
                    style={[
                      styles.keyLabel,
                      {
                        fontSize,
                        color: colors.foreground,
                        fontFamily: font.family,
                      },
                    ]}
                  >
                    {key}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    width: '100%',
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
  },
  keyBase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBlank: {
    flex: 1,
  },
  keyPressed: {
    opacity: 0.7,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyLabel: {
    fontWeight: font.weights.medium,
  },
});
