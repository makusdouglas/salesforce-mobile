import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';

import { useObservableClient } from '../hooks/useObservableClient';
import { useViewport } from '../hooks/useViewport';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewOrder'>;

/**
 * Hand-off boundary for the future orders feature (008). Route name and
 * param shape are locked by contracts/order-history.md — 008 swaps this
 * component out without touching the navigation edge.
 */
export function NewOrderStubScreen({ navigation, route }: Props) {
  const { clientId } = route.params;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const client = useObservableClient(clientId);

  const handleBack = () => navigation.goBack();

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
        <Text style={styles.title}>Novo pedido</Text>
        <View style={styles.spacer} />
      </View>
      <View style={styles.content}>
        <View style={[styles.card, isTablet && styles.cardTablet]}>
          <Text style={styles.heading}>
            {client !== null
              ? `Preparando pedido para ${client.name}`
              : 'Cliente não encontrado'}
          </Text>
          <Text style={styles.body}>
            {client !== null
              ? 'Módulo de pedidos em breve (feature 008). O rascunho abrirá nesta tela assim que o módulo for entregue.'
              : 'Este cliente pode ter sido removido. Volte para a lista.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleBack}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>Voltar para o cliente</Text>
          </Pressable>
        </View>
      </View>
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
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  spacer: {
    width: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    gap: 16,
    alignItems: 'center',
  },
  cardTablet: {
    maxWidth: 520,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A0A0A',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#52525B',
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#18181B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
  },
});
