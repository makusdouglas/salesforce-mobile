import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { currentMonthKey } from '../selectors/monthRange';

const MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-');
  return {
    year: Number.parseInt(y ?? '0', 10),
    month: Math.max(1, Math.min(12, Number.parseInt(m ?? '1', 10))),
  };
}

export type MonthYearPickerProps = {
  readonly visible: boolean;
  readonly activeMonth: string;
  readonly onChange: (monthKey: string) => void;
  readonly onClose: () => void;
};

/**
 * 013-orders-overview: month + year picker opened from the MonthScrubber
 * title. The user picks a specific month in a specific year instead of
 * scrubbing one step at a time.
 *
 * Keeps local state for the visible year while the modal is open so the
 * user can browse years without committing; the filter only updates on
 * month tap or "Este mês".
 */
export function MonthYearPicker({
  visible,
  activeMonth,
  onChange,
  onClose,
}: MonthYearPickerProps) {
  const parsedActive = parseMonthKey(activeMonth);
  const [viewYear, setViewYear] = useState<number>(parsedActive.year);
  const current = parseMonthKey(currentMonthKey());

  const commit = (year: number, month: number): void => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    onChange(key);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      onShow={() => setViewYear(parseMonthKey(activeMonth).year)}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.grabber} />
            <View style={styles.yearRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ano anterior"
                onPress={() => setViewYear((y) => y - 1)}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.chev,
                  pressed && styles.chevPressed,
                ]}
              >
                <Feather name="chevron-left" size={20} color="#0A0A0A" />
              </Pressable>
              <Text style={styles.yearLabel}>{viewYear}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Próximo ano"
                onPress={() => setViewYear((y) => y + 1)}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.chev,
                  pressed && styles.chevPressed,
                ]}
              >
                <Feather name="chevron-right" size={20} color="#0A0A0A" />
              </Pressable>
            </View>

            <View style={styles.grid}>
              {MONTHS_PT.map((label, idx) => {
                const monthNum = idx + 1;
                const isActive =
                  viewYear === parsedActive.year && monthNum === parsedActive.month;
                const isCurrent =
                  viewYear === current.year && monthNum === current.month;
                return (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} de ${viewYear}`}
                    accessibilityState={{ selected: isActive }}
                    onPress={() => commit(viewYear, monthNum)}
                    style={({ pressed }) => [
                      styles.cell,
                      isActive && styles.cellActive,
                      !isActive && isCurrent && styles.cellCurrent,
                      pressed && styles.cellPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellLabel,
                        isActive && styles.cellLabelActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={() => commit(current.year, current.month)}
                style={({ pressed }) => [
                  styles.todayBtn,
                  pressed && styles.todayBtnPressed,
                ]}
              >
                <Text style={styles.todayLabel}>Este mês</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.cancelBtnPressed,
                ]}
              >
                <Text style={styles.cancelLabel}>Cancelar</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E4E4E7',
    marginBottom: 18,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chev: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  chevPressed: { backgroundColor: '#F4F4F5' },
  yearLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A',
    fontVariant: ['tabular-nums'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '23.5%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  cellActive: { backgroundColor: '#0A0A0A' },
  cellCurrent: { borderWidth: 1, borderColor: '#0A0A0A' },
  cellPressed: { opacity: 0.7 },
  cellLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3F3F46',
    textTransform: 'capitalize',
  },
  cellLabelActive: { color: '#FFFFFF' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  todayBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  todayBtnPressed: { opacity: 0.85 },
  todayLabel: { fontSize: 13, fontWeight: '600', color: '#0A0A0A' },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
  },
  cancelBtnPressed: { opacity: 0.85 },
  cancelLabel: { fontSize: 13, fontWeight: '600', color: '#525252' },
});
