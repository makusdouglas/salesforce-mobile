// 009-order-assembly: the yellow "Rascunho" status chip shown in the
// OrderDraft / OrderDraft-Tablet top bars.

import { StyleSheet, Text, View } from 'react-native';

export function OrderHeaderChip({ label = 'Rascunho' }: { label?: string }) {
  return (
    <View style={styles.chip}>
      <View style={styles.dot} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CA8A04',
  },
  text: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },
});
