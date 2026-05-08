import { StyleSheet, Text, TextInput, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type ClientDraft } from '../types';

import { CnpjField } from './CnpjField';

export type ClientFormFieldsProps = {
  readonly draft: ClientDraft;
  readonly onChange: (patch: Partial<ClientDraft>) => void;
  readonly viewport: Viewport;
};

export function ClientFormFields({ draft, onChange, viewport }: ClientFormFieldsProps) {
  const isTablet = viewport === 'tablet';

  return (
    <View style={styles.container}>
      {/* Row 1: Nome (required) + CNPJ. Stacked on phone, side-by-side on tablet. */}
      <View style={isTablet ? styles.rowTablet : styles.rowPhone}>
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Nome da loja</Text>
            <View style={styles.requiredPill}>
              <Text style={styles.requiredLabel}>Obrigatório</Text>
            </View>
          </View>
          <TextInput
            value={draft.name}
            onChangeText={(next) => onChange({ name: next })}
            placeholder="Ex.: Mercearia do João"
            placeholderTextColor="#A1A1AA"
            style={[styles.input, isTablet && styles.inputTablet]}
            accessibilityLabel="Nome da loja"
            autoCapitalize="words"
          />
        </View>
        <View style={styles.field}>
          <CnpjField
            value={draft.taxId}
            onChangeText={(next) => onChange({ taxId: next })}
            viewport={viewport}
          />
        </View>
      </View>

      {/* Row 2: Endereço + Contato. Stacked on phone, side-by-side on tablet. */}
      <View style={isTablet ? styles.rowTablet : styles.rowPhone}>
        <View style={styles.field}>
          <Text style={styles.label}>
            Endereço <Text style={styles.optional}>· Opcional</Text>
          </Text>
          <TextInput
            value={draft.addressLine}
            onChangeText={(next) => onChange({ addressLine: next })}
            placeholder="Rua, número, bairro, cidade"
            placeholderTextColor="#A1A1AA"
            multiline
            numberOfLines={2}
            style={[styles.input, styles.multiline, isTablet && styles.inputTablet]}
            accessibilityLabel="Endereço"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>
            Contato <Text style={styles.optional}>· Opcional</Text>
          </Text>
          <TextInput
            value={draft.contact}
            onChangeText={(next) => onChange({ contact: next })}
            placeholder={'Ex.: João (11) 98765-4321\njoao@loja.com.br'}
            placeholderTextColor="#A1A1AA"
            multiline
            numberOfLines={2}
            style={[styles.input, styles.multiline, isTablet && styles.inputTablet]}
            accessibilityLabel="Contato"
          />
        </View>
      </View>

      {/* Row 3: Notas (full-width on both viewports). */}
      <View style={styles.field}>
        <Text style={styles.label}>
          Observações <Text style={styles.optional}>· Opcional</Text>
        </Text>
        <TextInput
          value={draft.notes}
          onChangeText={(next) => onChange({ notes: next })}
          placeholder="Notas internas sobre o cliente, dias de visita, referências…"
          placeholderTextColor="#A1A1AA"
          multiline
          numberOfLines={4}
          style={[styles.input, styles.multilineTall, isTablet && styles.inputTablet]}
          accessibilityLabel="Observações"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  rowPhone: {
    gap: 16,
  },
  rowTablet: {
    flexDirection: 'row',
    gap: 16,
  },
  field: {
    flex: 1,
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0A0A0A',
  },
  optional: {
    fontWeight: '400',
    color: '#71717A',
  },
  requiredPill: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  requiredLabel: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0A0A0A',
    backgroundColor: '#FFFFFF',
  },
  inputTablet: {
    paddingVertical: 14,
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  multilineTall: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
