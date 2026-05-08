import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  ViewStyle,
} from 'react-native';

type Props = {
  children: ReactNode;
  /** Extra offset for a fixed header above the scroll (iOS only). */
  keyboardVerticalOffset?: number;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle | ViewStyle[];
};

/**
 * Reusable wrapper that prevents the on-screen keyboard from covering
 * text inputs. Matches the existing pattern used by LoginScreen,
 * ClientFormScreen and PaymentReceiptFormScreen.
 *
 * Behavior:
 * - iOS: `padding` — content shrinks as the keyboard expands.
 * - Android: `height` — the view resizes (safer than `padding` due to
 *   Android's soft input mode handling).
 * - Taps on non-input children while the keyboard is open still register
 *   (`keyboardShouldPersistTaps="handled"`).
 */
export function KeyboardAwareScroll({
  children,
  keyboardVerticalOffset,
  style,
  contentContainerStyle,
}: Props) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset ?? 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
