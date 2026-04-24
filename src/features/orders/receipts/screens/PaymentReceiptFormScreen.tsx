// 012-payment-receipts — US1 capture form. Amount (R$) + method
// segmented control + date row + optional notes. Attachment UX is gated
// behind Phase 6 (T049) — the block is rendered but the buttons are
// disabled with a "Em breve" hint.

import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrdersStackParamList } from '@/app/navigation/types';
import type { PaymentMethod } from '@/data/types';

import { useViewport } from '../../hooks/useViewport';
import { MethodChip } from '../components/MethodChip';
import { useReceiptForm } from '../hooks/useReceiptForm';
import { formatCents, methodLabel, parseCents, formatShortDatePt } from '../formatting';

type Props = NativeStackScreenProps<OrdersStackParamList, 'PaymentReceiptForm'>;

const METHOD_ORDER_ROW_A: readonly PaymentMethod[] = ['pix', 'cash', 'transfer'];
const METHOD_ORDER_ROW_B: readonly PaymentMethod[] = ['check', 'other'];

export function PaymentReceiptFormScreen({ navigation, route }: Props) {
  const { orderId, correctionOf } = route.params;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const isCorrection = correctionOf !== undefined;

  const {
    state,
    setAmountCents,
    setMethod,
    setNotes,
    canSubmit,
    submitting,
    error,
    submit,
  } = useReceiptForm({ orderId, ...(correctionOf !== undefined ? { correctionOf } : {}) });

  const [amountText, setAmountText] = useState('');
  const [negative, setNegative] = useState(false);

  const onAmountChange = (raw: string): void => {
    setAmountText(raw);
    const cents = parseCents(raw);
    const signed = isCorrection && negative ? -cents : cents;
    setAmountCents(signed);
  };

  const onToggleSign = (): void => {
    if (!isCorrection) return;
    setNegative((prev) => {
      const next = !prev;
      const cents = Math.abs(state.amountCents);
      setAmountCents(next ? -cents : cents);
      return next;
    });
  };

  const onSubmit = async (): Promise<void> => {
    const saved = await submit();
    if (saved !== null) {
      navigation.goBack();
    }
  };

  const displayAmount = useMemo(() => formatCents(state.amountCents), [state.amountCents]);
  const saveLabel = isCorrection ? 'Salvar correção' : 'Salvar recebimento';
  const screenTitle = isCorrection ? 'Nova correção' : 'Novo recebimento';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={[styles.topBar, isTablet && styles.topBarTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Feather name="x" size={22} color="#0A0A0A" />
        </Pressable>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle}>{screenTitle}</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}
      >
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Valor</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountPrefix}>{negative ? '−' : ''}R$</Text>
            <TextInput
              accessibilityLabel="Valor do recebimento"
              keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              value={amountText}
              onChangeText={onAmountChange}
              placeholder="0,00"
              placeholderTextColor="#A3A3A3"
              style={styles.amountInput}
            />
            {isCorrection ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={negative ? 'Tornar positivo' : 'Tornar negativo'}
                onPress={onToggleSign}
                style={({ pressed }) => [styles.signBtn, pressed && styles.pressed]}
              >
                <Text style={styles.signBtnText}>{negative ? '+' : '−'}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.amountPreview}>{displayAmount}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Método</Text>
          <View style={styles.chipRow}>
            {METHOD_ORDER_ROW_A.map((m) => (
              <MethodChip
                key={m}
                method={m}
                label={methodLabel(m)}
                selected={state.method === m}
                onPress={setMethod}
              />
            ))}
          </View>
          <View style={styles.chipRow}>
            {METHOD_ORDER_ROW_B.map((m) => (
              <MethodChip
                key={m}
                method={m}
                label={methodLabel(m)}
                selected={state.method === m}
                onPress={setMethod}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Data</Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateValue}>{formatShortDatePt(state.receivedAtMs)}</Text>
            <Feather name="calendar" size={18} color="#737373" />
          </View>
          <Text style={styles.cardHint}>
            Data default de hoje. Edição de data chega em atualização futura.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Observações (opcional)</Text>
          <TextInput
            accessibilityLabel="Observações"
            multiline
            value={state.notes}
            onChangeText={setNotes}
            placeholder="Detalhes do pagamento…"
            placeholderTextColor="#A3A3A3"
            style={styles.notesInput}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Comprovante (opcional)</Text>
          <View style={styles.attachmentDisabled}>
            <Feather name="camera" size={16} color="#A3A3A3" />
            <Text style={styles.attachmentDisabledText}>Câmera / Galeria — em breve</Text>
          </View>
        </View>

        {error !== null ? <Text style={styles.errorText}>⚠ {error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, isTablet && styles.footerTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saveLabel}
          onPress={() => void onSubmit()}
          disabled={!canSubmit || submitting}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.footerBtnPrimary,
            (!canSubmit || submitting) && styles.disabled,
            pressed && canSubmit && !submitting && styles.pressed,
          ]}
        >
          <Text style={styles.footerBtnPrimaryText}>
            {submitting ? 'Salvando…' : saveLabel}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  topBarTablet: { height: 64, paddingHorizontal: 28 },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 15, fontWeight: '600', color: '#0A0A0A' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  bodyContentTablet: { padding: 28, gap: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  cardLabel: { fontSize: 12, fontWeight: '500', color: '#525252' },
  cardHint: { fontSize: 11, color: '#A3A3A3' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountPrefix: { fontSize: 22, fontWeight: '600', color: '#737373' },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#0A0A0A',
    paddingVertical: 0,
  },
  amountPreview: { fontSize: 12, color: '#737373' },
  signBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signBtnText: { fontSize: 18, fontWeight: '700', color: '#0A0A0A' },
  chipRow: { flexDirection: 'row', gap: 8 },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateValue: { fontSize: 15, fontWeight: '600', color: '#0A0A0A' },
  notesInput: {
    minHeight: 64,
    fontSize: 14,
    color: '#0A0A0A',
    textAlignVertical: 'top',
  },
  attachmentDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  attachmentDisabledText: { fontSize: 12, color: '#A3A3A3' },
  errorText: { color: '#B91C1C', fontSize: 13 },
  footer: {
    padding: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  footerTablet: { padding: 28, paddingBottom: 28 },
  footerBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnPrimary: { backgroundColor: '#171717' },
  footerBtnPrimaryText: { color: '#FAFAFA', fontSize: 14, fontWeight: '600' },
});
