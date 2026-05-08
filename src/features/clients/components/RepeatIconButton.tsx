// 010-repeat-last-order: circular ↺ button attached to each history row.
//
// Tapping triggers the per-row repeat path (US2). `dim` is used on
// cancelled-source rows so the icon recedes without losing its affordance.
// The button stops propagation so its parent row's tap (which opens the
// read-only view of that past order) does NOT fire — this is the hit-zone
// separation locked in T025 / FR-010.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';

export type RepeatIconButtonProps = {
  readonly dim?: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
};

export function RepeatIconButton({
  dim = false,
  onPress,
  accessibilityLabel = 'Repetir este pedido',
}: RepeatIconButtonProps) {
  const handlePress = (e: GestureResponderEvent) => {
    // Prevents the surrounding row's press handler from also firing.
    // React Native's Pressable doesn't have a declarative stopPropagation,
    // so we inherit from the event and rely on the outer row using a
    // Pressable with `onStartShouldSetResponderCapture` / hit-slop bounded
    // to its non-button area. Current OrderHistoryRow has no tap handler
    // so propagation is moot — but we keep the call for future-proofing.
    e.stopPropagation?.();
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Feather name="refresh-cw" size={18} color={dim ? '#71717A' : '#18181B'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
