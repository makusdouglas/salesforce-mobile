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

import { ProductRow } from '../components/ProductRow';
import { useProducts } from '../hooks/useProducts';
import { useAdminProductsLayout } from '../responsive/useAdminProductsLayout';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminProducts'>;

export function AdminProductsListScreen() {
  const nav = useNavigation<Nav>();
  const viewport = useAdminProductsLayout();
  const { state, reload } = useProducts();
  const focused = useIsFocused();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (focused) void reload();
  }, [focused, reload]);

  const products = useMemo(() => {
    if (state.status !== 'ready') return [];
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) return state.products;
    return state.products.filter((p) => {
      const hay = `${p.name} ${p.category ?? ''}`.toLowerCase();
      return hay.includes(trimmed);
    });
  }, [state, query]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.topBar, viewport === 'tablet' && styles.topBarTablet]}>
        <Text style={[styles.topTitle, viewport === 'tablet' && styles.topTitleTablet]}>
          Produtos
        </Text>
        <Pressable
          style={[styles.newBtn, viewport === 'tablet' && styles.newBtnTablet]}
          onPress={() => nav.navigate('AdminProductSource')}
        >
          <Text style={styles.newBtnText}>
            {viewport === 'tablet' ? '+ Novo produto' : '+ Novo'}
          </Text>
        </Pressable>
      </View>

      {viewport === 'tablet' ? (
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nome ou categoria"
            placeholderTextColor={adminColors.textMuted}
            style={styles.search}
          />
        </View>
      ) : null}

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
      ) : products.length === 0 ? (
        <View style={styles.fillCenter}>
          <Text style={styles.emptyTitle}>Nenhum produto ainda</Text>
          <Text style={styles.emptyHint}>
            Toque em &quot;Novo&quot; para cadastrar o primeiro produto.
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[
            styles.list,
            viewport === 'tablet' && styles.listTablet,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: viewport === 'tablet' ? 14 : 10 }} />}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              showEditButton={viewport === 'tablet'}
              onPress={() => nav.navigate('AdminProductForm', { productId: item.id })}
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
    paddingHorizontal: 16,
    backgroundColor: adminColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.stroke,
  },
  topBarTablet: { height: 64, paddingHorizontal: 28 },
  topTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 18,
    fontWeight: '600',
  },
  topTitleTablet: { fontSize: 22 },
  newBtn: {
    backgroundColor: adminColors.primary,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: adminRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtnTablet: { height: 40, paddingHorizontal: 18, borderRadius: adminRadii.input },
  newBtnText: {
    color: adminColors.primaryOn,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
  searchWrap: { padding: 28, paddingBottom: 0 },
  search: {
    height: 44,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    paddingHorizontal: 12,
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
  },
  list: { padding: 16, paddingTop: 12, paddingBottom: 24 },
  listTablet: { padding: 28, paddingTop: 14, paddingBottom: 32 },
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
