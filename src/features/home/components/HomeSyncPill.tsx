import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { onPullToRefresh, useSyncStatus } from '@/features/sync';

import { homeCopy } from '../copy/copy';
import { useTick } from '../hooks/useTick';
import type { Viewport } from '../hooks/useViewport';
import { deriveSyncPillState, type SyncPillStateDTO } from '../sync/deriveSyncPillState';

const PILL_TICK_MS = 30_000;

type Props = {
  readonly viewport: Viewport;
};

/**
 * Home's always-visible sync indicator. Inline pill (UX4) — never a modal,
 * toast, or spinner. Four states per specs/008-home-dashboard/contracts/sync-pill.md:
 *
 * - in-sync  (green)  — "Sincronizado · <age>",   tap no-op
 * - syncing  (amber)  — "Sincronizando…",          tap no-op
 * - offline  (neutral)— "Sem conexão",             tap no-op
 * - failed   (red)    — "Falha ao sincronizar…",   tap triggers onPullToRefresh
 */
export function HomeSyncPill({ viewport }: Props): React.ReactElement {
  const snapshot = useSyncStatus();
  // Re-render every 30 s so the "há N min" age stays current between store
  // emissions (the store only emits on status/lastOkAt transitions, which
  // can be sparse during an idle session).
  const nowMs = useTick(PILL_TICK_MS);
  const state = deriveSyncPillState({
    status: snapshot.status,
    lastOkAt: snapshot.lastOkAt,
    nowMs,
  });
  const palette = palettes[state.kind];
  const label = labelFor(state);
  const a11y = a11yLabelFor(state);
  const isTablet = viewport === 'tablet';
  const interactive = state.kind === 'failed';

  const handlePress = (): void => {
    if (interactive) void onPullToRefresh();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pill,
        isTablet ? styles.pillTablet : styles.pillPhone,
        {
          backgroundColor: palette.fill,
          borderColor: palette.border,
        },
        pressed && interactive && styles.pillPressed,
      ]}
    >
      {state.kind === 'failed' ? (
        <Ionicons name="refresh" size={isTablet ? 14 : 12} color={palette.label} />
      ) : (
        <View
          style={[isTablet ? styles.dotTablet : styles.dotPhone, { backgroundColor: palette.dot }]}
        />
      )}
      <Text style={[isTablet ? styles.labelTablet : styles.labelPhone, { color: palette.label }]}>
        {label}
      </Text>
    </Pressable>
  );
}

type Palette = {
  readonly fill: string;
  readonly border: string;
  readonly dot: string;
  readonly label: string;
};

const palettes: Record<SyncPillStateDTO['kind'], Palette> = {
  'in-sync': {
    fill: '#F0FDF4',
    border: '#BBF7D0',
    dot: '#16A34A',
    label: '#166534',
  },
  syncing: {
    fill: '#FFFBEB',
    border: '#FDE68A',
    dot: '#D97706',
    label: '#92400E',
  },
  offline: {
    fill: '#F4F4F5',
    border: '#E4E4E7',
    dot: '#A1A1AA',
    label: '#52525B',
  },
  failed: {
    fill: '#FEF2F2',
    border: '#FECACA',
    dot: '#DC2626',
    label: '#991B1B',
  },
};

function labelFor(state: SyncPillStateDTO): string {
  switch (state.kind) {
    case 'in-sync':
      return state.ageLabel === null
        ? homeCopy.syncPill.inSyncLabelNoAge
        : homeCopy.syncPill.inSyncLabel(state.ageLabel);
    case 'syncing':
      return homeCopy.syncPill.syncingLabel;
    case 'offline':
      return homeCopy.syncPill.offlineLabel;
    case 'failed':
      return homeCopy.syncPill.failedLabel;
  }
}

function a11yLabelFor(state: SyncPillStateDTO): string {
  switch (state.kind) {
    case 'in-sync':
      return state.ageLabel === null
        ? homeCopy.syncPill.inSyncA11yNoAge
        : homeCopy.syncPill.inSyncA11y(state.ageLabel);
    case 'syncing':
      return homeCopy.syncPill.syncingA11y;
    case 'offline':
      return homeCopy.syncPill.offlineA11y;
    case 'failed':
      return homeCopy.syncPill.failedA11y;
  }
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  pillPhone: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    gap: 6,
  },
  pillTablet: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    gap: 8,
  },
  pillPressed: {
    opacity: 0.75,
  },
  dotPhone: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotTablet: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  labelPhone: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
  },
  labelTablet: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
  },
});
