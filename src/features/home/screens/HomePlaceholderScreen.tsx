import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/app/theme/colors';
import type { HomeStackParamList } from '@/app/navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomePlaceholder'>;

export function HomePlaceholderScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Bem-vindo</Text>
        <Text style={styles.subtitle}>Sua base de vendas fica aqui.</Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => navigation.getParent()?.navigate('Auth')}
        >
          <Text style={styles.buttonLabel}>Entrar</Text>
        </Pressable>
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => navigation.navigate('DataLayerSmoke')}
          >
            <Text style={styles.buttonLabel}>[dev] Data-Layer Smoke</Text>
          </Pressable>
        ) : null}
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
});
