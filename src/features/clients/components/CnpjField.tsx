import { StyleSheet, Text, TextInput, View } from 'react-native';

import { isValidFormat } from '../cnpj/cnpj';
import { type Viewport } from '../hooks/useViewport';

export type CnpjFieldProps = {
  readonly value: string;
  readonly onChangeText: (next: string) => void;
  readonly viewport: Viewport;
};

export function CnpjField({ value, onChangeText, viewport }: CnpjFieldProps) {
  const hasInput = value.trim().length > 0;
  const showError = hasInput && !isValidFormat(value);
  const isTablet = viewport === 'tablet';

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        CNPJ <Text style={styles.optional}>· Opcional</Text>
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="12.345.678/0001-99"
        placeholderTextColor="#A1A1AA"
        keyboardType="numbers-and-punctuation"
        maxLength={18}
        style={[
          styles.input,
          isTablet && styles.inputTablet,
          showError && styles.inputError,
        ]}
        accessibilityLabel="CNPJ"
      />
      {showError ? (
        <Text style={styles.errorText}>
          CNPJ deve ter 14 dígitos. Exemplo: 12.345.678/0001-99.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0A0A0A',
  },
  optional: {
    fontWeight: '400',
    color: '#71717A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0A0A0A',
    backgroundColor: '#FFFFFF',
  },
  inputTablet: {
    paddingVertical: 14,
  },
  inputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
  },
});
