import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Viewport } from '../hooks/useViewport';

type Props = {
  readonly viewport: Viewport;
  readonly title: string;
  readonly subtitle: string;
};

/**
 * Dashed-border empty-state card shell — used by the empty Atividade
 * Recente slot. Drafts' empty card is similar but lives inside
 * QuickActionCard because it needs to match the quick-action layout.
 */
export function DashedPlaceholderCard(props: Props): React.ReactElement {
  const { viewport, title, subtitle } = props;
  const isTablet = viewport === 'tablet';
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${subtitle}`}
      style={[styles.card, isTablet ? styles.cardTablet : styles.cardPhone]}
    >
      <View style={styles.iconWrap} />
      <View style={styles.textWrap}>
        <Text style={isTablet ? styles.titleTablet : styles.titlePhone}>
          {title}
        </Text>
        <Text style={isTablet ? styles.subtitleTablet : styles.subtitlePhone}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardPhone: {
    height: 72,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  cardTablet: {
    padding: 24,
    borderRadius: 14,
    gap: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F4F5',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  titlePhone: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
  },
  titleTablet: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '600',
  },
  subtitlePhone: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 12,
  },
  subtitleTablet: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 18,
  },
});
