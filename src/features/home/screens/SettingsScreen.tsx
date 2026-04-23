import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { colors } from '@/app/theme/colors';
import { ConfirmModal } from '@/app/ui/modal';
import { authService } from '@/features/auth';
import { lockService } from '@/features/lock';

type Props = NativeStackScreenProps<HomeStackParamList, 'Settings'>;

const TIMEOUT_OPTIONS: readonly number[] = [1, 5, 10, 30];

export function SettingsScreen({ navigation }: Props) {
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
        <View style={styles.settingsBlock}>
          <Text style={styles.settingsLabel}>Bloquear após</Text>
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
                  <Text
                    style={
                      active ? styles.segmentLabelActive : styles.segmentLabelInactive
                    }
                  >
                    {minutes} min
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => navigation.navigate('DataLayerSmoke')}
          >
            <Text style={styles.buttonLabel}>[dev] Data-Layer Smoke</Text>
          </Pressable>
        ) : null}
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => navigation.navigate('DatabaseInspector')}
          >
            <Text style={styles.buttonLabel}>[dev] DB Inspector</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.ghostButton, pressed && styles.buttonPressed]}
          onPress={openLogout}
        >
          <Text style={styles.ghostLabel}>Sair</Text>
        </Pressable>
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
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 12,
  },
  settingsBlock: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  settingsLabel: {
    color: '#52525B',
    fontSize: 13,
    fontWeight: '500',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
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
    fontSize: 13,
    fontWeight: '500',
  },
  segmentLabelInactive: {
    color: '#18181B',
    fontSize: 13,
    fontWeight: '500',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  ghostButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  ghostLabel: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '500',
  },
});
