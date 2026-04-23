// 010-repeat-last-order: primary CTA on ClientProfileScreen.
//
// Shows the client's most recent SENT order with date + item count + total,
// and clones it into a new draft on tap. When `lastSent === null` the card
// renders nothing (FR-015). Visual treatment follows
// design/client-profile-phone.png and design/client-profile-tablet.png —
// dark zinc-900 background, refresh-cw icon, right-side "Abrir resumo" pill
// on tablet.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatBRL } from '@/features/orders/formatting/formatBRL';

import { type Viewport } from '../hooks/useViewport';

export type RepeatHeroLastSent = {
  readonly dateLabel: string;
  readonly itemCount: number;
  readonly total: number;
};

export type RepeatHeroCardProps = {
  readonly lastSent: RepeatHeroLastSent | null;
  readonly viewport: Viewport;
  readonly onPress: () => void;
  readonly busy?: boolean;
};

export function RepeatHeroCard({ lastSent, viewport, onPress, busy = false }: RepeatHeroCardProps) {
  if (lastSent === null) return null;
  const isTablet = viewport === 'tablet';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Repetir último pedido"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.card,
        isTablet && styles.cardTablet,
        pressed && !busy && styles.pressed,
        busy && styles.busy,
      ]}
    >
      <View style={[styles.iconBg, isTablet && styles.iconBgTablet]}>
        <Feather name="refresh-cw" size={isTablet ? 22 : 20} color="#FAFAFA" />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Repetir último pedido</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {`${lastSent.dateLabel} · ${lastSent.itemCount} ${lastSent.itemCount === 1 ? 'item' : 'itens'} · ${formatBRL(lastSent.total)}`}
        </Text>
      </View>
      {isTablet ? (
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Abrir resumo</Text>
          <Feather name="arrow-right" size={14} color="#18181B" />
        </View>
      ) : (
        <Feather name="chevron-right" size={22} color="#FAFAFA" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#18181B',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardTablet: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  pressed: {
    opacity: 0.88,
  },
  busy: {
    opacity: 0.6,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBgTablet: {
    width: 44,
    height: 44,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: '#A1A1AA',
    fontSize: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAFAFA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillLabel: {
    color: '#18181B',
    fontSize: 13,
    fontWeight: '600',
  },
});
