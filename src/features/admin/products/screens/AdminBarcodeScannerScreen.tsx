import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BarcodeScanningResult,
  BarcodeType,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';

import { useBarcodeLookup } from '../hooks/useBarcodeLookup';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminBarcodeScanner'>;

const SYMBOLOGIES: BarcodeType[] = ['code128', 'ean13', 'ean8', 'upc_a', 'qr'];

export function AdminBarcodeScannerScreen() {
  const nav = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const { run, pending } = useBarcodeLookup();
  const [typed, setTyped] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const scannedRef = useRef(false);

  const handleCode = useCallback(
    async (code: string) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      setBanner(null);
      const result = await run(code);
      if (result.status === 'match') {
        nav.replace('AdminBarcodeMatch', { productId: result.product.id });
        return;
      }
      if (result.status === 'no_match') {
        nav.replace('AdminProductForm', { prefilledBarcode: code.trim() });
        return;
      }
      if (result.status === 'offline') {
        setBanner('Você está offline — conecte-se para verificar o código.');
      } else {
        setBanner(result.message);
      }
      scannedRef.current = false;
    },
    [nav, run],
  );

  const onScanResult = useCallback(
    (event: BarcodeScanningResult) => {
      if (!event?.data) return;
      void handleCode(event.data);
    },
    [handleCode],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.topBar}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>Escanear</Text>
        <Pressable
          onPress={() => setTorch((t) => !t)}
          style={styles.torch}
          hitSlop={8}
        >
          <Text style={styles.torchGlyph}>{torch ? '⚡︎' : '⚡'}</Text>
        </Pressable>
      </View>

      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: SYMBOLOGIES }}
            onBarcodeScanned={onScanResult}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionTitle}>Câmera indisponível</Text>
            <Text style={styles.permissionHint}>
              Permita o acesso à câmera ou digite o código manualmente abaixo.
            </Text>
            <Pressable
              onPress={() => {
                void requestPermission();
              }}
              style={styles.permissionBtn}
            >
              <Text style={styles.permissionBtnText}>Permitir câmera</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.reticle} pointerEvents="none" />
      </View>

      <View style={styles.manualWrap}>
        <Text style={styles.manualLabel}>Ou digite o código manualmente</Text>
        <View style={styles.manualInput}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="7891234567890"
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="number-pad"
            style={styles.manualText}
            autoCorrect={false}
          />
        </View>
        {banner ? <Text style={styles.banner}>{banner}</Text> : null}
        <Pressable
          style={styles.verifyBtn}
          onPress={() => void handleCode(typed)}
          disabled={pending || typed.trim().length === 0}
        >
          {pending ? (
            <ActivityIndicator color={adminColors.textPrimary} />
          ) : (
            <Text style={styles.verifyText}>Verificar código</Text>
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#09090B' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
  },
  close: { color: '#FFFFFF', fontSize: 22 },
  title: {
    color: '#FFFFFF',
    fontFamily: adminFonts.heading,
    fontSize: 17,
    fontWeight: '600',
  },
  torch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  torchGlyph: { color: '#FFFFFF', fontSize: 18 },
  cameraWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reticle: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: adminRadii.modal,
  },
  permissionBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090B',
    padding: 24,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontFamily: adminFonts.heading,
    fontSize: 16,
    fontWeight: '600',
  },
  permissionHint: {
    color: '#D4D4D8',
    fontFamily: adminFonts.body,
    fontSize: 13,
    textAlign: 'center',
  },
  permissionBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: adminRadii.input,
    backgroundColor: '#FFFFFF',
  },
  permissionBtnText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  manualWrap: {
    padding: 20,
    gap: 10,
    backgroundColor: '#09090B',
  },
  manualLabel: {
    color: '#A1A1AA',
    fontFamily: adminFonts.body,
    fontSize: 13,
    textAlign: 'center',
  },
  manualInput: {
    height: 48,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.inputOverlayStroke,
    backgroundColor: adminColors.inputOverlayFill,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  manualText: {
    color: '#FFFFFF',
    fontFamily: adminFonts.mono,
    fontSize: 15,
    paddingVertical: 0,
  },
  banner: {
    color: '#FACC15',
    fontFamily: adminFonts.body,
    fontSize: 13,
    textAlign: 'center',
  },
  verifyBtn: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: adminRadii.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  verifyText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 15,
    fontWeight: '600',
  },
});
