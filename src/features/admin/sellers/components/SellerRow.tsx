import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SellerRecord } from '../service/sellersApi';
import { adminColors, adminFonts, adminRadii, sellerColors } from '../theme';

type Props = {
  seller: SellerRecord;
  onPress: () => void;
  variant?: 'phone' | 'tablet';
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? '').join('').toUpperCase() || '?';
}

export function SellerRow({ seller, onPress, variant = 'phone' }: Props) {
  const tablet = variant === 'tablet';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        tablet && styles.rowTablet,
        !seller.active && styles.rowInactive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.avatar}>
        <Text style={[styles.avatarText, !seller.active && styles.inactiveAvatarText]}>
          {initials(seller.name)}
        </Text>
      </View>
      <View style={styles.body}>
        <Text
          numberOfLines={1}
          style={[styles.name, !seller.active && styles.inactiveText]}
        >
          {seller.name}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.email, !seller.active && styles.inactiveHint]}
        >
          {seller.email}
        </Text>
      </View>
      <View
        style={[
          styles.badge,
          { backgroundColor: seller.active ? sellerColors.successFill : sellerColors.neutralBadgeFill },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            { color: seller.active ? sellerColors.successText : adminColors.textMuted },
          ]}
        >
          {seller.active ? 'Ativo' : 'Inativo'}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.card + 2,
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  rowTablet: { paddingVertical: 16, paddingHorizontal: 20, gap: 16 },
  rowInactive: { backgroundColor: adminColors.background, opacity: 0.75 },
  pressed: { opacity: 0.65 },
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
  inactiveAvatarText: { color: adminColors.textMuted },
  body: { flex: 1, gap: 2 },
  name: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  inactiveText: { color: adminColors.textMuted },
  email: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  inactiveHint: { color: adminColors.textFaint },
  badge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: adminFonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  chevron: {
    color: adminColors.textFaint,
    fontSize: 20,
    lineHeight: 20,
  },
});
