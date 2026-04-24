import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { colors } from '@/app/theme/colors';
import { ConfirmModal } from '@/app/ui/modal';
import { authService, useSession } from '@/features/auth';
import { useActiveSalespersonId } from '@/features/clients';
import { lockService } from '@/features/lock';

import { useActiveSalespersonName } from '../hooks/useActiveSalespersonName';

type Props = NativeStackScreenProps<HomeStackParamList, 'Settings'>;

const TIMEOUT_OPTIONS: readonly number[] = [1, 5, 10, 30];

export function SettingsScreen({ navigation }: Props) {
  const { email } = useSession();
  const activeSp = useActiveSalespersonId();
  const salespersonName = useActiveSalespersonName(activeSp.salespersonId);

  const [selectedMinutes, setSelectedMinutes] = useState<number>(
    lockService.getInactivityTimeout(),
  );
  const [logoutOpen, setLogoutOpen] = useState<boolean>(false);

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
});
