import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/app/ui/modal';
import type { HomeStackParamList } from '@/app/navigation/types';
import { RepeatOrderDiscontinuedAlert } from '@/features/orders/components/RepeatOrderDiscontinuedAlert';
import { useRepeatOrder } from '@/features/orders/hooks/useRepeatOrder';
import { SyncStatusIndicator } from '@/features/sync';

import { AllUnavailableNotice } from '../components/AllUnavailableNotice';
import { OrderHistoryList } from '../components/OrderHistoryList';
import { PendingSyncBadge } from '../components/PendingSyncBadge';
import { RepeatHeroCard } from '../components/RepeatHeroCard';
import { RepeatIconButton } from '../components/RepeatIconButton';
import { useClientOrderHistory } from '../hooks/useClientOrderHistory';
import { useLastSentOrderSummary } from '../hooks/useLastSentOrderSummary';
import { useObservableClient } from '../hooks/useObservableClient';
import { useViewport } from '../hooks/useViewport';
import { type OrderHistoryRowDTO } from '../types';

type Props = NativeStackScreenProps<HomeStackParamList, 'ClientProfile'>;

const PLACEHOLDER = '—';

function formatCnpj(taxId: string | null): string {
  if (taxId === null) return PLACEHOLDER;
  const d = taxId.replace(/\D/g, '');
  if (d.length !== 14) return taxId;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatContact(phone: string | null, email: string | null): string {
  const parts = [phone, email].filter((v): v is string => v !== null && v.trim().length > 0);
  if (parts.length === 0) return PLACEHOLDER;
  return parts.join('  ·  ');
}

// 010-repeat-last-order: local blocked-state tracking for the "all items
// unavailable" branch (FR-008). `hero` blocks appear in place of the hero
// card; per-row blocks appear directly below the offending row.
type BlockedKey = { readonly kind: 'hero' } | { readonly kind: 'row'; readonly orderId: string };

export function ClientProfileScreen({ navigation, route }: Props) {
  const { clientId } = route.params;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const client = useObservableClient(clientId);
  const history = useClientOrderHistory(clientId);
  const lastSent = useLastSentOrderSummary(clientId);
  const { repeat, preview } = useRepeatOrder();
  const [blocked, setBlocked] = useState<BlockedKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [repeatTarget, setRepeatTarget] = useState<BlockedKey | null>(null);
  // 016-product-lifecycle-roles — pre-clone confirmation for repeats
  // whose source contains discontinued products. null = not shown.
  const [discontinuedState, setDiscontinuedState] = useState<{
    sourceOrderId: string;
    key: BlockedKey;
    discontinuedNames: string[];
    clonableCount: number;
  } | null>(null);

  // 009-order-assembly: "Novo pedido em branco" enters the OrdersStack.
  const handleNewOrder = () =>
    navigation.navigate('Orders', {
      screen: 'OrderDraft',
      params: { clientId },
    });
  const handleBack = () => navigation.goBack();

  // 010-repeat-last-order: shared repeat handler used by the hero CTA AND
  // by every per-row ↺ button. Navigates to OrderSummary on success, or
  // sets local blocked state on "all unavailable".
  const runRepeat = async (sourceOrderId: string, key: BlockedKey) => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await repeat(sourceOrderId);
      if (outcome.kind === 'landed') {
        setBlocked(null);
        navigation.navigate('Orders', {
          screen: 'OrderSummary',
          params: { orderId: outcome.orderId, droppedNames: outcome.droppedNames },
        });
      } else if (outcome.kind === 'blocked') {
        setBlocked(key);
      }
      // 'error' is rare (source disappeared mid-tap); silently ignore for MVP.
    } finally {
      setBusy(false);
    }
  };

  const handleHeroRepeat = () => {
    if (!lastSent) return;
    setRepeatTarget({ kind: 'hero' });
  };

  const handleRowRepeat = (row: OrderHistoryRowDTO) => {
    setRepeatTarget({ kind: 'row', orderId: row.id });
  };

  const cancelRepeat = () => setRepeatTarget(null);

  const confirmRepeat = () => {
    if (!repeatTarget) return;
    const target = repeatTarget;
    setRepeatTarget(null);
    const sourceOrderId =
      target.kind === 'hero' ? lastSent?.orderId : target.orderId;
    if (!sourceOrderId) return;
    // 016 — preview first; if any line is discontinued, route through
    // RepeatOrderDiscontinuedAlert (FR-012). Otherwise clone directly.
    void (async () => {
      if (busy) return;
      setBusy(true);
      try {
        const outcome = await preview(sourceOrderId);
        if (outcome.kind === 'error') return;
        if (outcome.kind === 'resume') {
          await runRepeat(sourceOrderId, target);
          return;
        }
        if (outcome.preview.discontinuedProductNames.length > 0) {
          setDiscontinuedState({
            sourceOrderId,
            key: target,
            discontinuedNames: outcome.preview.discontinuedProductNames,
            clonableCount: outcome.preview.clonableCount,
          });
          return;
        }
        // No discontinued lines — proceed as before.
        await runRepeat(sourceOrderId, target);
      } finally {
        setBusy(false);
      }
    })();
  };

  const confirmDiscontinuedRepeat = () => {
    if (!discontinuedState) return;
    const { sourceOrderId, key } = discontinuedState;
    setDiscontinuedState(null);
    void runRepeat(sourceOrderId, key);
  };

  const cancelDiscontinuedRepeat = () => setDiscontinuedState(null);

  if (client === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>Cliente</Text>
          <View style={styles.topSpacer} />
        </View>
        <View style={styles.missingContainer}>
          <Text style={styles.missingTitle}>Cliente indisponível</Text>
          <Text style={styles.missingBody}>
            Este cliente pode ter sido removido pelo admin. Volte para a lista.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleBack}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isPendingSync =
    (client as unknown as { _raw?: { _status?: string } })._raw?._status !== 'synced';

  const identity = (
    <View style={styles.identityCard}>
      <View style={styles.identityHeader}>
        <Text style={styles.clientName} numberOfLines={2}>
          {client.name}
        </Text>
        <PendingSyncBadge visible={isPendingSync} />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>CNPJ</Text>
        <Text style={styles.fieldValue}>{formatCnpj(client.taxId)}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Endereço</Text>
        <Text style={styles.fieldValue}>{client.addressLine ?? PLACEHOLDER}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Contato</Text>
        <Text style={styles.fieldValue}>{formatContact(client.phone, client.email)}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Observações</Text>
        <Text style={styles.fieldValue}>{client.notes ?? PLACEHOLDER}</Text>
      </View>
    </View>
  );

  const hero =
    blocked?.kind === 'hero' ? (
      <AllUnavailableNotice onDismiss={() => setBlocked(null)} />
    ) : (
      <RepeatHeroCard
        lastSent={lastSent}
        viewport={viewport}
        onPress={handleHeroRepeat}
        busy={busy}
      />
    );

  const historyCount = history.length;
  const historySection = (
    <View style={styles.historyWrapper}>
      <View style={styles.historyHeader}>
        <Text style={styles.sectionHeader}>Histórico de pedidos</Text>
        {historyCount > 0 ? (
          <Text style={styles.sectionHeaderCount}>
            {historyCount} {historyCount === 1 ? 'pedido' : 'pedidos'}
          </Text>
        ) : null}
      </View>
      <OrderHistoryList
        rows={history}
        viewport={viewport}
        renderRowTrailing={(row) => (
          <RepeatIconButton
            dim={row.status === 'canceled'}
            onPress={() => handleRowRepeat(row)}
          />
        )}
        renderBelowRow={(row) =>
          blocked?.kind === 'row' && blocked.orderId === row.id ? (
            <AllUnavailableNotice onDismiss={() => setBlocked(null)} />
          ) : null
        }
        onRowPress={(row) => {
          // Tap dispatch by status (013-orders-overview):
          //   draft    → resume the draft in the editor.
          //   sent     → new read-only OrderDetail, deep-linked so the
          //              tablet variant uses the full-screen layout
          //              (not the split panel, which only applies when
          //              the detail is reached from OrdersOverview).
          //              The receipts section inside OrderDetail still
          //              links through to OrderReceipts for the full
          //              list + new-receipt CTA — nothing is lost.
          //   canceled → same OrderDetail screen, deep-linked.
          if (row.status === 'draft') {
            navigation.navigate('Orders', {
              screen: 'OrderDraft',
              params: { orderId: row.id },
            });
            return;
          }
          navigation.navigate('Orders', {
            screen: 'OrderDetail',
            params: { orderId: row.id, deepLinked: true },
          });
        }}
      />
    </View>
  );

  // 010-repeat-last-order: the original dark "Novo pedido" is demoted to
  // a secondary outline button ("Novo pedido em branco") so the repeat
  // affordances dominate visually when history exists.
  const cta = (
    <Pressable
      accessibilityRole="button"
      onPress={handleNewOrder}
      style={({ pressed }) => [
        styles.secondaryButton,
        styles.ctaBase,
        isTablet ? styles.ctaTablet : styles.ctaPhone,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.secondaryLabel, isTablet && styles.secondaryLabelTablet]}>
        Novo pedido em branco
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {client.name}
        </Text>
        {isTablet ? (
          <View style={styles.topBarActions}>
            <View style={styles.syncSlotTablet}>
              <SyncStatusIndicator />
            </View>
            {cta}
          </View>
        ) : (
          <View style={styles.syncSlot}>
            <SyncStatusIndicator />
          </View>
        )}
      </View>

      {isTablet ? (
        <View style={styles.splitContainer}>
          <View style={styles.splitLeft}>
            <ScrollView
              style={styles.splitLeftScroll}
              contentContainerStyle={styles.splitLeftContent}
            >
              {identity}
            </ScrollView>
          </View>
          <View style={styles.splitRight}>
            <ScrollView contentContainerStyle={styles.splitRightContent}>
              {hero}
              {historySection}
            </ScrollView>
          </View>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.phoneScroll}>
            {identity}
            {hero}
            {historySection}
          </ScrollView>
          <View style={styles.phoneCtaBar}>{cta}</View>
        </>
      )}

      <ConfirmModal
        open={repeatTarget !== null}
        title="Repetir pedido"
        body="Um novo rascunho será criado com os mesmos itens e preços atuais do catálogo. Você ainda poderá revisar antes de enviar."
        cancelLabel="Cancelar"
        primaryLabel="Criar rascunho"
        onCancel={cancelRepeat}
        onPrimary={confirmRepeat}
      />
      <RepeatOrderDiscontinuedAlert
        visible={discontinuedState !== null}
        discontinuedNames={discontinuedState?.discontinuedNames ?? []}
        clonableCount={discontinuedState?.clonableCount ?? 0}
        busy={busy}
        onConfirm={confirmDiscontinuedRepeat}
        onCancel={cancelDiscontinuedRepeat}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBar: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  topBarTablet: {
    paddingHorizontal: 24,
    height: 64,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  backChevron: {
    fontSize: 32,
    color: '#0A0A0A',
    marginTop: -4,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  topSpacer: {
    width: 40,
  },
  syncSlot: {
    width: 40,
    alignItems: 'flex-end',
  },
  syncSlotTablet: {
    // Room for the full "Dados em dia" label + dot without wrapping.
    // No trailing padding — the CTA now sits to the right of the pill,
    // so the gap lives on `topBarActions`.
    minWidth: 0,
    alignItems: 'center',
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  identityHeader: {
    gap: 6,
  },
  clientName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  field: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#0A0A0A',
    lineHeight: 20,
  },
  historyWrapper: {
    gap: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionHeaderCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#A1A1AA',
  },
  phoneScroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  phoneCtaBar: {
    padding: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  splitLeft: {
    width: '45%',
    borderRightWidth: 1,
    borderRightColor: '#E4E4E7',
    overflow: 'hidden',
  },
  splitLeftScroll: {
    flex: 1,
  },
  splitLeftContent: {
    padding: 24,
    paddingBottom: 40,
  },
  splitRight: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  splitRightContent: {
    padding: 24,
    gap: 16,
  },
  splitCtaBar: {
    padding: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
    alignItems: 'flex-end',
  },
  primaryButton: {
    backgroundColor: '#18181B',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 010-repeat-last-order: demoted "Novo pedido em branco" outline variant.
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4D4D8',
  },
  secondaryLabel: {
    color: '#18181B',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryLabelTablet: {
    fontSize: 13,
  },
  ctaBase: {
    paddingHorizontal: 24,
  },
  ctaPhone: {
    paddingVertical: 16,
  },
  ctaTablet: {
    // Compact header-inline sizing — matches the top-bar height.
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 0,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  primaryLabel: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '600',
  },
  missingContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A0A0A',
    textAlign: 'center',
  },
  missingBody: {
    fontSize: 14,
    color: '#52525B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
