// 009-order-assembly: one line-item card on OrderDraftScreen.
//
// Renders the phone layout from design/order-draft-phone.png or the denser
// row layout from design/order-draft-tablet.png depending on the viewport
// prop. Hosts a QtyStepper (sm) and, when the line carries a non-zero
// discount, a green discount chip. When the line has no discount the chip
// row shows a grey "Adicionar desconto" link affordance.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type OrderItem from '@/data/models/OrderItem';
import type Product from '@/data/models/Product';
import type ProductVariant from '@/data/models/ProductVariant';

import { formatBRL } from '../formatting/formatBRL';
import type { PerLineTotal } from '../totals/types';
import type { Viewport } from '../hooks/useViewport';

import { QtyStepper } from './QtyStepper';

export interface OrderLineCardProps {
  readonly line: OrderItem;
  readonly variant: ProductVariant | null;
  readonly product: Product | null;
  readonly totals: PerLineTotal;
  readonly viewport: Viewport;
  readonly onQtyChange: (next: number) => void;
  readonly onRemove: () => void;
  readonly onEditDiscount: () => void;
}

function hasDiscount(line: OrderItem): boolean {
  return line.discountAmount > 0;
}

function discountChipLabel(line: OrderItem, totals: PerLineTotal): string {
  if (line.discountMode === 'percent') {
    return `Desconto ${line.discountAmount}% · −${formatBRL(totals.lineDiscountAmount)}`;
  }
  return `Desconto −${formatBRL(line.discountAmount)}`;
}

export function OrderLineCard({
  line,
  variant,
  product,
  totals,
  onQtyChange,
  onRemove,
  onEditDiscount,
}: OrderLineCardProps) {
  const productName = product?.name ?? '—';
  const variantLabel = variant?.label ?? '—';
  const unitPriceLabel = formatBRL(line.unitPrice);
  const discounted = hasDiscount(line);

  return (
    <View style={styles.card} accessibilityLabel={`Item ${productName}`}>
      <View style={styles.rowTop}>
        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={2}>
            {productName}
          </Text>
          <Text style={styles.sub}>
            {variantLabel} · {unitPriceLabel} un
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remover item"
          onPress={onRemove}
          style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Text style={styles.removeBtnText}>✕</Text>
        </Pressable>
      </View>

      {discounted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Editar desconto da linha"
          onPress={onEditDiscount}
          style={({ pressed }) => [styles.chip, styles.chipOn, pressed && styles.pressed]}
        >
          <Text style={styles.chipOnText}>{discountChipLabel(line, totals)}</Text>
          <Text style={styles.chipOnPencil}>✎</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar desconto à linha"
          onPress={onEditDiscount}
          style={({ pressed }) => [styles.addDiscount, pressed && styles.pressed]}
        >
          <Text style={styles.addDiscountText}>+ Adicionar desconto</Text>
        </Pressable>
      )}

      <View style={styles.rowBottom}>
        <QtyStepper
          value={line.quantity}
          onChange={onQtyChange}
          size="sm"
          accessibilityLabel={`Quantidade de ${productName}`}
        />
        <View style={styles.totalCol}>
          <Text style={discounted ? styles.totalDiscounted : styles.total}>
            {formatBRL(totals.lineTotal)}
          </Text>
          {discounted ? (
            <Text style={styles.totalStrike}>
              {formatBRL(totals.lineSubtotal)}
            </Text>
          ) : null}
        </View>
      </View>
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
    gap: 10,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  nameCol: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '600',
  },
  sub: {
    color: '#737373',
    fontSize: 12,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#A3A3A3',
    fontSize: 14,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipOn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  chipOnText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '600',
  },
  chipOnPencil: {
    color: '#047857',
    fontSize: 11,
  },
  addDiscount: {
    alignSelf: 'flex-start',
  },
  addDiscountText: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '500',
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  total: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '700',
  },
  totalDiscounted: {
    color: '#047857',
    fontSize: 15,
    fontWeight: '700',
  },
  totalStrike: {
    color: '#A3A3A3',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  pressed: {
    opacity: 0.6,
  },
});
