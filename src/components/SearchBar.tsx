import { Feather } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

// Viewport split — mirrors the project-wide 768 pt breakpoint convention.
const TABLET_MIN_WIDTH = 768;

export type SearchBarProps = {
  readonly value: string;
  readonly onChangeText: (next: string) => void;
  readonly placeholder: string;
  readonly accessibilityLabel?: string;
};

/**
 * Shared tap-first search input used by feature list screens.
 * Auto-detects phone vs tablet via {@link useWindowDimensions} — callers
 * just pass the Portuguese `placeholder` that matches the content domain
 * ("Buscar cliente", "Buscar produto", etc.).
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: SearchBarProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;

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
      <Feather name="search" size={isTablet ? 18 : 16} color="#71717A" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A1A1AA"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel ?? placeholder}
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
