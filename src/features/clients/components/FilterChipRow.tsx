import type { ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { normalize } from '../search/normalize';
import type { ClientFilter, ClientListItemDTO } from '../types';

export type FilterChipRowProps = {
  readonly clients: readonly ClientListItemDTO[];
  readonly activeFilter: ClientFilter;
  readonly onChange: (next: ClientFilter) => void;
  readonly viewport: Viewport;
};

function deriveLetters(clients: readonly ClientListItemDTO[]): readonly string[] {
  const set = new Set<string>();
  for (const client of clients) {
    const first = normalize(client.name).charAt(0);
    if (first.length === 0) continue;
    if (!/[a-z]/i.test(first)) continue;
    set.add(first.toUpperCase());
  }
  return Array.from(set).sort();
}

export function FilterChipRow({
  clients,
  activeFilter,
  onChange,
  viewport,
}: FilterChipRowProps): ReactElement | null {
  // No chips at all when there are no clients — the first-launch empty state
  // is handled at the screen level.
  if (clients.length === 0) {
    return null;
  }

  const letters = deriveLetters(clients);

  // "Recentes" always shows when there's at least one client (a single client
  // is, by definition, recent). Letter chips only appear once the list has
  // >=2 distinct first letters, per FR-020 graceful-degradation clause.
  const showLetters = letters.length >= 2;

  const isTablet = viewport === 'tablet';
  const isRecent = activeFilter?.kind === 'recent';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={[styles.container, isTablet && styles.containerTablet]}
    >
      <Chip
        label="Recentes"
        active={isRecent}
        onPress={() => onChange(isRecent ? null : { kind: 'recent' })}
      />
      {showLetters && letters.map((letter) => {
        const active =
          activeFilter?.kind === 'letter' && activeFilter.value === letter;
        return (
          <Chip
            key={letter}
            label={letter}
            active={active}
            onPress={() =>
              onChange(active ? null : { kind: 'letter', value: letter })
            }
          />
        );
      })}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipInactive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerTablet: {
    paddingHorizontal: 28,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
  },
  chipLabelActive: {
    color: '#FAFAFA',
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelInactive: {
    color: '#18181B',
    fontSize: 13,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.75,
  },
});
