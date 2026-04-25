// 016-product-lifecycle-roles — Draft discontinued alert.
//
// Fires on open of a draft that references one or more now-inactive
// products. Listing is read-only (seller is offline-capable) — primary
// action removes the affected order_items; secondary closes the modal
// but leaves the send button disabled until the lines are cleared.
//
// Pencil reference: frames `A65W2` (phone) + `5w1q2` (tablet).

import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  productNames: readonly string[];
  busy: boolean;
  onRemoveAll: () => void;
  onDismiss: () => void;
};

export function DraftDiscontinuedAlert({
  visible,
  productNames,
  busy,
  onRemoveAll,
  onDismiss,
}: Props) {
  const count = productNames.length;
  const title =
    count === 1
      ? 'Um produto foi descontinuado'
      : `${count} produtos foram descontinuados`;
  const body =
    count === 0
      ? ''
      : productNames.length <= 3
        ? productNames.join(', ')
        : `${productNames.slice(0, 3).join(', ')} e mais ${productNames.length - 3}`;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={busy ? undefined : onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <View style={styles.icon}>
              <Text style={styles.iconGlyph}>!</Text>
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>
            {body}
            {body ? '. ' : ''}
            Remova essas linhas para enviar o pedido. Você pode desfazer
            adicionando o produto de novo se ele for reativado.
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={[styles.secondary, busy && styles.disabled]}
              onPress={busy ? undefined : onDismiss}
            >
              <Text style={styles.secondaryText}>Fechar</Text>
            </Pressable>
            <Pressable
              style={[styles.primary, busy && styles.disabled]}
              onPress={busy ? undefined : onRemoveAll}
            >
              {busy ? (
                <ActivityIndicator color="#FAFAFA" />
              ) : (
                <Text style={styles.primaryText}>Remover linhas e continuar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0A0A0AB3',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 14,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { color: '#B45309', fontSize: 22, fontWeight: '700' },
  title: {
    color: '#09090B',
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    color: '#52525B',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: { flexDirection: 'column', gap: 10, paddingTop: 6 },
  secondary: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#09090B', fontSize: 14, fontWeight: '500' },
  primary: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FAFAFA', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
