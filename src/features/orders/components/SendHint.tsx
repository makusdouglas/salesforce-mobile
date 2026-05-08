// 011-order-email-delivery: inline hint above the send button. Reads the
// SAME `isLikelyEmail` the service uses (U1), so the copy and the routing
// decision can never disagree.

import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { isLikelyEmail } from '../send/clientSlug';

export type SendHintProps = {
  readonly recipientEmail: string | null;
  readonly itemCount: number;
};

export function SendHint({ recipientEmail, itemCount }: SendHintProps) {
  let icon: 'mail' | 'share-2' | 'info' = 'mail';
  let copy = '';
  if (itemCount === 0) {
    icon = 'info';
    copy = 'Adicione itens para enviar';
  } else if (isLikelyEmail(recipientEmail)) {
    icon = 'mail';
    copy = `PDF + email para ${recipientEmail}`;
  } else {
    icon = 'share-2';
    copy = 'Compartilhar PDF — sem email cadastrado';
  }
  return (
    <View style={styles.wrapper}>
      <Feather name={icon} size={14} color="#52525b" style={styles.icon} />
      <Text style={styles.text} numberOfLines={1}>
        {copy}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  icon: { marginTop: 1 },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#52525b',
  },
});
