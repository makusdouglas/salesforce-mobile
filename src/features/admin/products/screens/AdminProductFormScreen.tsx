import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';
import { KeyboardAwareScroll } from '@/app/ui/KeyboardAwareScroll';

import { AdminProductDeactivateConfirmModal } from '../components/AdminProductDeactivateConfirmModal';
import { BarcodeField } from '../components/BarcodeField';
import { ProductImagePicker } from '../components/ProductImagePicker';
import { VariantRow } from '../components/VariantRow';
import { useProductForm } from '../hooks/useProductForm';
import { useProductImageUpload } from '../hooks/useProductImageUpload';
import { useAdminProductsLayout } from '../responsive/useAdminProductsLayout';
import { barcodeCaptureChannel } from '../service/barcodeCaptureChannel';
import { imageSourceChannel } from '../service/imageSourceChannel';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminProductForm'>;
type Route = RouteProp<AdminStackParamList, 'AdminProductForm'>;

export function AdminProductFormScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const viewport = useAdminProductsLayout();

  const form = useProductForm({
    productId: route.params?.productId ?? undefined,
    prefilledBarcode: route.params?.prefilledBarcode ?? undefined,
  });
  const imageUpload = useProductImageUpload();
  const [uploadBanner, setUploadBanner] = useState<string | null>(null);

  // 016-product-lifecycle-roles — confirm before toggling active state.
  // Reactivation goes through the same modal so the admin sees a
  // consistent confirmation pattern.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingActive, setPendingActive] = useState<boolean | null>(null);

  const askToggleActive = (next: boolean) => {
    setPendingActive(next);
    setConfirmOpen(true);
  };

  const confirmToggleActive = async () => {
    if (pendingActive === null) return;
    const result = await form.toggleActive(pendingActive);
    if (result === 'ok') {
      setConfirmOpen(false);
      setPendingActive(null);
    }
    // On failure we leave the modal open so the error banner can render;
    // the user can retry or cancel.
  };

  const cancelToggle = () => {
    setConfirmOpen(false);
    setPendingActive(null);
  };

  const handleImagePick = async (source: 'camera' | 'library') => {
    setUploadBanner(null);
    const result =
      source === 'camera'
        ? await imageUpload.takePhoto(form.state.id)
        : await imageUpload.pickFromLibrary(form.state.id);
    if (result.status === 'ok') {
      form.setImageUrl(result.url);
      return;
    }
    if (result.status === 'cancelled') return;
    if (result.status === 'permission_denied') {
      setUploadBanner(
        source === 'camera'
          ? 'Permita acesso à câmera para tirar uma foto.'
          : 'Permita acesso às fotos para escolher uma imagem.',
      );
      return;
    }
    if (result.status === 'offline') {
      setUploadBanner('Você está offline — conecte-se para enviar a imagem.');
      return;
    }
    setUploadBanner(result.message);
  };

  const onPickImage = () => {
    imageSourceChannel.request((source) => {
      void handleImagePick(source);
    });
    nav.navigate('AdminImageSource');
  };

  const onSave = async () => {
    const outcome = await form.save();
    if (outcome.status === 'saved') {
      nav.navigate('AdminProducts');
      return;
    }
    if (outcome.status === 'barcode_conflict' && outcome.conflictingProductId) {
      nav.replace('AdminBarcodeMatch', {
        productId: outcome.conflictingProductId,
      });
    }
  };

  const isEditing = form.state.id !== undefined;

  const bodyPadding = viewport === 'tablet' ? 28 : 16;
  const bodyGap = 16;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.topBar, viewport === 'tablet' && styles.topBarTablet]}>
        <Pressable style={styles.backGroup} onPress={() => nav.goBack()}>
          <Text style={styles.back}>‹</Text>
          <Text style={styles.title}>{isEditing ? 'Editar produto' : 'Novo produto'}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.save,
            (form.saving || form.barcodeConflict !== null) && styles.saveDisabled,
          ]}
          onPress={
            form.saving || form.barcodeConflict !== null ? undefined : onSave
          }
        >
          {form.saving ? (
            <ActivityIndicator color={adminColors.primaryOn} />
          ) : (
            <Text style={styles.saveText}>Salvar</Text>
          )}
        </Pressable>
      </View>

      {form.loading ? (
        <View style={styles.loadingFill}>
          <ActivityIndicator color={adminColors.textPrimary} />
        </View>
      ) : form.loadError ? (
        <View style={styles.loadingFill}>
          <Text style={styles.loadErr}>{form.loadError}</Text>
        </View>
      ) : (
        <KeyboardAwareScroll
          contentContainerStyle={{
            padding: bodyPadding,
            paddingBottom: 120,
            gap: bodyGap,
            flexDirection: viewport === 'tablet' ? 'row' : 'column',
          }}
        >
          <View
            style={{
              width: viewport === 'tablet' ? 320 : undefined,
              gap: bodyGap,
            }}
          >
            <ProductImagePicker
              imageUrl={form.state.imageUrl}
              onPick={onPickImage}
              uploading={imageUpload.pending}
            />
            {uploadBanner ? (
              <Text style={styles.uploadBanner}>{uploadBanner}</Text>
            ) : null}
          </View>

          <View style={{ flex: 1, gap: bodyGap }}>
            {form.saveError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{form.saveError}</Text>
              </View>
            ) : null}

            <Field label="Nome">
              <TextInput
                value={form.state.name}
                onChangeText={form.setName}
                placeholder="Ex.: Bolo de cenoura 500g"
                placeholderTextColor={adminColors.textFaint}
                style={styles.input}
              />
            </Field>

            <Field label="Descrição">
              <TextInput
                value={form.state.description}
                onChangeText={form.setDescription}
                placeholder="Descrição do produto"
                placeholderTextColor={adminColors.textFaint}
                style={[styles.input, styles.textarea]}
                multiline
              />
            </Field>

            <BarcodeField
              value={form.state.barcode}
              onChange={form.setBarcode}
              onScanPress={() => {
                // Capture mode: scanner returns the digits to this form
                // instead of running the lookup → match / new-product
                // flow (which would discard the in-progress edits).
                barcodeCaptureChannel.request((code) => {
                  form.setBarcode(code);
                });
                nav.navigate('AdminBarcodeScanner');
              }}
              error={
                form.barcodeConflict
                  ? `Código já usado por "${form.barcodeConflict.productName}".`
                  : null
              }
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field label="Categoria" style={{ flex: 1 }}>
                <TextInput
                  value={form.state.category}
                  onChangeText={form.setCategory}
                  placeholder="Ex.: Doces caseiros"
                  placeholderTextColor={adminColors.textFaint}
                  style={styles.input}
                />
              </Field>
              <Field label="Preço base" style={{ flex: 1 }}>
                <View style={styles.priceInputWrap}>
                  <Text style={styles.priceCurrency}>R$</Text>
                  <TextInput
                    value={form.state.basePrice}
                    onChangeText={form.setBasePrice}
                    placeholder="0,00"
                    placeholderTextColor={adminColors.textFaint}
                    keyboardType="numeric"
                    style={styles.priceInputField}
                  />
                </View>
              </Field>
            </View>

            <View style={styles.variantsHeader}>
              <Text style={styles.variantsTitle}>Variantes</Text>
              <Pressable onPress={form.addVariant} style={styles.addVariantBtn}>
                <Text style={styles.addVariantText}>+ Nova variante</Text>
              </Pressable>
            </View>

            <View style={{ gap: 8 }}>
              {form.state.variants.filter((v) => !v._delete).length === 0 ? (
                <Text style={styles.noVariants}>
                  Nenhuma variante. Adicione pelo menos uma se desejar preços diferentes por tamanho/peso.
                </Text>
              ) : (
                form.state.variants
                  .filter((v) => !v._delete)
                  .map((variant) => (
                    <VariantRow
                      key={variant.localKey}
                      item={variant}
                      onChange={(patch) => form.updateVariant(variant.localKey, patch)}
                      onRemove={() => form.removeVariant(variant.localKey)}
                    />
                  ))
              )}
            </View>

            {isEditing ? (
              <View style={{ gap: 10, marginTop: 8 }}>
                <Text style={styles.sectionHeader}>STATUS</Text>
                <View style={styles.statusRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.statusTitle}>
                      {form.state.active ? 'Ativo' : 'Inativo'}
                    </Text>
                    <Text style={styles.statusHint}>
                      {form.state.active
                        ? 'Vendedores podem adicionar este produto a novos pedidos.'
                        : 'Produto oculto do catálogo. Rascunhos existentes ficam bloqueados até os vendedores removerem as linhas.'}
                    </Text>
                  </View>
                  <Pressable
                    style={[
                      styles.statusBtn,
                      form.state.active ? styles.statusBtnDestructive : styles.statusBtnRestore,
                    ]}
                    onPress={() => askToggleActive(!form.state.active)}
                  >
                    <Text
                      style={[
                        styles.statusBtnText,
                        form.state.active
                          ? styles.statusBtnTextDestructive
                          : styles.statusBtnTextRestore,
                      ]}
                    >
                      {form.state.active ? 'Desativar' : 'Reativar'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </KeyboardAwareScroll>
      )}

      {isEditing && form.state.id !== undefined && pendingActive !== null ? (
        <AdminProductDeactivateConfirmModal
          visible={confirmOpen}
          productId={form.state.id}
          productName={form.state.name}
          isReactivating={pendingActive === true}
          onCancel={cancelToggle}
          onConfirm={confirmToggleActive}
          busy={form.toggling}
          errorMessage={form.toggleError}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: adminColors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: adminColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.stroke,
  },
  topBarTablet: { height: 64, paddingHorizontal: 28 },
  backGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { color: adminColors.textPrimary, fontSize: 24 },
  title: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 17,
    fontWeight: '600',
  },
  save: {
    backgroundColor: adminColors.primary,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: adminRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: { opacity: 0.6 },
  saveText: {
    color: adminColors.primaryOn,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    color: adminColors.textLabel,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    paddingHorizontal: 12,
    height: 44,
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
  },
  textarea: { height: 88, paddingVertical: 10, textAlignVertical: 'top' },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    paddingHorizontal: 12,
  },
  priceCurrency: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  priceInputField: {
    flex: 1,
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    paddingVertical: 0,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: adminRadii.card,
    padding: 12,
  },
  errorBannerText: {
    color: '#991B1B',
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
  variantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  variantsTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 15,
    fontWeight: '600',
  },
  addVariantBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: adminRadii.control,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addVariantText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  noVariants: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
  uploadBanner: {
    color: adminColors.bannerText,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  loadingFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadErr: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 14,
  },
  sectionHeader: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  statusTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  statusHint: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  statusBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: adminRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBtnDestructive: { backgroundColor: '#FEE2E2' },
  statusBtnRestore: { backgroundColor: '#DCFCE7' },
  statusBtnText: {
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  statusBtnTextDestructive: { color: '#B91C1C' },
  statusBtnTextRestore: { color: '#166534' },
});
