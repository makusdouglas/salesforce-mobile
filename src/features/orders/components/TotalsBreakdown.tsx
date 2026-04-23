// 009-order-assembly: the summary breakdown card used on OrderSummary and
// (in compact form) in the OrderDraft footer.

import { StyleSheet, Text, View } from 'react-native';

import { formatBRL } from '../formatting/formatBRL';
import type { DiscountWarning, OrderTotals } from '../totals/types';

export interface TotalsBreakdownProps {
  readonly totals: OrderTotals;
  readonly variant?: 'full' | 'compact';
}

function warningLine(warning: DiscountWarning): string {
  switch (warning.kind) {
    case 'line-percent-over-100':
      return 'Desconto da linha acima de 100% — aplicado 100%.';
    case 'line-amount-over-subtotal':
      return 'Desconto da linha maior que o subtotal — aplicado até zerar.';
    case 'order-percent-over-100':
      return 'Desconto do pedido acima de 100% — aplicado 100%.';
    case 'order-amount-over-subtotal':
      return 'Desconto do pedido maior que o subtotal — aplicado até zerar.';
  }
}

export function TotalsBreakdown({ totals, variant = 'full' }: TotalsBreakdownProps) {
  const hasLineDiscounts = totals.lineDiscountsTotal > 0;
  const hasOrderDiscount = totals.orderDiscount > 0;
  const compact = variant === 'compact';

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.row}>
        <Text style={styles.label}>Subtotal</Text>
        <Text style={styles.value}>{formatBRL(totals.subtotal)}</Text>
      </View>
      {hasLineDiscounts ? (
        <View style={styles.row}>
          <Text style={styles.labelDiscount}>Descontos por item</Text>
          <Text style={styles.valueDiscount}>
            −{formatBRL(totals.lineDiscountsTotal)}
          </Text>
        </View>
      ) : null}
      {hasOrderDiscount ? (
        <View style={styles.row}>
          <Text style={styles.labelDiscount}>Desconto do pedido</Text>
          <Text style={styles.valueDiscount}>−{formatBRL(totals.orderDiscount)}</Text>
        </View>
      ) : null}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatBRL(totals.total)}</Text>
      </View>
      {totals.warnings.length > 0 ? (
        <View style={styles.warnings}>
          {totals.warnings.map((w, idx) => (
            <Text key={idx} style={styles.warning}>
              ⚠ {warningLine(w)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardCompact: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#525252',
    fontSize: 12,
  },
  labelDiscount: {
    color: '#047857',
    fontSize: 12,
  },
  value: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '600',
  },
  valueDiscount: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
  totalRow: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D4D4D8',
    marginTop: 2,
  },
  totalLabel: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    color: '#0A0A0A',
    fontSize: 20,
    fontWeight: '700',
  },
  warnings: {
    marginTop: 8,
    gap: 4,
  },
  warning: {
    color: '#92400E',
    fontSize: 11,
  },
});
