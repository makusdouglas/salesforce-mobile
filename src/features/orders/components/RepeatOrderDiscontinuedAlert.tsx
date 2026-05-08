// 016-product-lifecycle-roles — pre-clone confirmation for a "Repeat
// last order" that references one or more discontinued products.
// The seller MUST acknowledge before the clone proceeds — lines are
// NEVER silently dropped (FR-012). When `clonableCount === 0` the
// primary action is disabled and only Cancel is available (FR-013).
//
// Pencil reference: frames `boQMF` (phone) + `Yp9ot` (tablet).

import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  discontinuedNames: readonly string[];
  clonableCount: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RepeatOrderDiscontinuedAlert({
  visible,
  discontinuedNames,
  clonableCount,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const canProceed = clonableCount > 0;
  const list =
    discontinuedNames.length <= 3
      ? discontinuedNames.join(', ')
      : `${discontinuedNames.slice(0, 3).join(', ')} e mais ${discontinuedNames.length - 3}`;
  const body = canProceed
    ? `${list} ${discontinuedNames.length === 1 ? 'foi descontinuado e não será' : 'foram descontinuados e não serão'} copiados. Continuar com ${clonableCount} ${clonableCount === 1 ? 'item ativo' : 'itens ativos'}?`
    : `${list} ${discontinuedNames.length === 1 ? 'foi descontinuado' : 'foram descontinuados'}. Não há itens ativos para copiar.`;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={busy ? undefined : onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <View style={styles.icon}>
              <Text style={styles.iconGlyph}>!</Text>
            </View>
          </View>
          <Text style={styles.title}>Alguns produtos foram descontinuados</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <Pressable
              style={[styles.secondary, busy && styles.disabled]}
              onPress={busy ? undefined : onCancel}
            >
              <Text style={styles.secondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primary,
                (!canProceed || busy) && styles.disabled,
              ]}
              onPress={canProceed && !busy ? onConfirm : undefined}
            >
              {busy ? (
                <ActivityIndicator color="#FAFAFA" />
              ) : (
                <Text style={styles.primaryText}>
                  {canProceed ? 'Continuar com ativos' : 'Sem itens para copiar'}
                </Text>
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
  body: { color: '#52525B', fontSize: 13, lineHeight: 18 },
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
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FAFAFA', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
