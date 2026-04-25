import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { adminColors, adminFonts, adminRadii } from '../theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onScanPress: () => void;
  error?: string | null;
};

export function BarcodeField({ value, onChange, onScanPress, error }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Código de barras</Text>
      <View style={[styles.input, error ? styles.inputError : null]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Opcional"
          placeholderTextColor={adminColors.textFaint}
          style={styles.text}
          keyboardType="number-pad"
          autoCorrect={false}
        />
        <Pressable style={styles.scanBtn} onPress={onScanPress} hitSlop={8}>
          <Text style={styles.scanText}>Escanear</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    color: adminColors.textLabel,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  text: {
    flex: 1,
    color: adminColors.textPrimary,
    fontFamily: adminFonts.mono,
    fontSize: 14,
    paddingVertical: 0,
  },
  scanBtn: {
    height: 30,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    borderRadius: adminRadii.chip,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  scanText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 12,
    fontWeight: '500',
  },
  inputError: {
    borderColor: '#B91C1C',
  },
  errorText: {
    color: '#B91C1C',
    fontFamily: adminFonts.body,
    fontSize: 12,
    marginTop: 2,
  },
});
