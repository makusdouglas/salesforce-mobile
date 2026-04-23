import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { deriveConfirmModalShape } from './shape';

const TABLET_MIN_WIDTH = 768;

export type ConfirmModalProps = {
  readonly open: boolean;
  readonly title: string;
  readonly body?: string;
  readonly cancelLabel?: string;
  readonly primaryLabel: string;
  readonly primaryVariant?: 'default' | 'destructive';
  readonly onCancel?: () => void;
  readonly onPrimary: () => void;
};

export function ConfirmModal(props: ConfirmModalProps): React.ReactElement | null {
  const {
    open,
    title,
    body,
    cancelLabel,
    primaryLabel,
    primaryVariant,
    onCancel,
    onPrimary,
  } = props;

  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const shape = deriveConfirmModalShape({
    ...(cancelLabel !== undefined && { cancelLabel }),
    ...(primaryVariant !== undefined && { primaryVariant }),
  });

  if (!open) return null;

  const backdropTap = (): void => {
    if (onCancel) onCancel();
    else onPrimary();
  };

  const cardStyle = isTablet ? styles.cardTablet : styles.cardPhone;
  const titleStyle = isTablet ? styles.titleTablet : styles.titlePhone;
  const bodyStyle = isTablet ? styles.bodyTablet : styles.bodyPhone;
  const buttonHeight = isTablet ? styles.btnHeightTablet : styles.btnHeightPhone;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={backdropTap}>
      <Pressable
        accessibilityLabel="Fechar"
        onPress={backdropTap}
        style={styles.backdrop}
      >
        <Pressable onPress={() => {}} style={[styles.card, cardStyle]}>
          <View style={styles.textWrap}>
            <Text style={titleStyle}>{title}</Text>
            {body !== undefined ? <Text style={bodyStyle}>{body}</Text> : null}
          </View>
          <View
            style={[
              styles.btnRow,
              isTablet ? styles.btnRowTablet : styles.btnRowPhone,
            ]}
          >
            {shape.showCancel ? (
              <Pressable
                accessibilityRole="button"
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.btn,
                  buttonHeight,
                  styles.btnCancel,
                  isTablet ? styles.btnCancelTablet : styles.btnCancelPhone,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.btnCancelLabel}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onPrimary}
              style={({ pressed }) => [
                styles.btn,
                buttonHeight,
                isTablet ? styles.btnPrimaryTablet : styles.btnPrimaryPhone,
                { backgroundColor: shape.primaryFill },
                pressed && styles.btnPressed,
              ]}
            >
              <Text
                style={[styles.btnPrimaryLabel, { color: shape.primaryTextColor }]}
              >
                {primaryLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#09090B99',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    elevation: 8,
  },
  cardPhone: {
    width: 324,
    padding: 24,
    borderRadius: 16,
    gap: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
  },
  cardTablet: {
    width: 480,
    padding: 32,
    borderRadius: 18,
    gap: 20,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 32,
  },
  textWrap: {
    gap: 8,
  },
  titlePhone: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '700',
  },
  titleTablet: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '700',
  },
  bodyPhone: {
    color: '#52525B',
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 18,
  },
  bodyTablet: {
    color: '#52525B',
    fontFamily: 'Inter',
    fontSize: 15,
    lineHeight: 22,
  },
  btnRow: {
    flexDirection: 'row',
  },
  btnRowPhone: {
    gap: 10,
  },
  btnRowTablet: {
    gap: 12,
    justifyContent: 'flex-end',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnHeightPhone: {
    height: 44,
    borderRadius: 8,
  },
  btnHeightTablet: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 24,
  },
  btnCancel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  btnCancelPhone: {
    flex: 1,
  },
  btnCancelTablet: {
    minWidth: 120,
  },
  btnPrimaryPhone: {
    flex: 1,
  },
  btnPrimaryTablet: {
    minWidth: 120,
    paddingHorizontal: 28,
  },
  btnCancelLabel: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
  },
  btnPrimaryLabel: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.85,
  },
});
