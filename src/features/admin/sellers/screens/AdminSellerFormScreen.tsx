import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';
import { ConfirmModal } from '@/app/ui/modal';
import { supabase } from '@/data/supabase';

import { CredentialPicker } from '../components/CredentialPicker';
import { friendlyError } from '../hooks/useFriendlyError';
import { useSellerForm, type FormMode } from '../hooks/useSellerForm';
import { useAdminSellersLayout } from '../responsive/useAdminSellersLayout';
import {
  deactivateSeller,
  getSellerByAuthUserId,
  reactivateSeller,
  type SellerRecord,
} from '../service/sellersApi';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminSellerForm'>;
type RP = RouteProp<AdminStackParamList, 'AdminSellerForm'>;

export function AdminSellerFormScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RP>();
  const viewport = useAdminSellersLayout();
  const tablet = viewport === 'tablet';

  const [seller, setSeller] = useState<SellerRecord | null>(null);
  const [loadingSeller, setLoadingSeller] = useState(route.params.mode === 'edit');
  const [selfAuthUserId, setSelfAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setSelfAuthUserId(data?.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    const params = route.params;
    if (params.mode !== 'edit') return;
    const authUserId = params.authUserId;
    let cancelled = false;
    void (async () => {
      try {
        const s = await getSellerByAuthUserId(authUserId);
        if (!cancelled) setSeller(s);
      } finally {
        if (!cancelled) setLoadingSeller(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params]);

  if (route.params.mode === 'edit' && (loadingSeller || !seller)) {
    return (
      <SafeAreaView style={[styles.root, styles.fillCenter]} edges={['top']}>
        <ActivityIndicator color={adminColors.textPrimary} />
      </SafeAreaView>
    );
  }

  const mode: FormMode =
    route.params.mode === 'edit' && seller
      ? { kind: 'edit', seller }
      : { kind: 'create' };

  return (
    <FormBody
      mode={mode}
      selfAuthUserId={selfAuthUserId}
      tablet={tablet}
      onDone={() => nav.goBack()}
    />
  );
}

function FormBody({
  mode,
  selfAuthUserId,
  tablet,
  onDone,
}: {
  mode: FormMode;
  selfAuthUserId: string | null;
  tablet: boolean;
  onDone: () => void;
}) {
  const form = useSellerForm(mode, selfAuthUserId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const navTitle = mode.kind === 'edit' ? 'Editar vendedor' : 'Novo vendedor';

  const submit = useCallback(async () => {
    const outcome = await form.submit();
    if (outcome.kind === 'error') {
      setErrorModal(friendlyError(outcome.error));
      return;
    }
    onDone();
  }, [form, onDone]);

  const onToggleActive = useCallback(
    (next: boolean) => {
      if (mode.kind !== 'edit' || form.isSelf || statusBusy) return;
      if (next) {
        // Reactivation is one-tap: low-risk, restores access.
        void (async () => {
          setStatusBusy(true);
          try {
            await reactivateSeller(mode.seller.auth_user_id);
            form.setActive(true);
            mode.seller.active = true; // local mutation so the modal/button hides
          } catch (err) {
            setErrorModal(friendlyError(err));
          } finally {
            setStatusBusy(false);
          }
        })();
      } else {
        // Deactivation is destructive — confirm first.
        setConfirmOpen(true);
      }
    },
    [mode, form, statusBusy],
  );

  const confirmDeactivate = useCallback(async () => {
    if (mode.kind !== 'edit') return;
    setConfirmOpen(false);
    setStatusBusy(true);
    try {
      await deactivateSeller(mode.seller.auth_user_id);
      form.setActive(false);
      mode.seller.active = false;
    } catch (err) {
      setErrorModal(friendlyError(err));
    } finally {
      setStatusBusy(false);
    }
  }, [mode, form]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.topBar, tablet && styles.topBarTablet]}>
        <Pressable onPress={onDone} style={styles.iconBtn} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={adminColors.textPrimary} />
        </Pressable>
        <Text style={[styles.topTitle, tablet && styles.topTitleTablet]}>{navTitle}</Text>
        <Pressable onPress={() => void submit()} disabled={form.submitting} hitSlop={8} style={styles.saveBtn}>
          <Text style={[styles.saveText, form.submitting && { opacity: 0.5 }]}>
            {form.submitting ? 'Salvando…' : 'Salvar'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.body, tablet && styles.bodyTablet]}
      >
        <View style={[styles.card, tablet && styles.cardTablet]}>
          <Section label="DADOS">
            <Field label="Nome">
              <TextInput
                value={form.form.name}
                onChangeText={form.setName}
                placeholder="Maria Silva"
                placeholderTextColor={adminColors.textFaint}
                style={styles.input}
              />
            </Field>
            <Field label="E-mail">
              <TextInput
                value={form.form.email}
                onChangeText={form.setEmail}
                editable={mode.kind === 'create'}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="maria@empresa.com"
                placeholderTextColor={adminColors.textFaint}
                style={[styles.input, mode.kind === 'edit' && styles.inputDisabled]}
              />
              {mode.kind === 'edit' ? (
                <Text style={styles.hint}>
                  E-mail não pode ser alterado — crie um novo vendedor.
                </Text>
              ) : null}
            </Field>
          </Section>

          {mode.kind === 'create' ? (
            <Section label="CREDENCIAL">
              <Text style={styles.sectionQuestion}>
                Como o vendedor receberá acesso?
              </Text>
              <CredentialPicker
                value={form.form.credentialMode}
                onChange={form.setCredentialMode}
                variant={tablet ? 'tablet' : 'phone'}
              />
              {form.form.credentialMode === 'password' ? (
                <Field label="Senha inicial">
                  <View style={styles.inputWithIcon}>
                    <TextInput
                      value={form.form.password}
                      onChangeText={form.setPassword}
                      secureTextEntry
                      placeholder="Mínimo 8 caracteres"
                      placeholderTextColor={adminColors.textFaint}
                      style={styles.inputInner}
                    />
                    <Feather
                      name="eye-off"
                      size={18}
                      color={adminColors.textMuted}
                    />
                  </View>
                  <Text style={styles.hint}>
                    O vendedor poderá trocar no primeiro acesso.
                  </Text>
                </Field>
              ) : (
                <Text style={styles.hint}>
                  Um e-mail de convite será enviado para ele definir a senha.
                </Text>
              )}
            </Section>
          ) : null}

          {mode.kind === 'edit' ? (
            <Section label="STATUS">
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>
                    {form.form.active ? 'Ativo' : 'Inativo'}
                  </Text>
                  <Text style={styles.hint}>
                    {form.isSelf
                      ? 'Você não pode desativar a si mesmo.'
                      : form.form.active
                        ? 'Desmarque para revogar o acesso imediatamente.'
                        : 'Marque para reativar e devolver o acesso.'}
                  </Text>
                </View>
                <Switch
                  value={form.form.active}
                  onValueChange={onToggleActive}
                  disabled={form.isSelf || statusBusy}
                />
              </View>
            </Section>
          ) : null}
        </View>
      </ScrollView>

      {mode.kind === 'edit' ? (
        <ConfirmModal
          open={confirmOpen}
          title={`Desativar ${mode.seller.name}?`}
          body="Ele perde o acesso ao app imediatamente. Os pedidos anteriores continuam com o nome dele."
          cancelLabel="Cancelar"
          primaryLabel="Desativar"
          primaryVariant="destructive"
          onCancel={() => setConfirmOpen(false)}
          onPrimary={() => void confirmDeactivate()}
        />
      ) : null}

      <ConfirmModal
        open={errorModal !== null}
        title="Não foi possível salvar"
        {...(errorModal !== null && { body: errorModal })}
        primaryLabel="Entendi"
        onPrimary={() => setErrorModal(null)}
      />
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: adminColors.background },
  fillCenter: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 8,
    backgroundColor: adminColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.stroke,
  },
  topBarTablet: { height: 64, paddingHorizontal: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: adminColors.textPrimary, fontFamily: adminFonts.heading, fontSize: 17, fontWeight: '600' },
  topTitleTablet: { fontSize: 20 },
  saveBtn: { height: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  body: { padding: 16, paddingBottom: 32 },
  bodyTablet: { alignItems: 'center', padding: 28, paddingBottom: 40 },
  card: { gap: 18 },
  cardTablet: {
    width: 640,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.bigModal,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    padding: 32,
    gap: 22,
  },
  section: { gap: 12 },
  sectionLabel: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  sectionQuestion: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  field: { gap: 6 },
  fieldLabel: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    borderRadius: adminRadii.input,
    backgroundColor: adminColors.surface,
    paddingHorizontal: 14,
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
  },
  inputDisabled: { backgroundColor: adminColors.surfaceMuted, color: adminColors.textMuted },
  inputWithIcon: {
    height: 44,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    borderRadius: adminRadii.input,
    backgroundColor: adminColors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputInner: {
    flex: 1,
    height: '100%',
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
  },
  hint: { color: adminColors.textFaint, fontFamily: adminFonts.body, fontSize: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: adminColors.surface,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    borderRadius: adminRadii.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 60,
    gap: 12,
  },
  toggleLabel: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
});
