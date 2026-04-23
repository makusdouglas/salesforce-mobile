import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';

export type ClientNoMatchesViewProps = {
  readonly onReset: () => void;
  readonly viewport: Viewport;
};

export function ClientNoMatchesView({ onReset, viewport }: ClientNoMatchesViewProps) {
  const isTablet = viewport === 'tablet';
  return (
    <View style={styles.container}>
      <View style={[styles.card, isTablet && styles.cardTablet]}>
        <Text style={styles.title}>Nenhum cliente encontrado</Text>
        <Text style={styles.body}>
          Tente outro termo de busca ou remova os filtros ativos.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onReset}
          style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
        >
          <Text style={styles.ghostLabel}>Limpar busca</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  cardTablet: {
    maxWidth: 520,
    paddingVertical: 32,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#52525B',
    textAlign: 'center',
    lineHeight: 20,
  },
  ghostButton: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
  ghostLabel: {
    color: '#18181B',
    fontSize: 13,
    fontWeight: '600',
  },
});
