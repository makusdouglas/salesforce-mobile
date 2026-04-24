// 012-payment-receipts — capture form. Amount (R$) + method segmented
// control + date row + optional notes + optional photo/PDF attachment.
// Phase 6 activated the attachment pipeline: Câmera (expo-image-picker)
// and Galeria / PDF (action-sheet routing to image-picker OR
// document-picker). On pick → validate (MIME + 10 MB cap) → stage
// (copy to <docDir>/receipts/staging/<receiptId>.<ext>). On submit the
// staged metadata is passed through to repo.create/createCorrection.

import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
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
import {
  pickFromCamera,
  pickFromLibrary,
  type PickedFile,
} from '../attachments/pickAttachment';
import { stage } from '../attachments/stage';
import {
  AttachmentValidationError,
  validateAttachment,
} from '../attachments/validation';
import { AttachmentSourcePicker } from '../components/AttachmentSourcePicker';
import { MethodChip } from '../components/MethodChip';
import { useReceiptForm } from '../hooks/useReceiptForm';
import { formatBRL, methodLabel, parseBRL, formatShortDatePt } from '../formatting';

type Props = NativeStackScreenProps<OrdersStackParamList, 'PaymentReceiptForm'>;

const METHOD_ORDER_ROW_A: readonly PaymentMethod[] = ['pix', 'cash', 'transfer'];
const METHOD_ORDER_ROW_B: readonly PaymentMethod[] = ['check', 'other'];

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PaymentReceiptFormScreen({ navigation, route }: Props) {
  const { orderId, correctionOf } = route.params;
  const viewport = useViewport();
  const isTablet = viewport === 'tablet';
  const isCorrection = correctionOf !== undefined;

  const {
    receiptId,
    state,
    setAmount,
    setMethod,
    setNotes,
    setAttachment,
    canSubmit,
    submitting,
    error,
    submit,
  } = useReceiptForm({ orderId, ...(correctionOf !== undefined ? { correctionOf } : {}) });

  const [amountText, setAmountText] = useState('');
  const [negative, setNegative] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);

  const onAmountChange = (raw: string): void => {
    setAmountText(raw);
    const decimal = parseBRL(raw);
    const signed = isCorrection && negative ? -decimal : decimal;
    setAmount(signed);
  };

  const onToggleSign = (): void => {
    if (!isCorrection) return;
    setNegative((prev) => {
      const next = !prev;
      const absValue = Math.abs(state.amount);
      setAmount(next ? -absValue : absValue);
      return next;
    });
  };

  const onSubmit = async (): Promise<void> => {
    const saved = await submit();
    if (saved !== null) {
      navigation.goBack();
    }
  };

  const handlePick = async (pick: () => Promise<PickedFile | null>): Promise<void> => {
    if (attachmentBusy) return;
    setAttachmentBusy(true);
    setAttachmentError(null);
    try {
      const picked = await pick();
      if (picked === null) return;
      const validated = await validateAttachment(picked);
      const staged = await stage({
        receiptId,
        sourceUri: validated.uri,
        mimeType: validated.mimeType,
      });
      setAttachment({
        localPath: staged.localPath,
        mimeType: staged.mimeType,
        sizeBytes: staged.sizeBytes,
      });
    } catch (err) {
      if (err instanceof AttachmentValidationError) {
        setAttachmentError(err.message);
      } else if (err instanceof Error && err.message === 'permission_denied') {
        setAttachmentError(
          'Permissão negada. Autorize nas configurações do dispositivo para anexar um comprovante.',
        );
      } else {
        setAttachmentError(err instanceof Error ? err.message : 'Falha ao anexar arquivo');
      }
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleCamera = (): void => {
    void handlePick(pickFromCamera);
  };

  const handleOpenSourcePicker = (): void => {
    if (attachmentBusy) return;
    setAttachmentError(null);
    setSourcePickerOpen(true);
  };

  const handlePickImage = (): void => {
    void handlePick(() => pickFromLibrary({ kind: 'image' }));
  };

  const handlePickPdf = (): void => {
    void handlePick(() => pickFromLibrary({ kind: 'pdf' }));
  };

  const handleRemoveAttachment = (): void => {
    setAttachment(null);
    setAttachmentError(null);
  };

  const displayAmount = useMemo(() => formatBRL(state.amount), [state.amount]);
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

      <KeyboardAvoidingView
        style={styles.avoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, isTablet && styles.bodyContentTablet]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
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
          <View style={styles.attachButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir câmera"
              disabled={attachmentBusy}
              onPress={handleCamera}
              style={({ pressed }) => [
                styles.attachBtn,
                attachmentBusy && styles.disabled,
                pressed && !attachmentBusy && styles.pressed,
              ]}
            >
              <Feather name="camera" size={16} color="#0A0A0A" />
              <Text style={styles.attachBtnText}>Câmera</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Escolher da galeria ou PDF"
              disabled={attachmentBusy}
              onPress={handleOpenSourcePicker}
              style={({ pressed }) => [
                styles.attachBtn,
                attachmentBusy && styles.disabled,
                pressed && !attachmentBusy && styles.pressed,
              ]}
            >
              <Feather name="image" size={16} color="#0A0A0A" />
              <Text style={styles.attachBtnText}>Galeria / PDF</Text>
            </Pressable>
          </View>

          {state.attachment !== null ? (
            <View style={styles.previewRow}>
              <View style={styles.previewThumb}>
                {state.attachment.mimeType === 'application/pdf' ? (
                  <Feather name="file-text" size={24} color="#525252" />
                ) : (
                  <Image
                    source={{
                      uri: state.attachment.localPath.startsWith('file://')
                        ? state.attachment.localPath
                        : `file://${state.attachment.localPath}`,
                    }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                )}
              </View>
              <View style={styles.previewMeta}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {state.attachment.mimeType === 'application/pdf' ? 'PDF anexado' : 'Foto anexada'}
                </Text>
                <Text style={styles.previewCaption}>
                  {formatBytes(state.attachment.sizeBytes)} · cache local · aguardando sync
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remover anexo"
                onPress={handleRemoveAttachment}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
              >
                <Feather name="x" size={18} color="#737373" />
              </Pressable>
            </View>
          ) : null}

          {attachmentError !== null ? (
            <Text style={styles.errorText}>⚠ {attachmentError}</Text>
          ) : null}
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
      </KeyboardAvoidingView>

      <AttachmentSourcePicker
        open={sourcePickerOpen}
        onPickImage={handlePickImage}
        onPickPdf={handlePickPdf}
        onCancel={() => setSourcePickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  avoiding: { flex: 1 },
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
  attachButtons: { flexDirection: 'row', gap: 10 },
  attachBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FAFAFA',
  },
  attachBtnText: { fontSize: 13, fontWeight: '600', color: '#0A0A0A' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  previewThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  previewMeta: { flex: 1 },
  previewName: { fontSize: 13, fontWeight: '500', color: '#0A0A0A' },
  previewCaption: { fontSize: 11, color: '#737373' },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
