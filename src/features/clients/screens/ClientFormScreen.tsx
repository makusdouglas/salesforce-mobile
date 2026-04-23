import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { clientsRepository, type ClientInput } from '@/data/repositories/clientsRepository';
import { onPullToRefresh, useSyncStatus } from '@/features/sync';

import { ClientFormFields } from '../components/ClientFormFields';
import * as cnpj from '../cnpj/cnpj';
import { splitContact } from '../contact/splitContact';
import { useActiveSalespersonId } from '../hooks/useActiveSalespersonId';
import { useClientDraft } from '../hooks/useClientDraft';
import { useViewport } from '../hooks/useViewport';

type Props = NativeStackScreenProps<HomeStackParamList, 'ClientForm'>;

function isSaveEnabled(name: string, taxId: string): boolean {
  return name.trim().length > 0 && cnpj.isValidFormat(taxId);
}

export function ClientFormScreen({ navigation }: Props) {
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const { draft, setDraft, clearDraft } = useClientDraft();
  const salesperson = useActiveSalespersonId();
  const { status: syncStatus } = useSyncStatus();
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const canSave =
    !saving && salesperson.status === 'ready' && isSaveEnabled(draft.name, draft.taxId);

  const handleSave = useCallback(async () => {
    if (salesperson.status !== 'ready') return;
    if (!isSaveEnabled(draft.name, draft.taxId)) return;
    setSaving(true);
    try {
      const { phone, email } = splitContact(draft.contact);
      const taxIdDigits = cnpj.normalize(draft.taxId);
      const addressTrim = draft.addressLine.trim();
      const notesTrim = draft.notes.trim();
      const input: ClientInput = {
        salespersonId: salesperson.salespersonId,
        name: draft.name.trim(),
      };
      if (taxIdDigits.length === 14) input.taxId = taxIdDigits;
      if (phone !== null) input.phone = phone;
      if (email !== null) input.email = email;
      if (addressTrim.length > 0) input.addressLine = addressTrim;
      if (notesTrim.length > 0) input.notes = notesTrim;
      await clientsRepository.create(input);
      clearDraft();
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [draft, salesperson, clearDraft, navigation]);

  const handleCancel = useCallback(() => {
    clearDraft();
    navigation.goBack();
  }, [clearDraft, navigation]);

  const handleSyncRetry = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await onPullToRefresh();
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  const blocked = salesperson.status === 'missing';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={handleCancel}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Novo cliente</Text>
        {isTablet ? (
          <View style={styles.topBarActions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleCancel}
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
            >
              <Text style={styles.ghostLabel}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!canSave}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.primaryButton,
                !canSave && styles.primaryButtonDisabled,
                pressed && canSave && styles.pressed,
              ]}
            >
              <Text style={styles.primaryLabel}>Salvar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.topBarSpacer} />
        )}
      </View>

      {blocked ? (
        <View style={styles.blockedContainer}>
          <View style={[styles.blockedCard, isTablet && styles.blockedCardTablet]}>
            <Text style={styles.blockedTitle}>Precisamos sincronizar primeiro</Text>
            <Text style={styles.blockedBody}>
              Conecte-se à internet para carregar sua conta e só então cadastrar
              clientes. Seus dados ficam seguros no dispositivo.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleSyncRetry}
              disabled={syncing || syncStatus === 'offline'}
              style={({ pressed }) => [
                styles.primaryButton,
                (syncing || syncStatus === 'offline') && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryLabel}>
                {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
              </Text>
            </Pressable>
            {syncStatus === 'offline' ? (
              <Text style={styles.blockedHint}>Sem internet no momento.</Text>
            ) : null}
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.avoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              isTablet && styles.scrollTablet,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <ClientFormFields draft={draft} onChange={setDraft} viewport={viewport} />
          </ScrollView>
          {!isTablet ? (
            <View style={styles.bottomBar}>
              <Pressable
                accessibilityRole="button"
                onPress={handleCancel}
                style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
              >
                <Text style={styles.ghostLabel}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!canSave}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.primaryButtonBottom,
                  !canSave && styles.primaryButtonDisabled,
                  pressed && canSave && styles.pressed,
                ]}
              >
                <Text style={styles.primaryLabel}>Salvar</Text>
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
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
    gap: 8,
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
  topBarSpacer: {
    width: 40,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  avoiding: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  scrollTablet: {
    paddingHorizontal: 48,
    paddingVertical: 32,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
  },
  ghostButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  ghostLabel: {
    color: '#52525B',
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#18181B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  primaryButtonBottom: {
    flex: 1,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryLabel: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
  },
  blockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  blockedCard: {
    width: '100%',
    maxWidth: 460,
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  blockedCardTablet: {
    maxWidth: 520,
    paddingVertical: 32,
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A0A0A',
    textAlign: 'center',
  },
  blockedBody: {
    fontSize: 14,
    color: '#52525B',
    lineHeight: 20,
    textAlign: 'center',
  },
  blockedHint: {
    fontSize: 12,
    color: '#71717A',
  },
});
