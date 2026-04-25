import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';

import { useAdminSellersLayout } from '../responsive/useAdminSellersLayout';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminMenu'>;

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];
type Card = {
  label: string;
  description: string;
  icon: FeatherIcon;
  onPress: () => void;
};

export function AdminMenuScreen() {
  const nav = useNavigation<Nav>();
  const viewport = useAdminSellersLayout();
  const tablet = viewport === 'tablet';

  const cards: Card[] = [
    {
      label: 'Produtos',
      description: 'Catálogo, variantes e fotos.',
      icon: 'package',
      onPress: () => nav.navigate('AdminProducts'),
    },
    {
      label: 'Vendedores',
      description: 'Criar, editar e desativar contas.',
      icon: 'users',
      onPress: () => nav.navigate('AdminSellersList'),
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.topBar, tablet && styles.topBarTablet]}>
        <Text style={[styles.topTitle, tablet && styles.topTitleTablet]}>Admin</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, tablet && styles.scrollTablet]}>
        <View style={[styles.heading, tablet && styles.headingTablet]}>
          <Text style={[styles.hTitle, tablet && styles.hTitleTablet]}>Área administrativa</Text>
          <Text style={[styles.hSub, tablet && styles.hSubTablet]}>
            Gerencie catálogo e equipe.
          </Text>
        </View>
        <View style={[styles.list, tablet && styles.listTablet]}>
          {cards.map((c) => (
            <Pressable
              key={c.label}
              onPress={c.onPress}
              style={({ pressed }) => [
                styles.card,
                tablet && styles.cardTablet,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.iconBox, tablet && styles.iconBoxTablet]}>
                <Feather
                  name={c.icon}
                  size={tablet ? 26 : 22}
                  color={adminColors.textPrimary}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, tablet && styles.cardTitleTablet]}>{c.label}</Text>
                <Text style={[styles.cardDesc, tablet && styles.cardDescTablet]}>
                  {c.description}
                </Text>
              </View>
              {!tablet ? (
                <Feather name="chevron-right" size={20} color={adminColors.textFaint} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: adminColors.background },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.stroke,
    backgroundColor: adminColors.surface,
    justifyContent: 'center',
  },
  topBarTablet: { height: 64, paddingHorizontal: 28 },
  topTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 18,
    fontWeight: '600',
  },
  topTitleTablet: { fontSize: 20 },
  scroll: { paddingBottom: 32 },
  scrollTablet: { paddingBottom: 40 },
  heading: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, gap: 6 },
  headingTablet: { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 12, gap: 8 },
  hTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 24,
    fontWeight: '600',
  },
  hTitleTablet: { fontSize: 28 },
  hSub: { color: adminColors.textMuted, fontFamily: adminFonts.body, fontSize: 14 },
  hSubTablet: { fontSize: 16 },
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  listTablet: { paddingHorizontal: 28, paddingTop: 20, gap: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.modal,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    minHeight: 88,
  },
  cardTablet: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
    padding: 24,
    borderRadius: adminRadii.bigModal,
    minHeight: 168,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: adminColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxTablet: { width: 52, height: 52, borderRadius: 12 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 16,
    fontWeight: '600',
  },
  cardTitleTablet: { fontSize: 20 },
  cardDesc: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
  cardDescTablet: { fontSize: 14 },
});
