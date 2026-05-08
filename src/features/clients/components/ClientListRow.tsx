import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type ClientListItemDTO } from '../types';

import { PendingSyncBadge } from './PendingSyncBadge';

export type ClientListRowProps = {
  readonly client: ClientListItemDTO;
  readonly onPress: (clientId: string) => void;
  readonly viewport: Viewport;
};

function initial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  const first = trimmed.charAt(0);
  return first.toLocaleUpperCase('pt-BR');
}

export function ClientListRow({ client, onPress, viewport }: ClientListRowProps) {
  const isTablet = viewport === 'tablet';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={client.name}
      onPress={() => onPress(client.id)}
      style={({ pressed }) => [
        styles.row,
        isTablet && styles.rowTablet,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.avatar, isTablet && styles.avatarTablet]}>
        <Text style={styles.avatarText}>{initial(client.name)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {client.name}
        </Text>
        {client.addressSnippet !== null ? (
          <Text style={styles.secondary} numberOfLines={1}>
            {client.addressSnippet}
          </Text>
        ) : null}
        {client.contactSnippet !== null ? (
          <Text style={styles.secondary} numberOfLines={1}>
            {client.contactSnippet}
          </Text>
        ) : null}
        {client.isPendingSync ? (
          <View style={styles.badgeRow}>
            <PendingSyncBadge visible />
          </View>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 72,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
    gap: 12,
  },
  rowTablet: {
    paddingVertical: 14,
    minHeight: 84,
  },
  rowPressed: {
    backgroundColor: '#FAFAFA',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTablet: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#18181B',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  secondary: {
    fontSize: 12,
    color: '#71717A',
  },
  badgeRow: {
    marginTop: 4,
  },
  chevron: {
    fontSize: 22,
    color: '#A1A1AA',
    marginStart: 4,
  },
});
