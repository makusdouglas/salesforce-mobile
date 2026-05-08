import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';
import { roleBadge, type ManagedAdminRole } from '@/features/auth';

import { useUserRolesForm } from '../hooks/useUserRolesForm';
import { managedAdminRoles } from '../service/usersApi';
import { adminColors, adminFonts, adminRadii } from '../../products/theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminUserRolesForm'>;
type Route = RouteProp<AdminStackParamList, 'AdminUserRolesForm'>;

const ROLE_DESCRIPTIONS: Record<ManagedAdminRole, string> = {
  'manage-products': 'Editar catálogo, fotos e desativar produtos.',
  'manage-salespersons': 'Criar, editar e desativar vendedores.',
  'manage-clients': 'Editar qualquer cliente, inclusive os criados em campo.',
  superuser: 'Acesso total — inclui todas as funções admin acima.',
};

export function AdminUserRolesFormScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const form = useUserRolesForm(route.params.userId);

  const onSave = async () => {
    const outcome = await form.save();
    if (outcome.status === 'saved') nav.goBack();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => nav.goBack()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={adminColors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Editar funções</Text>
        <Pressable
          onPress={form.saving ? undefined : onSave}
          style={[styles.saveBtn, form.saving && styles.saveBtnDisabled]}
        >
          {form.saving ? (
            <ActivityIndicator color="#FAFAFA" />
          ) : (
            <Text style={styles.saveBtnText}>Salvar</Text>
          )}
        </Pressable>
      </View>

      {form.loading ? (
        <View style={styles.fillCenter}>
          <ActivityIndicator color={adminColors.textPrimary} />
        </View>
      ) : form.loadError || !form.user ? (
        <View style={styles.fillCenter}>
          <Text style={styles.errorText}>{form.loadError ?? 'Usuário não encontrado.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>USUÁRIO</Text>
            <View style={styles.userCard}>
              <Text style={styles.userName}>{form.user.display_name}</Text>
              <Text style={styles.userEmail}>{form.user.email}</Text>
              {form.user.roles.includes('seller') ? (
                <View style={styles.sellerChip}>
                  <Text style={styles.sellerChipText}>{roleBadge('seller').label}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FUNÇÕES ADMIN</Text>
            <Text style={styles.sectionHint}>
              Super usuário inclui todas as outras. Função de vendedor é gerenciada
              na área &quot;Vendedores&quot;.
            </Text>
            <View style={styles.toggleList}>
              {managedAdminRoles().map((role) => (
                <RoleToggle
                  key={role}
                  role={role}
                  checked={form.selected.has(role)}
                  onToggle={() => form.toggle(role)}
                />
              ))}
            </View>
            {form.saveError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{form.saveError}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function RoleToggle({
  role,
  checked,
  onToggle,
}: {
  role: ManagedAdminRole;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.toggleLabel}>{roleBadge(role).label}</Text>
        <Text style={styles.toggleDesc}>{ROLE_DESCRIPTIONS[role]}</Text>
      </View>
      <View style={[styles.switch, checked && styles.switchOn]}>
        <View style={[styles.switchKnob, checked && styles.switchKnobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: adminColors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 8,
    backgroundColor: adminColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.stroke,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 17,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: adminColors.primary,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: adminRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: adminColors.primaryOn,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  body: { padding: 16, gap: 18, paddingBottom: 32 },
  section: { gap: 8 },
  sectionLabel: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  sectionHint: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  userCard: {
    padding: 16,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    gap: 4,
  },
  userName: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
  sellerChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  sellerChipText: {
    color: '#52525B',
    fontFamily: adminFonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  toggleList: { gap: 10, marginTop: 6 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  toggleLabel: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDesc: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: adminColors.surfaceMuted,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: adminColors.textPrimary },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  switchKnobOn: { alignSelf: 'flex-end' },
  fillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  errorText: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: adminRadii.card,
    padding: 12,
    marginTop: 6,
  },
  errorBannerText: {
    color: '#991B1B',
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
});
