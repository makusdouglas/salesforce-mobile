// 017-revenue-dashboard — generic empty-state copy block used inside
// any panel that has no data. Salesperson-language Portuguese (UX3).

import { StyleSheet, Text, View } from 'react-native';

export interface PanelEmptyStateProps {
  readonly message: string;
}

export function PanelEmptyState({ message }: PanelEmptyStateProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#737373',
    fontFamily: 'Geist',
    fontSize: 12,
    textAlign: 'center',
  },
});
