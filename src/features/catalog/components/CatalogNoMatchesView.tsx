import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';

export type CatalogNoMatchesViewProps = {
  onReset: () => void;
  viewport: Viewport;
};

export function CatalogNoMatchesView({ onReset, viewport }: CatalogNoMatchesViewProps) {
  const isTablet = viewport === 'tablet';

  return (
    <View style={styles.container}>
      <View style={styles.iconBox} />
      <Text style={[styles.heading, isTablet && styles.headingTablet]}>
        Nenhum produto encontrado
      </Text>
      <Text style={[styles.body, isTablet && styles.bodyTablet]}>
        Tente outra busca ou remova os filtros ativos.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onReset}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonLabel}>Limpar filtros</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#A1A1AA',
    marginBottom: 4,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
    textAlign: 'center',
  },
  headingTablet: {
    fontSize: 18,
  },
  body: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
  },
  bodyTablet: {
    fontSize: 14,
  },
  button: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '500',
  },
});
