import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';
import { colors } from '@/app/theme/colors';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomePlaceholder'>;

/**
 * Home — the salesperson's hub screen. Phase 2 lands only the shell so the
 * route swap compiles; the real composition (HomeTopBar + GreetingBlock +
 * three QuickActionCards + RecentActivityCard) is wired in Phase 3 (US1).
 *
 * Root element is intentionally a <View>, NOT a <ScrollView>. Home MUST NOT
 * scroll on the phone reference viewport per spec FR-020.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.placeholder}>Início</Text>
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
  },
  placeholder: {
    color: colors.foreground,
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
  },
});
