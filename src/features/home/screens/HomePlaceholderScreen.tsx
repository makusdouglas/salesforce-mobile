import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { colors } from '@/app/theme/colors';
import { authService, useSession } from '@/features/auth';
import { lockService } from '@/features/lock';
import { onPullToRefresh, SyncStatusIndicator } from '@/features/sync';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomePlaceholder'>;

const TIMEOUT_OPTIONS: readonly number[] = [1, 5, 10, 30];

export function HomePlaceholderScreen({ navigation }: Props) {
  const { email } = useSession();
  const [selectedMinutes, setSelectedMinutes] = useState<number>(
    lockService.getInactivityTimeout(),
  );
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onPullToRefresh();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const confirmLogout = () => {
    Alert.alert('Sair da conta', 'Seus dados permanecem no dispositivo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void authService.logout();
        },
      },
    ]);
  };

  const selectMinutes = (minutes: number): void => {
    const previous = selectedMinutes;
    setSelectedMinutes(minutes);
    void lockService.setInactivityTimeout(minutes).catch(() => {
      setSelectedMinutes(previous);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <SyncStatusIndicator style={styles.headerIndicator} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.heading}>Bem-vindo</Text>
        {email !== null ? <Text style={styles.subtitle}>{email}</Text> : null}
        <Text style={styles.subtitle}>Sua base de vendas fica aqui.</Text>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => navigation.navigate('Clients')}
        >
          <Text style={styles.buttonLabel}>Ver clientes</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => navigation.navigate('Catalog')}
        >
          <Text style={styles.buttonLabel}>Ver catálogo</Text>
        </Pressable>

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
          onPress={confirmLogout}
        >
          <Text style={styles.ghostLabel}>Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  headerIndicator: {
    marginStart: 'auto',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 16,
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
  settingsBlock: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
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
});
