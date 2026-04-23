import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '@/app/navigation/types';

import { SearchBar } from '@/components/SearchBar';

import { ClientEmptyView } from '../components/ClientEmptyView';
import { ClientListRow } from '../components/ClientListRow';
import { ClientNoMatchesView } from '../components/ClientNoMatchesView';
import { FilterChipRow } from '../components/FilterChipRow';
import { useActiveSalespersonId } from '../hooks/useActiveSalespersonId';
import { useClients } from '../hooks/useClients';
import { useClientsFilter } from '../hooks/useClientsFilter';
import { useViewport } from '../hooks/useViewport';

type Props = NativeStackScreenProps<HomeStackParamList, 'Clients'>;

function headerLabel(
  activeFilter: ReturnType<typeof useClientsFilter>['activeFilter'],
  query: string,
): string {
  if (query.trim().length > 0) return 'Resultados';
  if (activeFilter === null) return 'Todos os clientes';
  if (activeFilter.kind === 'recent') return 'Clientes recentes';
  return `Iniciando em ${activeFilter.value}`;
}

export function ClientsScreen({ navigation }: Props) {
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const salesperson = useActiveSalespersonId();
  const { clients, hasAny } = useClients(salesperson.salespersonId);
  const filter = useClientsFilter(clients);

  const handleNewClient = () => navigation.navigate('ClientForm');
  const handleRowPress = (clientId: string) =>
    navigation.navigate('ClientProfile', { clientId });

  const hasActiveFilter = filter.query !== '' || filter.activeFilter !== null;
  const noMatches = hasAny && filter.filtered.length === 0 && hasActiveFilter;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Clientes</Text>
        {hasAny ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleNewClient}
            style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
          >
            <Text style={styles.primaryActionLabel}>Novo cliente</Text>
          </Pressable>
        ) : (
          <View style={styles.topSpacer} />
        )}
      </View>

      {!hasAny ? (
        <ClientEmptyView onCreatePress={handleNewClient} viewport={viewport} />
      ) : (
        <>
          <View style={[styles.searchArea, isTablet && styles.searchAreaTablet]}>
            <SearchBar
              value={filter.query}
              onChangeText={filter.setQuery}
              placeholder="Buscar cliente"
            />
          </View>
          <FilterChipRow
            clients={clients}
            activeFilter={filter.activeFilter}
            onChange={filter.setActiveFilter}
            viewport={viewport}
          />
          {noMatches ? (
            <ClientNoMatchesView onReset={filter.reset} viewport={viewport} />
          ) : (
            <FlatList
              style={styles.list}
              data={filter.filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ClientListRow
                  client={item}
                  onPress={handleRowPress}
                  viewport={viewport}
                />
              )}
              ListHeaderComponent={
                <View style={styles.countRow}>
                  <Text style={styles.countTitle}>
                    {headerLabel(filter.activeFilter, filter.query)}
                  </Text>
                  <Text style={styles.countNumber}>
                    {filter.filtered.length} {filter.filtered.length === 1 ? 'cliente' : 'clientes'}
                  </Text>
                </View>
              }
              contentContainerStyle={[
                styles.listContent,
                isTablet && styles.listContentTablet,
              ]}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBar: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    gap: 8,
  },
  topBarTablet: {
    paddingHorizontal: 24,
    height: 64,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  backChevron: {
    fontSize: 32,
    color: '#0A0A0A',
    marginTop: -4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  primaryAction: {
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryActionLabel: {
    color: '#FAFAFA',
    fontSize: 13,
    fontWeight: '600',
  },
  topSpacer: {
    width: 40,
  },
  searchArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchAreaTablet: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 10,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  countTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  countNumber: {
    fontSize: 13,
    color: '#71717A',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listContentTablet: {
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
});
