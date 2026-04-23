// 011-order-email-delivery: terminal confirmation screen reached after the
// salesperson returns from the OS mail/share intent with a SENT outcome.
// See design/order-sent-phone.png + order-sent-tablet.png.

import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

  const handleDone = (): void => {
    navigation.getParent()?.navigate('ClientProfile', { clientId });
  };

  const sharedLabel = recipientEmail
    ? `PDF compartilhado via email · ${recipientEmail}`
    : 'PDF compartilhado — sem email cadastrado';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={[styles.body, isTablet && styles.bodyTablet]}>
        <View style={styles.checkCircle}>
          <Feather name="check" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.orderNumber}>{orderNumber}</Text>
        <Text style={styles.sharedLine}>{sharedLabel}</Text>
        {error !== null ? <Text style={styles.error}>⚠ {error}</Text> : null}
      </View>

      <View style={[styles.footer, isTablet && styles.footerTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver PDF salvo"
          onPress={() => void handleViewPdf()}
          disabled={busy}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.footerBtnSecondary,
            busy && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.footerBtnSecondaryText}>Ver PDF salvo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Concluir"
          onPress={handleDone}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.footerBtnPrimary,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.footerBtnPrimaryText}>Concluir</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  bodyTablet: { padding: 48 },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  orderNumber: { fontSize: 28, fontWeight: '700', color: '#0A0A0A' },
  sharedLine: {
    fontSize: 13,
    color: '#52525b',
    textAlign: 'center',
    maxWidth: 320,
  },
  error: { color: '#B91C1C', fontSize: 12, marginTop: 4 },
  footer: {
    padding: 16,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  footerTablet: { flexDirection: 'row', padding: 28 },
  footerBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnPrimary: { backgroundColor: '#0A0A0A' },
  footerBtnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  footerBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  footerBtnSecondaryText: { color: '#0A0A0A', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
