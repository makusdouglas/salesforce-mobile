import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { colors } from '@/app/theme/colors';
import { authService, useSession } from '@/features/auth';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomePlaceholder'>;

export function HomePlaceholderScreen({ navigation }: Props) {
  const { email } = useSession();

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Bem-vindo</Text>
        {email !== null ? <Text style={styles.subtitle}>{email}</Text> : null}
        <Text style={styles.subtitle}>Sua base de vendas fica aqui.</Text>
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => navigation.navigate('DataLayerSmoke')}
          >
            <Text style={styles.buttonLabel}>[dev] Data-Layer Smoke</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.ghostButton, pressed && styles.buttonPressed]}
          onPress={confirmLogout}
        >
          <Text style={styles.ghostLabel}>Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
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
});
