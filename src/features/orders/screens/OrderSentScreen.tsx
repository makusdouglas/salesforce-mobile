// 011-order-email-delivery: terminal confirmation screen reached after the
// salesperson returns from the OS mail/share intent with a SENT outcome.
// Layout is pixel-locked to Pencil frames K99dc (phone) and qWpse (tablet).
//
// The native back button is disabled for this route (see OrdersStack) so
// the only way out is the Concluir CTA (or the top-bar chevron, which
// aliases Concluir) — prevents accidentally landing back in the draft
// editor of the order the salesperson just sent.

import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrdersStackParamList } from '@/app/navigation/types';

import { useViewport } from '../hooks/useViewport';
import { openStoredPdf } from '../send/openStoredPdf';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderSent'>;

export function OrderSentScreen({ navigation, route }: Props) {
  const { orderId, orderNumber, recipientEmail, clientId } = route.params;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Swallow Android hardware back presses — the only exit is Concluir.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleViewPdf = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await openStoredPdf(orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  // Exit path: land the salesperson on the client's profile. Same target
  // for the top-bar chevron and the "Concluir" primary CTA.
  //
  // We `reset` the parent HomeStack history to [Home, ClientProfile]
  // instead of `navigate`. A plain navigate keeps the Orders route in
  // the stack, so the Android/system back button from ClientProfile
  // would drop the salesperson back into OrderSent — a terminal screen
  // that deliberately disables its own back. That created a loop the
  // only escape from which was killing the app.
  const handleDone = (): void => {
    const parent = navigation.getParent();
    if (!parent) return;
    parent.reset({
      index: 1,
      routes: [
        { name: 'HomePlaceholder' },
        { name: 'ClientProfile', params: { clientId } },
      ],
    });
  };

  // pt-BR relative timestamp for the meta line. The screen is rendered
  // immediately after the send intent returns, so "há instantes" is
  // always accurate — we don't ticker-update it.
  const whenLabel = 'há instantes';
  const metaTitle = recipientEmail
    ? 'PDF compartilhado via email'
    : 'PDF compartilhado — sem email cadastrado';
  const metaSub = recipientEmail ? `${recipientEmail} · ${whenLabel}` : whenLabel;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={handleDone}
          hitSlop={12}
          style={({ pressed }) => [styles.topIcon, pressed && styles.pressed]}
        >
          <Feather name="arrow-left" size={22} color="#0A0A0A" />
        </Pressable>
        <Text style={styles.topTitle}>Pedido enviado</Text>
        <View style={styles.topIcon} />
      </View>

      <View style={styles.body}>
        <View style={styles.okCircle}>
          <Feather name="check" size={40} color="#166534" />
        </View>
        <View style={styles.headGroup}>
          <Text style={styles.headTitle}>Pedido enviado</Text>
          <Text style={styles.headNumber}>{orderNumber}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaTitle}>{metaTitle}</Text>
          <Text style={styles.metaSub}>{metaSub}</Text>
        </View>
        {error !== null ? <Text style={styles.error}>⚠ {error}</Text> : null}
      </View>

      <View style={[styles.ctaCol, isTablet && styles.ctaColTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver PDF salvo"
          onPress={() => void handleViewPdf()}
          disabled={busy}
          style={({ pressed }) => [
            styles.ctaBtn,
            styles.ctaBtnSecondary,
            isTablet && styles.ctaBtnTablet,
            busy && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="file-text" size={15} color="#0A0A0A" />
          <Text style={styles.ctaBtnSecondaryText}>Ver PDF salvo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Concluir"
          onPress={handleDone}
          style={({ pressed }) => [
            styles.ctaBtn,
            styles.ctaBtnPrimary,
            isTablet && styles.ctaBtnTablet,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.ctaBtnPrimaryText}>Concluir</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  okCircle: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headGroup: {
    alignItems: 'center',
    gap: 6,
  },
  headTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  headNumber: {
    fontSize: 13,
    fontWeight: '500',
    color: '#737373',
    fontVariant: ['tabular-nums'],
  },
  meta: {
    alignItems: 'center',
    gap: 4,
  },
  metaTitle: {
    fontSize: 14,
    color: '#404040',
    textAlign: 'center',
  },
  metaSub: {
    fontSize: 12,
    color: '#737373',
    textAlign: 'center',
  },
  error: { color: '#B91C1C', fontSize: 12, marginTop: 4 },
  ctaCol: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  ctaColTablet: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 28,
  },
  ctaBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  ctaBtnTablet: {
    width: 260,
  },
  ctaBtnPrimary: { backgroundColor: '#171717' },
  ctaBtnPrimaryText: {
    color: '#FAFAFA',
    fontSize: 13,
    fontWeight: '600',
  },
  ctaBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  ctaBtnSecondaryText: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '600',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
