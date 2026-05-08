// 012-payment-receipts: styled modal that branches a single "Galeria /
// PDF" button into two choices — photo from library (image-picker) or
// PDF from the file library (document-picker). Mirrors the visual
// language of ConfirmModal (@/app/ui/modal) but with two action rows
// instead of the one-primary-plus-cancel shape.

import { Feather } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

const TABLET_MIN_WIDTH = 768;

export interface AttachmentSourcePickerProps {
  readonly open: boolean;
  readonly onPickImage: () => void;
  readonly onPickPdf: () => void;
  readonly onCancel: () => void;
}

export function AttachmentSourcePicker({
  open,
  onPickImage,
  onPickPdf,
  onCancel,
}: AttachmentSourcePickerProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;

  if (!open) return null;

  const cardStyle = isTablet ? styles.cardTablet : styles.cardPhone;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={open}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        accessibilityLabel="Fechar"
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.backdrop}
      >
        <Pressable onPress={() => undefined} style={[styles.card, cardStyle]}>
          <Text style={styles.title}>Anexar comprovante</Text>
          <Text style={styles.subtitle}>Escolha o tipo de arquivo</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher foto da galeria"
            onPress={() => {
              onCancel();
              onPickImage();
            }}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <View style={styles.optionIconWrap}>
              <Feather name="image" size={20} color="#0A0A0A" />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Foto da galeria</Text>
              <Text style={styles.optionSub}>JPG, PNG ou HEIC · até 10 MB</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#A3A3A3" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher arquivo PDF"
            onPress={() => {
              onCancel();
              onPickPdf();
            }}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <View style={styles.optionIconWrap}>
              <Feather name="file-text" size={20} color="#0A0A0A" />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Documento PDF</Text>
              <Text style={styles.optionSub}>Arquivo assinado · até 10 MB</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#A3A3A3" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            onPress={onCancel}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  cardPhone: { width: '100%', maxWidth: 420 },
  cardTablet: { width: 480 },
  title: { fontSize: 17, fontWeight: '700', color: '#0A0A0A' },
  subtitle: { fontSize: 13, color: '#737373', marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextWrap: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 14, fontWeight: '600', color: '#0A0A0A' },
  optionSub: { fontSize: 12, color: '#737373' },
  pressed: { opacity: 0.75 },
  cancel: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#525252' },
});
