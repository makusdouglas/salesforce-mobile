import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';

import { adminColors, adminFonts, adminRadii } from '../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminProductSource'>;

export function AdminProductSourceScreen() {
  const nav = useNavigation<Nav>();

  return (
    <View style={styles.backdrop}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.card}>
          <Text style={styles.title}>Novo produto</Text>
          <Text style={styles.subtitle}>Como deseja cadastrar?</Text>

          <Pressable
            style={styles.option}
            onPress={() => nav.replace('AdminProductForm', {})}
          >
            <View style={styles.optionIcon}>
              <Feather name="edit-3" size={18} color={adminColors.textPrimary} />
            </View>
            <View style={styles.optionCol}>
              <Text style={styles.optionTitle}>Cadastro manual</Text>
              <Text style={styles.optionHint}>
                Preencha todos os campos do zero.
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={adminColors.textFaint} />
          </Pressable>

          <Pressable
            style={styles.option}
            onPress={() => nav.replace('AdminBarcodeScanner')}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="barcode-outline" size={22} color={adminColors.textPrimary} />
            </View>
            <View style={styles.optionCol}>
              <Text style={styles.optionTitle}>Escanear código de barras</Text>
              <Text style={styles.optionHint}>
                Verifica se já existe e pré-preenche.
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={adminColors.textFaint} />
          </Pressable>

          <Pressable style={styles.cancel} onPress={() => nav.goBack()}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: adminColors.scrim,
    justifyContent: 'flex-end',
  },
  safe: { padding: 16 },
  card: {
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.modal,
    padding: 20,
    gap: 14,
  },
  title: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 72,
    paddingHorizontal: 14,
    backgroundColor: adminColors.background,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: adminRadii.control,
    backgroundColor: adminColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCol: { flex: 1, gap: 2 },
  optionTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
  optionHint: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  cancel: {
    height: 40,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
});
