import { useNavigation, useIsFocused } from '@react-navigation/native';
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

import { SellerRow } from '../components/SellerRow';
import { useSellers } from '../hooks/useSellers';
import { useAdminSellersLayout } from '../responsive/useAdminSellersLayout';
import type { ListSellersFilter } from '../service/sellersApi';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminSellersList'>;

const FILTERS: readonly { id: ListSellersFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'inactive', label: 'Inativos' },
];

export function AdminSellersListScreen() {
  const nav = useNavigation<Nav>();
  const viewport = useAdminSellersLayout();
  const tablet = viewport === 'tablet';
  const { state, filter, setFilter, reload } = useSellers();
  const focused = useIsFocused();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (focused) void reload();
  }, [focused, reload]);

  const visible = useMemo(() => {
    if (state.status !== 'ready') return [];
    const q = query.trim().toLowerCase();
    if (q.length === 0) return state.sellers;
    return state.sellers.filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(q));
  }, [state, query]);

  const openCreate = () => nav.navigate('AdminSellerForm', { mode: 'create' });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.topBar, tablet && styles.topBarTablet]}>
        <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={[styles.topTitle, tablet && styles.topTitleTablet]}>Vendedores</Text>
        {tablet ? (
          <Pressable onPress={openCreate} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>+ Novo vendedor</Text>
          </Pressable>
        ) : (
          <Pressable onPress={openCreate} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.plusGlyph}>+</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.toolbar, tablet && styles.toolbarTablet]}>
        <View style={styles.segment}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[styles.segBtn, active && styles.segBtnActive]}
              >
                <Text style={[styles.segLabel, active && styles.segLabelActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {tablet ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nome ou e-mail"
            placeholderTextColor={adminColors.textFaint}
            style={styles.search}
          />
        ) : null}
      </View>

      {state.status === 'loading' ? (
        <View style={styles.fillCenter}>
          <ActivityIndicator color={adminColors.textPrimary} />
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.fillCenter}>
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable onPress={() => void reload()} style={styles.retry}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : visible.length === 0 && filter === 'all' ? (
        <View style={styles.fillCenter}>
          <Text style={styles.emptyTitle}>Nenhum vendedor ainda</Text>
          <Text style={styles.emptyHint}>
            Crie o primeiro para começar a distribuir pedidos.
          </Text>
          <Pressable onPress={openCreate} style={styles.primaryBtnLarge}>
            <Text style={styles.primaryBtnText}>Criar vendedor</Text>
          </Pressable>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.fillCenter}>
          <Text style={styles.emptyHint}>Nenhum vendedor nessa categoria.</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(s) => s.salespeople_id}
          contentContainerStyle={[styles.list, tablet && styles.listTablet]}
          ItemSeparatorComponent={() => <View style={{ height: tablet ? 12 : 10 }} />}
          renderItem={({ item }) => (
            <SellerRow
              seller={item}
              variant={tablet ? 'tablet' : 'phone'}
              onPress={() =>
                nav.navigate('AdminSellerForm', { mode: 'edit', authUserId: item.auth_user_id })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
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
  topBarTablet: { height: 64, paddingHorizontal: 20 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { color: adminColors.textPrimary, fontSize: 22 },
  plusGlyph: { color: adminColors.textPrimary, fontSize: 22, fontWeight: '600' },
  topTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 17,
    fontWeight: '600',
  },
  topTitleTablet: { fontSize: 20 },
  primaryBtn: {
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: adminColors.primary,
    borderRadius: adminRadii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: adminColors.primaryOn,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtnLarge: {
    marginTop: 8,
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: adminColors.primary,
    borderRadius: adminRadii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  toolbarTablet: { paddingHorizontal: 28, paddingTop: 20, flexDirection: 'row', alignItems: 'center' },
  segment: { flexDirection: 'row', gap: 6 },
  segBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: adminColors.primary,
    borderColor: adminColors.primary,
  },
  segLabel: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  segLabelActive: { color: adminColors.primaryOn },
  search: {
    flex: 1,
    height: 36,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    backgroundColor: adminColors.surface,
    paddingHorizontal: 12,
    fontFamily: adminFonts.body,
    fontSize: 13,
    color: adminColors.textPrimary,
  },
  list: { padding: 16, paddingTop: 12, paddingBottom: 24 },
  listTablet: { padding: 28, paddingTop: 12, paddingBottom: 32 },
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
