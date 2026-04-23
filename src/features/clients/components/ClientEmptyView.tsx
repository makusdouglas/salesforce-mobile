import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';

export type ClientEmptyViewProps = {
  readonly onCreatePress: () => void;
  readonly viewport: Viewport;
};

export function ClientEmptyView({ onCreatePress, viewport }: ClientEmptyViewProps) {
  const isTablet = viewport === 'tablet';
  return (
    <View style={styles.container}>
      <View style={[styles.card, isTablet && styles.cardTablet]}>
        <Text style={styles.title}>Sua lista de clientes está vazia</Text>
        <Text style={styles.body}>
          Comece pelo primeiro cliente da sua rota. Você pode cadastrar sem
          internet — o envio acontece quando a conexão voltar.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onCreatePress}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonLabel}>Cadastrar primeiro cliente</Text>
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
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  cardTablet: {
    maxWidth: 520,
    paddingVertical: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A0A0A',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#52525B',
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#18181B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
  },
});
