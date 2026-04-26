// 017-revenue-dashboard — bottom sheet that lists active sellers as a
// tap-first list (UX1). "Todos" is always the first chip. Selecting a
// seller closes the sheet via onSelect.

import { Feather } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ActiveSeller } from '../hooks/useActiveSellersForFilter';

export interface VendedorFilterSheetProps {
  readonly visible: boolean;
  readonly sellers: readonly ActiveSeller[];
  readonly loading: boolean;
  readonly currentSellerId: string | null;
  readonly onSelect: (sellerId: string | null) => void;
  readonly onClose: () => void;
}

export function VendedorFilterSheet({
  visible,
  sellers,
  loading,
  currentSellerId,
  onSelect,
  onClose,
}: VendedorFilterSheetProps) {
  const commit = (sellerId: string | null): void => {
    onSelect(sellerId);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.grabber} />
            <Text style={styles.title}>Filtrar por vendedor</Text>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              <Pressable
                onPress={() => commit(null)}
                style={({ pressed }) => [
                  styles.row,
                  currentSellerId === null && styles.rowActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.rowText}>Todos</Text>
                {currentSellerId === null ? (
                  <Feather name="check" size={18} color="#0A0A0A" />
                ) : null}
              </Pressable>
              {loading ? (
                <Text style={styles.empty}>Carregando vendedores...</Text>
              ) : sellers.length === 0 ? (
                <Text style={styles.empty}>Nenhum vendedor ativo.</Text>
              ) : (
                sellers.map((s) => {
                  const active = s.id === currentSellerId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => commit(s.id)}
                      style={({ pressed }) => [
                        styles.row,
                        active && styles.rowActive,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={styles.rowText} numberOfLines={1}>
                        {s.name}
                      </Text>
                      {active ? <Feather name="check" size={18} color="#0A0A0A" /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0A0A0A99',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '70%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E4E7',
    marginBottom: 12,
  },
  title: {
    color: '#0A0A0A',
    fontFamily: 'Funnel Sans',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  list: { maxHeight: 360 },
  listContent: { paddingBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowActive: {
    backgroundColor: '#F5F5F5',
  },
  rowText: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '500',
  },
  empty: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    color: '#737373',
    fontFamily: 'Geist',
    fontSize: 13,
  },
});
