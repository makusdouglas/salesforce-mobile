// 010-repeat-last-order: inline notice rendered on ClientProfileScreen when
// ordersService.repeat throws AllItemsUnavailableError (FR-008). Not a modal
// — the feature explicitly forbids modal-alert patterns.
//
// Copy pinned by FR-008 — do not change without updating the spec.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type AllUnavailableNoticeProps = {
  readonly onDismiss: () => void;
};

const MESSAGE =
  'Este pedido não pode ser repetido — nenhum dos itens está disponível.';

export function AllUnavailableNotice({ onDismiss }: AllUnavailableNoticeProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Feather name="alert-triangle" size={16} color="#92400E" style={styles.icon} />
        <Text style={styles.body}>{MESSAGE}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          onPress={onDismiss}
          hitSlop={8}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
        >
          <Feather name="x" size={16} color="#92400E" />
        </Pressable>
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
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  dismiss: {
    paddingHorizontal: 6,
    paddingVertical: 0,
  },
  pressed: {
    opacity: 0.6,
  },
});
