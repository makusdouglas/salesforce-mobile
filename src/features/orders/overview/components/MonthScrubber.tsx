import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMonthKeyPt } from '../selectors/monthRange';

export type MonthScrubberProps = {
  readonly monthKey: string;
  readonly subtitle?: string | null;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onTitlePress?: () => void;
  readonly canGoNext?: boolean;
};

export function MonthScrubber({
  monthKey,
  subtitle,
  onPrev,
  onNext,
  onTitlePress,
  canGoNext = true,
}: MonthScrubberProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
        onPress={onPrev}
        hitSlop={12}
        style={({ pressed }) => [styles.chev, pressed && styles.chevPressed]}
      >
        <Feather name="chevron-left" size={18} color="#0A0A0A" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Selecionar mês — atualmente ${formatMonthKeyPt(monthKey)}`}
        onPress={onTitlePress}
        disabled={!onTitlePress}
        hitSlop={8}
        style={({ pressed }) => [styles.mid, pressed && styles.midPressed]}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {formatMonthKeyPt(monthKey)}
          </Text>
          {onTitlePress ? (
            <Feather name="chevron-down" size={14} color="#0A0A0A" />
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
        onPress={onNext}
        disabled={!canGoNext}
        hitSlop={12}
        style={({ pressed }) => [
          styles.chev,
          !canGoNext && styles.chevDisabled,
          pressed && canGoNext && styles.chevPressed,
        ]}
      >
        <Feather
          name="chevron-right"
          size={18}
          color={canGoNext ? '#0A0A0A' : '#D4D4D8'}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E4E4E7',
    borderBottomWidth: 1,
  },
  chev: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  chevDisabled: { opacity: 0.6 },
  chevPressed: { backgroundColor: '#F4F4F5' },
  mid: { alignItems: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 8 },
  midPressed: { backgroundColor: '#F4F4F5' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '600', color: '#0A0A0A' },
  sub: { fontSize: 11, color: '#737373' },
});
