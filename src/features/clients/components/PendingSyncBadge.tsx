import { StyleSheet, Text, View } from 'react-native';

export type PendingSyncBadgeProps = {
  readonly visible: boolean;
};

/**
 * Discreet per-row "Aguardando envio" indicator. Rendered only when visible
 * so callers can pass `client.isPendingSync` unconditionally.
 */
export function PendingSyncBadge({ visible }: PendingSyncBadgeProps) {
  if (!visible) return null;
  return (
    <View style={styles.pill} accessibilityLabel="Aguardando envio">
      <View style={styles.dot} />
      <Text style={styles.label}>Envio pendente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#92400E',
  },
});
