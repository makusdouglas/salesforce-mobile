import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';

export type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  viewport: Viewport;
};

export function SearchBar({ value, onChangeText, viewport }: SearchBarProps) {
  const isTablet = viewport === 'tablet';

  return (
    <View
      style={[
        styles.container,
        {
          height: isTablet ? 46 : 40,
          borderRadius: isTablet ? 10 : 8,
          paddingHorizontal: isTablet ? 16 : 12,
          gap: isTablet ? 10 : 8,
        },
      ]}
    >
      <View style={styles.iconSlot}>
        <View style={styles.searchIcon} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Buscar produto"
        placeholderTextColor="#71717A"
        autoCorrect={false}
        autoCapitalize="none"
        style={[styles.input, { fontSize: isTablet ? 15 : 14 }]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
        >
          <Text style={styles.clearLabel}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#71717A',
  },
  input: {
    flex: 1,
    color: '#0A0A0A',
    paddingVertical: 0,
  },
  clearButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  clearLabel: {
    fontSize: 20,
    color: '#71717A',
    lineHeight: 22,
  },
});
