// 010-repeat-last-order: non-dismissable amber banner rendered at the top
// of OrderSummaryScreen when the repeat flow dropped one or more lines
// because their variant / parent product was soft-deleted (FR-007).
//
// Informational only — the list of lines left in the draft is still
// fully sendable. If the salesperson wants to add a replacement item they
// tap back into the draft editor (existing 009 flow).

import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export type DroppedItemsNoticeProps = {
  readonly names: readonly string[];
};

export function DroppedItemsNotice({ names }: DroppedItemsNoticeProps) {
  if (names.length === 0) return null;
  const heading =
    names.length === 1 ? '1 item indisponível' : `${names.length} itens indisponíveis`;
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Feather name="alert-triangle" size={16} color="#92400E" style={styles.icon} />
        <View style={styles.body}>
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.detail} numberOfLines={3}>
            {names.join(', ')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    marginTop: 1,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350F',
  },
  detail: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
});
