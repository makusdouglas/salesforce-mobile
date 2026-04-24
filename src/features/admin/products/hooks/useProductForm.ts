import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getProductById,
  ProductsApiError,
  saveProduct,
  type ProductWithVariants,
  type SaveInput,
  type VariantInput,
} from '../service/productsApi';

export type VariantFormItem = VariantInput & {
  localKey: string;
};

export type ProductFormState = {
  id: string | undefined;
  name: string;
  description: string;
  category: string;
  basePrice: string; // string so the input can hold "29,90" / "29.90"
  barcode: string;
  imageUrl: string | null;
  variants: VariantFormItem[];
};

export type SaveOutcome =
  | { status: 'saved'; product: ProductWithVariants }
  | { status: 'offline' }
  | { status: 'rls_denied' }
  | { status: 'barcode_conflict'; conflictingProductId: string | undefined }
  | { status: 'error'; message: string };

type Options = {
  productId: string | undefined;
  prefilledBarcode: string | undefined;
};

function localKey(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function parsePrice(raw: string): number | null {
  const normalized = raw.replace(/\s/g, '').replace(/,/g, '.');
  if (normalized.length === 0) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function emptyState(prefilledBarcode?: string): ProductFormState {
  return {
    id: undefined,
    name: '',
    description: '',
    category: '',
    basePrice: '',
    barcode: prefilledBarcode ?? '',
    imageUrl: null,
    variants: [],
  };
}

function toFormState(product: ProductWithVariants): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? '',
    category: product.category ?? '',
    basePrice: product.base_price.toString().replace('.', ','),
    barcode: product.barcode ?? '',
    imageUrl: product.image_url,
    variants: product.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.price,
      localKey: localKey(),
      _delete: undefined,
    })),
  };
}

export function useProductForm(options: Options) {
  const [state, setState] = useState<ProductFormState>(
    emptyState(options.prefilledBarcode),
  );
  const [loading, setLoading] = useState<boolean>(options.productId !== undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (options.productId === undefined) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getProductById(options.productId)
      .then((product) => {
        if (cancelled) return;
        if (product) setState(toFormState(product));
        else setLoadError('Produto não encontrado.');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError((err as { message?: string })?.message ?? 'Erro ao carregar.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [options.productId]);

  const setName = useCallback((value: string) => {
    setState((s) => ({ ...s, name: value }));
  }, []);
  const setDescription = useCallback((value: string) => {
    setState((s) => ({ ...s, description: value }));
  }, []);
  const setCategory = useCallback((value: string) => {
    setState((s) => ({ ...s, category: value }));
  }, []);
  const setBasePrice = useCallback((value: string) => {
    setState((s) => ({ ...s, basePrice: value }));
  }, []);
  const setBarcode = useCallback((value: string) => {
    setState((s) => ({ ...s, barcode: value }));
  }, []);
  const setImageUrl = useCallback((value: string | null) => {
    setState((s) => ({ ...s, imageUrl: value }));
  }, []);

  const addVariant = useCallback(() => {
    setState((s) => ({
      ...s,
      variants: [
        ...s.variants,
        { localKey: localKey(), id: undefined, label: '', price: 0, _delete: undefined },
      ],
    }));
  }, []);

  const updateVariant = useCallback(
    (key: string, patch: Partial<VariantInput>) => {
      setState((s) => ({
        ...s,
        variants: s.variants.map((v) =>
          v.localKey === key ? { ...v, ...patch } : v,
        ),
      }));
    },
    [],
  );

  const removeVariant = useCallback((key: string) => {
    setState((s) => {
      const next = s.variants.map((v) => {
        if (v.localKey !== key) return v;
        if (v.id !== undefined) return { ...v, _delete: true };
        return null; // unsaved — drop it outright
      });
      return { ...s, variants: next.filter((v): v is VariantFormItem => v !== null) };
    });
  }, []);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (state.name.trim().length === 0) errors.push('Informe o nome do produto.');
    if (parsePrice(state.basePrice) === null) errors.push('Informe um preço base válido.');
    const liveVariants = state.variants.filter((v) => !v._delete);
    for (const v of liveVariants) {
      if (v.label.trim().length === 0) {
        errors.push('Toda variante precisa de um nome.');
        break;
      }
      if (!Number.isFinite(v.price) || v.price < 0) {
        errors.push('Preço de variante inválido.');
        break;
      }
    }
    return { ok: errors.length === 0, errors };
  }, [state]);

  const save = useCallback(async (): Promise<SaveOutcome> => {
    setSaveError(null);
    if (!validation.ok) {
      return { status: 'error', message: validation.errors[0] ?? 'Campos inválidos.' };
    }
    const basePrice = parsePrice(state.basePrice);
    if (basePrice === null) {
      return { status: 'error', message: 'Preço base inválido.' };
    }

    const input: SaveInput = {
      id: state.id,
      name: state.name.trim(),
      description: state.description.trim() || null,
      category: state.category.trim() || null,
      base_price: basePrice,
      barcode: state.barcode.trim() ? state.barcode.trim() : null,
      image_url: state.imageUrl,
      variants: state.variants.map<VariantInput>((v) => ({
        id: v.id,
        label: v.label.trim(),
        price: v.price,
        _delete: v._delete,
      })),
    };

    setSaving(true);
    try {
      const product = await saveProduct(input);
      setSaving(false);
      // Re-hydrate from the authoritative server row so freshly-created
      // variant IDs and timestamps replace the local-only ones.
      setState(toFormState(product));
      return { status: 'saved', product };
    } catch (err) {
      setSaving(false);
      if (err instanceof ProductsApiError) {
        if (err.kind === 'offline') {
          setSaveError(err.message);
          return { status: 'offline' };
        }
        if (err.kind === 'rls_denied') {
          setSaveError(err.message);
          return { status: 'rls_denied' };
        }
        if (err.kind === 'barcode_conflict') {
          setSaveError(err.message);
          return {
            status: 'barcode_conflict',
            conflictingProductId: err.conflictingProductId,
          };
        }
        setSaveError(err.message);
        return { status: 'error', message: err.message };
      }
      const message = (err as { message?: string })?.message ?? 'Erro ao salvar.';
      setSaveError(message);
      return { status: 'error', message };
    }
  }, [state, validation]);

  return {
    state,
    loading,
    loadError,
    saving,
    saveError,
    validation,
    setName,
    setDescription,
    setCategory,
    setBasePrice,
    setBarcode,
    setImageUrl,
    addVariant,
    updateVariant,
    removeVariant,
    save,
  } as const;
}
