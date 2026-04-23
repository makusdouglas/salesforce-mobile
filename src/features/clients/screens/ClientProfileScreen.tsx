import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { SyncStatusIndicator } from '@/features/sync';

import { OrderHistoryList } from '../components/OrderHistoryList';
import { PendingSyncBadge } from '../components/PendingSyncBadge';
import { useClientOrderHistory } from '../hooks/useClientOrderHistory';
import { useObservableClient } from '../hooks/useObservableClient';
import { useViewport } from '../hooks/useViewport';

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

export function ClientProfileScreen({ navigation, route }: Props) {
  const { clientId } = route.params;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const client = useObservableClient(clientId);
  const history = useClientOrderHistory(clientId);

  const handleNewOrder = () => navigation.navigate('NewOrder', { clientId });
  const handleBack = () => navigation.goBack();

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

  const historySection = (
    <View style={styles.historyWrapper}>
      <Text style={styles.sectionHeader}>Pedidos</Text>
      <OrderHistoryList rows={history} viewport={viewport} />
    </View>
  );

  const cta = (
    <Pressable
      accessibilityRole="button"
      onPress={handleNewOrder}
      style={({ pressed }) => [
        styles.primaryButton,
        styles.ctaBase,
        isTablet ? styles.ctaTablet : styles.ctaPhone,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.primaryLabel}>Novo pedido</Text>
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
        <View style={styles.syncSlot}>
          <SyncStatusIndicator />
        </View>
      </View>

      {isTablet ? (
        <View style={styles.splitContainer}>
          <ScrollView
            style={styles.splitLeft}
            contentContainerStyle={styles.splitLeftContent}
          >
            {identity}
          </ScrollView>
          <View style={styles.splitRight}>
            <ScrollView contentContainerStyle={styles.splitRightContent}>
              {historySection}
            </ScrollView>
            <View style={styles.splitCtaBar}>{cta}</View>
          </View>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.phoneScroll}>
            {identity}
            {historySection}
          </ScrollView>
          <View style={styles.phoneCtaBar}>{cta}</View>
        </>
      )}
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
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  },
  splitLeft: {
    width: '45%',
    borderRightWidth: 1,
    borderRightColor: '#E4E4E7',
  },
  splitLeftContent: {
    padding: 24,
  },
  splitRight: {
    flex: 1,
    flexDirection: 'column',
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
  ctaBase: {
    paddingHorizontal: 24,
  },
  ctaPhone: {
    paddingVertical: 16,
  },
  ctaTablet: {
    paddingVertical: 14,
    minWidth: 240,
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
