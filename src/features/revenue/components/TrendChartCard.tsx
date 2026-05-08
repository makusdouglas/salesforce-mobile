// 017-revenue-dashboard — monthly trend chart with three series
// (Faturado / Recebido / Pendente). Stacked vertical bars matches the
// Pencil design pass and degrades gracefully on phone widths.
//
// Tap a column → onMonthPress(monthKey). Toggle the comparison overlay
// from the parent — when priorYearTrend is provided, it is rendered as
// a faded line series on top of the bars.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { emptyStates } from '../shared/empty-states';
import type { TrendPoint } from '../shared/types';

import { PanelEmptyState } from './PanelEmptyState';

const SERIES_COLOR = {
  faturado: '#0A0A0A',
  recebido: '#16A34A',
  pendente: '#F59E0B',
} as const;

const PRIOR_COLOR = '#A3A3A3';
const CHART_HEIGHT = 130;
const BAR_WIDTH = 18;

export interface TrendChartCardProps {
  readonly trend: readonly TrendPoint[];
  readonly priorYearTrend?: readonly TrendPoint[] | undefined;
  readonly comparisonEnabled: boolean;
  readonly comparisonAvailable: boolean;
  readonly onToggleComparison: (next: boolean) => void;
  readonly onMonthPress?: ((monthKey: string) => void) | undefined;
}

function shortMonthLabel(monthKey: string): string {
  const PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const month = Number.parseInt(monthKey.slice(5, 7), 10);
  return PT[month - 1] ?? monthKey;
}

export function TrendChartCard({
  trend,
  priorYearTrend,
  comparisonEnabled,
  comparisonAvailable,
  onToggleComparison,
  onMonthPress,
}: TrendChartCardProps) {
  const maxStack = useMemo(() => {
    if (trend.length === 0) return 0;
    return trend.reduce(
      (max, p) => Math.max(max, p.faturado + p.recebido + p.pendente),
      0,
    );
  }, [trend]);

  const priorMaxStack = useMemo(() => {
    if (!priorYearTrend || priorYearTrend.length === 0) return 0;
    return priorYearTrend.reduce(
      (max, p) => Math.max(max, p.faturado + p.recebido + p.pendente),
      0,
    );
  }, [priorYearTrend]);

  const scale = Math.max(maxStack, priorMaxStack, 1);
  const lastMonth =
    trend.length > 0 ? (trend[trend.length - 1] as TrendPoint).month : null;

  const isEmpty = trend.length === 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Tendência (12 meses)</Text>
        <Pressable
          onPress={() => comparisonAvailable && onToggleComparison(!comparisonEnabled)}
          style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.7 }]}
          accessibilityRole="switch"
          accessibilityState={{ checked: comparisonEnabled, disabled: !comparisonAvailable }}
        >
          <View
            style={[
              styles.switchTrack,
              comparisonEnabled && styles.switchTrackOn,
              !comparisonAvailable && styles.switchTrackDisabled,
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                comparisonEnabled && styles.switchThumbOn,
              ]}
            />
          </View>
          <Text style={styles.toggleLabel}>Comparar com ano anterior</Text>
        </Pressable>
      </View>

      <View style={styles.legend}>
        <Legend color={SERIES_COLOR.faturado} label="Faturado" />
        <Legend color={SERIES_COLOR.recebido} label="Recebido" />
        <Legend color={SERIES_COLOR.pendente} label="Pendente" />
        {comparisonEnabled && priorYearTrend && priorYearTrend.length > 0 ? (
          <Legend color={PRIOR_COLOR} label="Ano anterior" faded />
        ) : null}
      </View>

      {isEmpty ? (
        <PanelEmptyState message={emptyStates.trendNoData} />
      ) : (
        <>
          <View style={styles.bars}>
            {trend.map((p) => {
              const total = p.faturado + p.recebido + p.pendente;
              const totalH = (total / scale) * CHART_HEIGHT;
              const recH = (p.recebido / scale) * CHART_HEIGHT;
              const penH = (p.pendente / scale) * CHART_HEIGHT;
              const fatH = Math.max(0, totalH - recH - penH);
              const priorPoint =
                comparisonEnabled && priorYearTrend
                  ? priorYearTrend.find(
                      (pp) => pp.month.slice(5, 7) === p.month.slice(5, 7),
                    )
                  : undefined;
              const priorTotal = priorPoint
                ? priorPoint.faturado + priorPoint.recebido + priorPoint.pendente
                : 0;
              const priorH = (priorTotal / scale) * CHART_HEIGHT;
              return (
                <Pressable
                  key={p.month}
                  style={styles.col}
                  onPress={() => onMonthPress?.(p.month)}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortMonthLabel(p.month)} — toque para ver pedidos`}
                >
                  <View style={styles.colInner}>
                    {priorPoint && comparisonEnabled ? (
                      <View
                        style={[
                          styles.priorMarker,
                          { bottom: Math.max(0, priorH - 1) },
                        ]}
                      />
                    ) : null}
                    <View
                      style={[
                        styles.barSeg,
                        {
                          height: fatH,
                          backgroundColor: SERIES_COLOR.faturado,
                          borderTopLeftRadius: 2,
                          borderTopRightRadius: 2,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.barSeg,
                        { height: recH, backgroundColor: SERIES_COLOR.recebido },
                      ]}
                    />
                    <View
                      style={[
                        styles.barSeg,
                        {
                          height: penH,
                          backgroundColor: SERIES_COLOR.pendente,
                          borderBottomLeftRadius: 2,
                          borderBottomRightRadius: 2,
                        },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.labels}>
            {trend.map((p) => (
              <Text
                key={p.month}
                style={[styles.monthLabel, p.month === lastMonth && styles.monthLabelActive]}
              >
                {shortMonthLabel(p.month)}
              </Text>
            ))}
          </View>

          {comparisonEnabled && !comparisonAvailable ? (
            <Text style={styles.comparisonHint}>{emptyStates.trendComparisonUnavailable}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function Legend({ color, label, faded }: { color: string; label: string; faded?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          { backgroundColor: color, opacity: faded ? 0.55 : 1 },
        ]}
      />
      <Text style={[styles.legendLabel, faded && { opacity: 0.7 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 14,
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#0A0A0A',
    fontFamily: 'Funnel Sans',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchTrack: {
    width: 28,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E4E4E7',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: '#0A0A0A',
  },
  switchTrackDisabled: {
    opacity: 0.4,
  },
  switchThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: {
    transform: [{ translateX: 12 }],
  },
  toggleLabel: {
    color: '#525252',
    fontFamily: 'Geist',
    fontSize: 10,
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#525252',
    fontFamily: 'Geist',
    fontSize: 11,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT,
    gap: 5,
  },
  col: {
    width: BAR_WIDTH,
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
  },
  colInner: {
    width: BAR_WIDTH,
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barSeg: {
    width: BAR_WIDTH,
  },
  priorMarker: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: PRIOR_COLOR,
    opacity: 0.55,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
  },
  monthLabel: {
    width: BAR_WIDTH,
    textAlign: 'center',
    color: '#737373',
    fontFamily: 'Geist',
    fontSize: 9,
  },
  monthLabelActive: {
    color: '#0A0A0A',
    fontWeight: '600',
  },
  comparisonHint: {
    color: '#737373',
    fontFamily: 'Geist',
    fontSize: 11,
    fontStyle: 'italic',
  },
});
