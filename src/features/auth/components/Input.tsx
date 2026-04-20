import type { ReactNode } from 'react';
import {
  TextInput,
  View,
  Text,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';

import { colors, font, fontSizes, radii, spacing } from '../theme/tokens';

type InputProps = {
  value: string;
  onChangeText?: ((next: string) => void) | undefined;
  label?: string | undefined;
  placeholder?: string | undefined;
  secureTextEntry?: boolean | undefined;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: KeyboardTypeOptions | undefined;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  rightSlot?: ReactNode;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  style?: StyleProp<ViewStyle>;
};

export function Input({
  value,
  onChangeText,
  label,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType,
  autoComplete,
  textContentType,
  rightSlot,
  disabled,
  readOnly,
  style,
}: InputProps) {
  const isReadOnly = readOnly === true;
  const containerStyle = {
    height: 40,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: isReadOnly ? colors.muted : colors.background,
    borderWidth: isReadOnly ? 0 : 1,
    borderColor: colors.border,
    opacity: disabled ? 0.6 : 1,
  };

  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {label ? (
        <Text
          style={{
            fontFamily: font.family,
            fontSize: fontSizes.sm,
            fontWeight: font.weights.medium,
            color: colors.foreground,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View style={containerStyle}>
        <TextInput
          value={value}
          onChangeText={isReadOnly ? undefined : onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={secureTextEntry === true}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          editable={!disabled && !isReadOnly}
          style={{
            flex: 1,
            paddingVertical: 0,
            fontFamily: font.family,
            fontSize: fontSizes.base,
            color: colors.foreground,
          }}
        />
        {rightSlot ? <View style={{ marginLeft: spacing.sm }}>{rightSlot}</View> : null}
      </View>
    </View>
  );
}
