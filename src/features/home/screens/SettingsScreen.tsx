import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Updates from 'expo-updates';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { colors } from '@/app/theme/colors';
import { ConfirmModal } from '@/app/ui/modal';
import { authService, roleBadge, useRoles, useSession } from '@/features/auth';
import { useActiveSalespersonId } from '@/features/clients';
import { lockService } from '@/features/lock';

import { useActiveSalespersonName } from '../hooks/useActiveSalespersonName';

type Props = NativeStackScreenProps<HomeStackParamList, 'Settings'>;

const TIMEOUT_OPTIONS: readonly number[] = [1, 5, 10, 30];

export function SettingsScreen({ navigation }: Props) {
  const { email } = useSession();
  const activeSp = useActiveSalespersonId();
  const salespersonName = useActiveSalespersonName(activeSp.salespersonId);
  // 016-product-lifecycle-roles — surface the signed-in user's active
  // roles (FR-026). Zero-role users see a friendly empty line, not a
  // blank section, so the absence is explicit.
  const roles = useRoles();
  // Deduplicate admin/superuser (the legacy alias renders as the same
  // "Super usuário" badge) so users migrated mid-rollout don't see two
  // identical chips.
  const uniqueRoleLabels: { key: string; label: string; style: 'default' | 'secondary' | 'destructive' }[] = [];
  const seen = new Set<string>();
  for (const r of roles) {
    const badge = roleBadge(r);
    const k = `${badge.label}:${badge.style}`;
    if (!seen.has(k)) {
      seen.add(k);
      uniqueRoleLabels.push({ key: r, label: badge.label, style: badge.style });
    }
  }

  const [selectedMinutes, setSelectedMinutes] = useState<number>(
    lockService.getInactivityTimeout(),
  );
  const [logoutOpen, setLogoutOpen] = useState<boolean>(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  const handleCheckUpdate = useCallback(async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    setUpdateStatus('Buscando atualizações...');
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setUpdateStatus('Atualização encontrada. Baixando...');
        await Updates.fetchUpdateAsync();
        setUpdateStatus('Reiniciando aplicativo...');
        await Updates.reloadAsync();
      } else {
        setUpdateStatus('O aplicativo já está na versão mais recente.');
        setTimeout(() => setUpdateStatus(null), 3000);
      }
    } catch (error) {
      setUpdateStatus(`Erro: ${error instanceof Error ? error.message : String(error)}`);
      setTimeout(() => setUpdateStatus(null), 5000);
    } finally {
      setCheckingUpdate(false);
    }
  }, [checkingUpdate]);

  const selectMinutes = useCallback((minutes: number): void => {
    setSelectedMinutes((previous) => {
      void lockService.setInactivityTimeout(minutes).catch(() => {
        setSelectedMinutes(previous);
      });
      return minutes;
    });
  }, []);

  const openLogout = useCallback(() => setLogoutOpen(true), []);
  const cancelLogout = useCallback(() => setLogoutOpen(false), []);
  const confirmLogout = useCallback(() => {
    setLogoutOpen(false);
    void authService.logout();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.identityCard}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {salespersonName ? salespersonName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.identityName}>{salespersonName || 'Vendedor'}</Text>
            <Text style={styles.identityEmail}>{email}</Text>
          </View>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Suas funções</Text>
          <View style={styles.rolesRow}>
            {uniqueRoleLabels.length === 0 ? (
              <Text style={styles.rolesEmpty}>Sem funções atribuídas.</Text>
            ) : (
              uniqueRoleLabels.map((r) => (
                <View
                  key={r.key}
                  style={[
                    styles.roleChip,
                    r.style === 'destructive' && styles.roleChipDestructive,
                    r.style === 'secondary' && styles.roleChipSecondary,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      r.style === 'destructive' && styles.roleChipTextDestructive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Segurança</Text>
          <View style={styles.settingsBlock}>
            <Text style={styles.settingsLabel}>Bloquear app após inatividade</Text>
            <View style={styles.segmentRow}>
              {TIMEOUT_OPTIONS.map((minutes) => {
                const active = minutes === selectedMinutes;
                return (
                  <Pressable
                    key={minutes}
                    accessibilityRole="button"
                    onPress={() => selectMinutes(minutes)}
                    style={({ pressed }) => [
                      styles.segmentButton,
                      active ? styles.segmentButtonActive : styles.segmentButtonInactive,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={active ? styles.segmentLabelActive : styles.segmentLabelInactive}>
                      {minutes} min
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Sistema (OTA)</Text>
          <View style={styles.settingsBlock}>
            <Text style={styles.settingsLabel}>
              Versão: {Updates.updateId ? Updates.updateId.substring(0, 8) : 'Build nativa local'}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.segmentButton,
                styles.segmentButtonInactive,
                pressed && styles.buttonPressed,
                checkingUpdate && styles.disabled,
              ]}
              onPress={() => void handleCheckUpdate()}
              disabled={checkingUpdate}
            >
              <Text style={styles.segmentLabelInactive}>
                {checkingUpdate ? 'Buscando...' : 'Buscar atualizações'}
              </Text>
            </Pressable>
            {updateStatus ? (
              <Text style={styles.updateStatusText}>{updateStatus}</Text>
            ) : null}
          </View>
        </View>

        {__DEV__ ? (
          <View style={styles.settingsCard}>
            <Text style={styles.sectionTitle}>[dev] Ferramentas</Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.devButton, pressed && styles.buttonPressed]}
              onPress={() => navigation.navigate('DatabaseInspector')}
            >
              <Text style={styles.devButtonLabel}>DB Inspector</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.devButton, pressed && styles.buttonPressed]}
              onPress={() => navigation.navigate('SyncInspector')}
            >
              <Text style={styles.devButtonLabel}>Sync Inspector</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}
            onPress={openLogout}
          >
            <Text style={styles.logoutLabel}>Sair da conta</Text>
          </Pressable>
        </View>

      </ScrollView>

      <ConfirmModal
        open={logoutOpen}
        title="Sair da conta"
        body="Seus dados permanecem no dispositivo. Você pode entrar novamente a qualquer momento."
        cancelLabel="Cancelar"
        primaryLabel="Sair"
        primaryVariant="destructive"
        onCancel={cancelLogout}
        onPrimary={confirmLogout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA', // Match other screen backgrounds
  },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rolesEmpty: { color: '#71717A', fontSize: 13, fontStyle: 'italic' },
  roleChip: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipSecondary: { backgroundColor: '#E4E4E7' },
  roleChipDestructive: { backgroundColor: '#FEE2E2' },
  roleChipText: { color: '#18181B', fontSize: 12, fontWeight: '600' },
  roleChipTextDestructive: { color: '#B91C1C' },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 20,
  },
  identityCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '600',
    color: '#18181B',
  },
  identityText: {
    flex: 1,
    gap: 4,
  },
  identityName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  identityEmail: {
    fontSize: 14,
    color: '#71717A',
  },
  settingsCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  settingsBlock: {
    gap: 12,
  },
  settingsLabel: {
    color: '#52525B',
    fontSize: 14,
    fontWeight: '500',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#18181B',
  },
  segmentButtonInactive: {
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  segmentLabelActive: {
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: '500',
  },
  segmentLabelInactive: {
    color: '#18181B',
    fontSize: 14,
    fontWeight: '500',
  },
  devButton: {
    backgroundColor: '#F4F4F5',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  devButtonLabel: {
    color: '#18181B',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Courier',
  },
  footer: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  logoutLabel: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  updateStatusText: {
    fontSize: 13,
    color: '#047857',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
