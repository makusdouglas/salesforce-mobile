import { StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';

export type OrderHistoryEmptyViewProps = {
  readonly viewport: Viewport;
};

export function OrderHistoryEmptyView({ viewport }: OrderHistoryEmptyViewProps) {
  const isTablet = viewport === 'tablet';
  return (
    <View style={[styles.card, isTablet && styles.cardTablet]}>
      <Text style={styles.text}>
        Nenhum pedido ainda. Toque em Novo pedido para começar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTablet: {
    paddingVertical: 32,
  },
  text: {
    fontSize: 14,
    color: '#52525B',
    textAlign: 'center',
  },
});
