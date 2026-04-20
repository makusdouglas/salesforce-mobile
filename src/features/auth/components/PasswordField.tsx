import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { colors } from '../theme/tokens';

import { Input } from './Input';

type PasswordFieldProps = {
  value: string;
  onChangeText: (next: string) => void;
  label?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
};

export function PasswordField({
  value,
  onChangeText,
  label,
  placeholder,
  disabled,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      label={label}
      placeholder={placeholder}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoComplete="current-password"
      textContentType="password"
      disabled={disabled}
      rightSlot={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          <Feather
            name={visible ? 'eye-off' : 'eye'}
            size={16}
            color={colors.mutedForeground}
          />
        </Pressable>
      }
    />
  );
}
