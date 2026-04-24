// 012-payment-receipts T051: attachment preview. Two shapes:
//   - "picked" (form context, no DB row yet): renders the local URI
//     directly. No sync-state badge.
//   - "saved" (detail context, receipt exists): resolves via
//     resolvePreview(receiptId), renders the image/pdf glyph, and shows
//     the sync-state badge + retry button when upload_state === 'failed'.
//
// PDFs do not get an in-app viewer — a tap on the preview opens the
// device's native viewer via expo-sharing (same path as 011 uses for
// the order PDF). Images render in-line.

import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type PaymentReceipt from '@/data/models/PaymentReceipt';
import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';
import { openStoredPdf as openPdfHelper } from '@/features/orders/send/openStoredPdf';

import { resolvePreview } from '../attachments/resolvePreview';

export interface AttachmentPreviewProps {
  readonly receipt: PaymentReceipt;
}

function sizeLabel(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentPreview({ receipt }: AttachmentPreviewProps) {
  const [uri, setUri] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const resolved = await resolvePreview(receipt.id);
      if (!cancelled) setUri(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    receipt.id,
    receipt.attachmentLocalPath,
    receipt.attachmentUrl,
    receipt.attachmentUploadState,
  ]);

  const mime = receipt.attachmentMimeType;
  const isPdf = mime === 'application/pdf';
  const isImage = mime !== null && mime !== undefined && mime.startsWith('image/');
  const state = receipt.attachmentUploadState;

  const handleOpen = (): void => {
    if (!isPdf) return;
    // openStoredPdf is 011's helper that shells out to expo-sharing with a
    // PDF mime type. Reusing it for receipt attachments keeps the
    // viewer-hand-off surface to a single implementation.
    void openPdfHelper(receipt.id).catch(() => undefined);
  };

  const handleRetry = async (): Promise<void> => {
    if (retrying || state !== 'failed') return;
    setRetrying(true);
    try {
      await paymentReceiptsRepository.retryAttachmentUpload(receipt.id);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole={isPdf ? 'button' : 'image'}
        accessibilityLabel={isPdf ? 'Abrir PDF' : 'Comprovante'}
        onPress={handleOpen}
        style={({ pressed }) => [styles.thumb, pressed && isPdf && styles.pressed]}
      >
        {isImage && uri !== null ? (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.glyph}>
            <Feather
              name={isPdf ? 'file-text' : 'image'}
              size={40}
              color="#737373"
            />
            {isPdf ? <Text style={styles.glyphHint}>Tocar para abrir</Text> : null}
          </View>
        )}
      </Pressable>

      <View style={styles.metaRow}>
        <Text style={styles.metaName} numberOfLines={1}>
          {isPdf ? 'Comprovante PDF' : 'Comprovante'}
          {receipt.attachmentSizeBytes !== null && receipt.attachmentSizeBytes > 0
            ? ` · ${sizeLabel(receipt.attachmentSizeBytes)}`
            : ''}
        </Text>
      </View>

      {state === 'failed' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tentar enviar novamente"
          disabled={retrying}
          onPress={() => void handleRetry()}
          style={({ pressed }) => [
            styles.retryBtn,
            retrying && styles.disabled,
            pressed && !retrying && styles.pressed,
          ]}
        >
          <Feather name="rotate-ccw" size={14} color="#B91C1C" />
          <Text style={styles.retryText}>
            {retrying ? 'Tentando…' : 'Tentar enviar novamente'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  thumb: {
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  glyph: { alignItems: 'center', gap: 6 },
  glyphHint: { fontSize: 11, color: '#737373' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaName: { fontSize: 12, color: '#525252', flex: 1 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  retryText: { fontSize: 13, fontWeight: '600', color: '#B91C1C' },
});
