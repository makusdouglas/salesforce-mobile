// 017-revenue-dashboard — KPI band. 5 cards in a 2+2+1 grid (FR-005).
// Per-KPI: label · value · delta % vs previous month with arrow direction.

import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { formatBRL } from '@/features/orders/formatting/formatBRL';

import { formatDelta } from '../shared/formatDelta';
import type { KpiBlock, KpiLabel } from '../shared/types';

export interface KpiBandProps {
  readonly kpis: readonly KpiBlock[];
}

const LABEL_PT: Record<KpiLabel, string> = {
  recebido: 'Recebido',
  faturado: 'Faturado',
  pendente: 'Pendente',
  ticket_medio: 'Ticket médio',
  pedidos_enviados: 'Nº de pedidos enviados',
};

function formatValue(label: KpiLabel, value: number): string {
  if (label === 'pedidos_enviados') return String(Math.round(value));
  return formatBRL(value);
}

function KpiCard({ kpi }: { kpi: KpiBlock }) {
  const delta = formatDelta(kpi.deltaPct);
  const deltaColor =
    delta.direction === 'down' ? '#DC2626'
    : delta.direction === 'up' ? '#16A34A'
    : '#737373';
  const arrow =
    delta.direction === 'up' ? 'arrow-up-right'
    : delta.direction === 'down' ? 'arrow-down-right'
    : null;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{LABEL_PT[kpi.label]}</Text>
      <Text style={styles.value}>{formatValue(kpi.label, kpi.currentValue)}</Text>
      <View style={styles.deltaRow}>
        {arrow ? <Feather name={arrow} size={12} color={deltaColor} /> : null}
        <Text style={[styles.delta, { color: deltaColor }]}>{delta.text}</Text>
      </View>
    </View>
  );
}

export function KpiBand({ kpis }: KpiBandProps) {
  // Defensive: render even if the array isn't exactly 5.
  const [k1, k2, k3, k4, k5] = kpis;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Indicadores do mês</Text>
        <Text style={styles.headerCaption}>vs mês anterior</Text>
      </View>
      {k1 && k2 ? (
        <View style={styles.row}>
          <View style={styles.cell}><KpiCard kpi={k1} /></View>
          <View style={styles.cell}><KpiCard kpi={k2} /></View>
        </View>
      ) : null}
      {k3 && k4 ? (
        <View style={styles.row}>
          <View style={styles.cell}><KpiCard kpi={k3} /></View>
          <View style={styles.cell}><KpiCard kpi={k4} /></View>
        </View>
      ) : null}
      {k5 ? (
        <View style={styles.wideRow}>
          <KpiCard kpi={k5} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#0A0A0A',
    fontFamily: 'Funnel Sans',
    fontSize: 15,
    fontWeight: '600',
  },
  headerCaption: {
    color: '#737373',
    fontFamily: 'Geist',
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
  },
  wideRow: {
    flexDirection: 'row',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 14,
    gap: 6,
  },
  label: {
    color: '#737373',
    fontFamily: 'Geist',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  value: {
    color: '#0A0A0A',
    fontFamily: 'Funnel Sans',
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  delta: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '600',
  },
});
