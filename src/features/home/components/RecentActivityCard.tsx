import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { homeCopy } from '../copy/copy';
import type { Viewport } from '../hooks/useViewport';
import type { RecentActivityEmptyDTO } from '../snapshot/deriveHomeSnapshot';
import { formatRelativeSyncAge } from '../sync/formatRelativeSyncAge';
import type { RecentActivityDTO } from '../types';

import { DashedPlaceholderCard } from './DashedPlaceholderCard';

type Props = {
  readonly viewport: Viewport;
  readonly activity: RecentActivityDTO | null;
  readonly empty: RecentActivityEmptyDTO;
  readonly nowMs: number;
  readonly onPress?: () => void;
};

function formatBRL(cents: number): string {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function RecentActivityCard(props: Props): React.ReactElement {
  const { viewport, activity, empty, nowMs, onPress } = props;
  const isTablet = viewport === 'tablet';

  if (activity === null) {
    return (
      <DashedPlaceholderCard viewport={viewport} title={empty.title} subtitle={empty.subtitle} />
    );
  }

  const ageLabel = formatRelativeSyncAge(activity.sentAtMs, nowMs);
  const title = `${homeCopy.recentActivity.populatedTitlePrefix}${activity.storeName}`;
  const meta = `${formatBRL(activity.totalCentsAmount)} · ${ageLabel}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${meta}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isTablet ? styles.cardTablet : styles.cardPhone,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="send" size={18} color="#047857" />
      </View>
      <View style={styles.textWrap}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={isTablet ? styles.titleTablet : styles.titlePhone}
        >
          {title}
        </Text>
        <Text style={isTablet ? styles.metaTablet : styles.metaPhone}>{meta}</Text>
      </View>
      {isTablet ? <Ionicons name="chevron-forward" size={22} color="#A1A1AA" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPhone: {
    height: 72,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  cardTablet: {
    padding: 24,
    borderRadius: 14,
    gap: 14,
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  titlePhone: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
  },
  titleTablet: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
  },
  metaPhone: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 12,
  },
  metaTablet: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 13,
  },
});
