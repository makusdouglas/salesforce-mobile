import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

export type SearchFieldProps = {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly placeholder?: string;
};

export function SearchField({
  value,
  onChange,
  placeholder = 'Buscar por cliente ou número',
}: SearchFieldProps) {
  return (
    <View style={styles.wrap}>
      <Feather name="search" size={15} color="#737373" />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A1A1AA"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          hitSlop={8}
          onPress={() => onChange('')}
        >
          <Feather name="x" size={15} color="#737373" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 12,
    color: '#0A0A0A',
    paddingVertical: 0,
  },
});
