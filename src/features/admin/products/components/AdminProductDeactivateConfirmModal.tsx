import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { listDraftsUsingProduct } from '../service/productsApi';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Props = {
  visible: boolean;
  productId: string;
  productName: string;
  isReactivating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  errorMessage: string | null;
};

/**
 * AdminProductDeactivateConfirmModal — matches the Pencil frame
 * `3kyN7` / `evhGY`. On open, fetches the number of drafts that
 * currently include the product (FR-003) and surfaces it in the body.
 * Reactivation reuses the same modal with "Ativar" copy and no draft
 * count (not relevant on reactivation).
 */
export function AdminProductDeactivateConfirmModal({
  visible,
  productId,
  productName,
  isReactivating,
  onCancel,
  onConfirm,
  busy,
  errorMessage,
}: Props) {
  const [draftCount, setDraftCount] = useState<number | 'loading' | 'error'>('loading');

  useEffect(() => {
    if (!visible || isReactivating) {
      setDraftCount(0);
      return;
    }
    let cancelled = false;
    setDraftCount('loading');
    listDraftsUsingProduct(productId)
      .then((count) => {
        if (!cancelled) setDraftCount(count);
      })
      .catch(() => {
        if (!cancelled) setDraftCount('error');
      });
    return () => {
      cancelled = true;
    };
  }, [visible, productId, isReactivating]);

  const title = isReactivating ? 'Reativar este produto?' : 'Desativar este produto?';
  const primaryLabel = isReactivating ? 'Ativar' : 'Desativar';
  const body = buildBody({ isReactivating, productName, draftCount });

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
            <View
              style={[
                styles.icon,
                isReactivating ? styles.iconReactivate : styles.iconDeactivate,
              ]}
            >
              <Text
                style={[
                  styles.iconGlyph,
                  isReactivating ? styles.iconGlyphReactivate : styles.iconGlyphDeactivate,
                ]}
              >
                {isReactivating ? '✓' : '!'}
              </Text>
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              style={[styles.cancel, busy && styles.disabled]}
              onPress={busy ? undefined : onCancel}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirm,
                isReactivating ? styles.confirmReactivate : styles.confirmDeactivate,
                busy && styles.disabled,
              ]}
              onPress={busy ? undefined : onConfirm}
            >
              {busy ? (
                <ActivityIndicator color="#FAFAFA" />
              ) : (
                <Text style={styles.confirmText}>{primaryLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function buildBody({
  isReactivating,
  productName,
  draftCount,
}: {
  isReactivating: boolean;
  productName: string;
  draftCount: number | 'loading' | 'error';
}): string {
  if (isReactivating) {
    return `${productName} volta a aparecer no catálogo dos vendedores na próxima sincronização.`;
  }
  if (draftCount === 'loading') {
    return `Verificando rascunhos que usam ${productName}…`;
  }
  if (draftCount === 'error') {
    return `Vendedores não poderão mais adicionar ${productName} a pedidos. Você pode reativar depois.`;
  }
  if (draftCount === 0) {
    return `Nenhum rascunho em aberto usa ${productName}. Vendedores não poderão mais adicioná-lo. Você pode reativar depois.`;
  }
  const suffix = draftCount === 1 ? 'rascunho aberto usa' : 'rascunhos abertos usam';
  return `${draftCount} ${suffix} ${productName}. Esses pedidos serão bloqueados até o vendedor remover as linhas. Você pode reativar depois.`;
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
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.card,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDeactivate: { backgroundColor: '#FEE2E2' },
  iconReactivate: { backgroundColor: '#DCFCE7' },
  iconGlyph: { fontSize: 22, fontWeight: '700' },
  iconGlyphDeactivate: { color: '#B91C1C' },
  iconGlyphReactivate: { color: '#166534' },
  title: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: '#B91C1C',
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'column',
    gap: 10,
    paddingTop: 8,
  },
  cancel: {
    height: 44,
    borderRadius: adminRadii.control,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
  confirm: {
    height: 44,
    borderRadius: adminRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeactivate: { backgroundColor: '#B91C1C' },
  confirmReactivate: { backgroundColor: '#166534' },
  confirmText: {
    color: '#FAFAFA',
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: { opacity: 0.6 },
});
