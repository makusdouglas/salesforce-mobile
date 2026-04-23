import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Viewport } from '../hooks/useViewport';
import type { QuickActionCardDTO } from '../snapshot/deriveHomeSnapshot';

type Props = {
  readonly card: QuickActionCardDTO;
  readonly viewport: Viewport;
  readonly onPress?: () => void;
  readonly onEmptyCtaPress?: () => void;
};

/**
 * One of the three quick-action cards on Home. Two render modes:
 *
 * - Populated — tappable row with icon placeholder, title, subtitle, badge, chevron.
 * - Empty     — stacked layout: icon, title, subtitle, and an optional CTA button.
 *               Drafts' empty variant uses a dashed border (variant: 'dashed') and
 *               has no CTA.
 */
export function QuickActionCard(props: Props): React.ReactElement {
  const { card, viewport, onPress, onEmptyCtaPress } = props;
  const isTablet = viewport === 'tablet';

  if (card.populated !== null) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${card.title}, ${card.populated.subtitle}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.cardBase,
          isTablet ? styles.cardTablet : styles.cardPhone,
          pressed && styles.cardPressed,
        ]}
      >
        <View
          style={[styles.iconWrap, card.kind === 'drafts' && styles.iconWrapDrafts]}
        />
        <View style={styles.textWrap}>
          <Text style={isTablet ? styles.titleTablet : styles.titlePhone}>
            {card.title}
          </Text>
          <Text style={isTablet ? styles.subtitleTablet : styles.subtitlePhone}>
            {card.populated.subtitle}
          </Text>
        </View>
        {card.populated.badge !== undefined && card.populated.badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{card.populated.badge}</Text>
          </View>
        ) : null}
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    );
  }

  // Empty variant
  const dashed = card.empty.variant === 'dashed';
  return (
    <View
      accessible
      accessibilityLabel={`${card.title}. ${card.empty.title}. ${card.empty.subtitle}`}
      style={[
        styles.cardBase,
        styles.cardEmpty,
        isTablet ? styles.cardEmptyTablet : styles.cardEmptyPhone,
        dashed && styles.cardDashed,
      ]}
    >
      <View style={styles.emptyHeadRow}>
        <View
          style={[
            styles.iconWrap,
            styles.iconWrapEmpty,
            card.kind === 'drafts' && dashed && styles.iconWrapDashed,
          ]}
        />
        <View style={styles.textWrap}>
          <Text style={styles.emptyTitle}>{card.empty.title}</Text>
          <Text style={styles.emptySubtitle}>{card.empty.subtitle}</Text>
        </View>
      </View>
      {card.empty.cta !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={card.empty.cta.label}
          onPress={onEmptyCtaPress}
          style={({ pressed }) => [
            styles.ctaBase,
            card.empty.cta?.kind === 'primary'
              ? styles.ctaPrimary
              : styles.ctaSecondary,
            pressed && styles.ctaPressed,
          ]}
        >
          <Text
            style={
              card.empty.cta.kind === 'primary'
                ? styles.ctaPrimaryLabel
                : styles.ctaSecondaryLabel
            }
          >
            {card.empty.cta.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardBase: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  cardPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 84,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  cardTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 104,
    padding: 20,
    borderRadius: 14,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardEmpty: {
    flexDirection: 'column',
    gap: 10,
  },
  cardEmptyPhone: {
    padding: 16,
    borderRadius: 12,
  },
  cardEmptyTablet: {
    padding: 20,
    borderRadius: 14,
  },
  cardDashed: {
    borderStyle: 'dashed',
    borderColor: '#D4D4D8',
  },
  emptyHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
  },
  iconWrapDrafts: {
    backgroundColor: '#FEF3C7',
  },
  iconWrapEmpty: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  iconWrapDashed: {
    backgroundColor: '#F4F4F5',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  titlePhone: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
  },
  titleTablet: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '600',
  },
  subtitlePhone: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 13,
  },
  subtitleTablet: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 14,
  },
  emptyTitle: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 12,
    lineHeight: 17,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: {
    color: '#A1A1AA',
    fontSize: 22,
    lineHeight: 22,
  },
  ctaBase: {
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimary: {
    backgroundColor: '#18181B',
  },
  ctaSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#18181B',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaPrimaryLabel: {
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
  },
  ctaSecondaryLabel: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
  },
});
