import { Feather } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';
import { roleBadge, type SessionRole } from '@/features/auth';

import { useUsers } from '../hooks/useUsers';
import { adminColors, adminFonts, adminRadii } from '../../products/theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminUsersList'>;

type RoleFilter = 'all' | 'admins' | 'sellers';

const FILTER_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'admins', label: 'Admins' },
  { value: 'sellers', label: 'Vendedores' },
];

const ADMIN_GRADE: readonly SessionRole[] = [
  'superuser',
  'admin',
  'manage-products',
  'manage-salespersons',
  'manage-clients',
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function hasAdminGrade(roles: readonly SessionRole[]): boolean {
  return roles.some((r) => ADMIN_GRADE.includes(r));
}

export function AdminUsersListScreen() {
  const nav = useNavigation<Nav>();
  const { state, reload } = useUsers();
  const focused = useIsFocused();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  useEffect(() => {
    if (focused) void reload();
  }, [focused, reload]);

  const rows = useMemo(() => {
    if (state.status !== 'ready') return [];
    const q = normalize(query.trim());
    return state.users.filter((u) => {
      if (roleFilter === 'admins' && !hasAdminGrade(u.roles)) return false;
      if (roleFilter === 'sellers' && !u.roles.includes('seller')) return false;
      if (q.length === 0) return true;
      const hay = normalize(`${u.display_name} ${u.email} ${u.roles.join(' ')}`);
      return hay.includes(q);
    });
  }, [state, query, roleFilter]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => nav.goBack()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={adminColors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Usuários & Roles</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.toolbar}>
        <View style={styles.segment}>
          {FILTER_OPTIONS.map((opt) => {
            const selected = roleFilter === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.segmentItem, selected && styles.segmentItemSelected]}
                onPress={() => setRoleFilter(opt.value)}
              >
                <Text
                  style={[
                    styles.segmentItemText,
                    selected && styles.segmentItemTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nome, e-mail ou função"
          placeholderTextColor={adminColors.textMuted}
          style={styles.search}
        />
      </View>

      {state.status === 'loading' ? (
        <View style={styles.fillCenter}>
          <ActivityIndicator color={adminColors.textPrimary} />
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.fillCenter}>
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable onPress={reload} style={styles.retry}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.fillCenter}>
          <Text style={styles.emptyTitle}>Nenhum usuário corresponde</Text>
          <Text style={styles.emptyHint}>Ajuste a busca ou o filtro.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => nav.navigate('AdminUserRolesForm', { userId: item.user_id })}
              style={styles.row}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.display_name)}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.display_name}
                </Text>
                <Text style={styles.rowEmail} numberOfLines={1}>
                  {item.email}
                </Text>
                <View style={styles.badgeRow}>
                  {(item.roles.length > 0 ? item.roles : (['(sem funções)'] as const)).map(
                    (r, idx) => (
                      <RoleChip key={`${item.user_id}-${r}-${idx}`} role={r as SessionRole} />
                    ),
                  )}
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={adminColors.textFaint} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function RoleChip({ role }: { role: SessionRole | '(sem funções)' }) {
  if (role === '(sem funções)') {
    return (
      <View style={[styles.chip, styles.chipSilent]}>
        <Text style={styles.chipTextSilent}>Sem funções</Text>
      </View>
    );
  }
  const badge = roleBadge(role);
  const styleForBadge =
    badge.style === 'destructive'
      ? styles.chipDestructive
      : badge.style === 'secondary'
        ? styles.chipSecondary
        : styles.chipDefault;
  const textForBadge =
    badge.style === 'destructive'
      ? styles.chipTextDestructive
      : badge.style === 'secondary'
        ? styles.chipTextSecondary
        : styles.chipTextDefault;
  return (
    <View style={[styles.chip, styleForBadge]}>
      <Text style={textForBadge}>{badge.label}</Text>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
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
  toolbar: { padding: 16, paddingBottom: 0, gap: 10 },
  segment: { flexDirection: 'row', gap: 6 },
  segmentItem: {
    flex: 1,
    height: 34,
    borderRadius: adminRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  segmentItemSelected: {
    backgroundColor: adminColors.textPrimary,
    borderColor: adminColors.textPrimary,
  },
  segmentItemText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  segmentItemTextSelected: { color: '#FAFAFA' },
  search: {
    height: 40,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    paddingHorizontal: 12,
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
  },
  list: { padding: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: adminColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  rowText: { flex: 1, gap: 4 },
  rowName: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  rowEmail: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: {
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDefault: { backgroundColor: '#F4F4F5' },
  chipSecondary: { backgroundColor: '#E4E4E7' },
  chipDestructive: { backgroundColor: '#FEE2E2' },
  chipSilent: { backgroundColor: adminColors.background, borderWidth: 1, borderColor: adminColors.stroke },
  chipTextDefault: {
    color: '#18181B',
    fontFamily: adminFonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextSecondary: {
    color: '#52525B',
    fontFamily: adminFonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextDestructive: {
    color: '#B91C1C',
    fontFamily: adminFonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextSilent: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 11,
    fontWeight: '500',
  },
  fillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 18,
    fontWeight: '600',
  },
  emptyHint: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    borderRadius: adminRadii.control,
  },
  retryText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
});
