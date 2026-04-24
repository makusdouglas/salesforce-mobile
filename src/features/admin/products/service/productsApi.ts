import { supabase } from '@/data/supabase';

import { triggerSyncAfterAdminWrite } from '@/features/sync/triggers/adminWriteTrigger';

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  barcode: string | null;
  image_url: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export type VariantRow = {
  id: string;
  product_id: string;
  label: string;
  price: number;
  barcode: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export type ProductWithVariants = ProductRow & { variants: VariantRow[] };

export type VariantInput = {
  id: string | undefined;
  label: string;
  price: number;
  _delete: boolean | undefined;
};

export type SaveInput = {
  id: string | undefined;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  barcode: string | null;
  image_url: string | null;
  variants: VariantInput[];
};

export type SaveErrorKind =
  | 'offline'
  | 'rls_denied'
  | 'barcode_conflict'
  | 'unknown';

export class ProductsApiError extends Error {
  readonly kind: SaveErrorKind;
  readonly conflictingProductId: string | undefined;

  constructor(kind: SaveErrorKind, message: string, conflictingProductId?: string) {
    super(message);
    this.name = 'ProductsApiError';
    this.kind = kind;
    this.conflictingProductId = conflictingProductId;
  }
}

function mapSaveError(error: unknown): ProductsApiError {
  const anyErr = error as { code?: string; message?: string };
  const code = anyErr?.code ?? '';
  const message = anyErr?.message ?? '';
  if (code === '23505' || /duplicate key|unique/i.test(message)) {
    return new ProductsApiError('barcode_conflict', 'Este código já está em uso.');
  }
  if (code === '42501' || /row-level security|new row violates/i.test(message)) {
    return new ProductsApiError('rls_denied', 'Você não tem permissão para essa ação.');
  }
  if (/fetch|network|failed to fetch/i.test(message)) {
    return new ProductsApiError('offline', 'Você está offline — conecte-se para salvar.');
  }
  return new ProductsApiError('unknown', message || 'Não foi possível salvar agora.');
}

export async function listProducts(): Promise<ProductWithVariants[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id,name,description,category,base_price,barcode,image_url,updated_at,deleted_at, variants:product_variants(id,product_id,label,price,barcode,updated_at,deleted_at)',
    )
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw mapSaveError(error);
  }
  const rows = (data ?? []) as ProductWithVariants[];
  return rows.map((row) => ({
    ...row,
    variants: (row.variants ?? [])
      .filter((v) => v.deleted_at === null)
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
  }));
}

export async function getProductById(id: string): Promise<ProductWithVariants | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id,name,description,category,base_price,barcode,image_url,updated_at,deleted_at, variants:product_variants(id,product_id,label,price,barcode,updated_at,deleted_at)',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapSaveError(error);
  if (!data) return null;
  const row = data as ProductWithVariants;
  return {
    ...row,
    variants: (row.variants ?? []).filter((v) => v.deleted_at === null),
  };
}

export async function saveProduct(input: SaveInput): Promise<ProductWithVariants> {
  const productPayload = {
    name: input.name.trim(),
    description: input.description,
    category: input.category,
    base_price: input.base_price,
    barcode: input.barcode,
    image_url: input.image_url,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  } as const;

  let productId = input.id;
  const createdHere = input.id === undefined;

  // Step 1: upsert the product row.
  if (createdHere) {
    const { data, error } = await supabase
      .from('products')
      .insert(productPayload)
      .select('id')
      .single();
    if (error || !data) {
      const err = mapSaveError(error);
      // Attach conflicting product id for the UI's "Ver produto existente" CTA.
      if (err.kind === 'barcode_conflict' && input.barcode) {
        const conflicting = await findProductByBarcode(input.barcode);
        if (conflicting) {
          throw new ProductsApiError(
            'barcode_conflict',
            err.message,
            conflicting.id,
          );
        }
      }
      throw err;
    }
    productId = data.id;
  } else {
    const { error } = await supabase
      .from('products')
      .update(productPayload)
      .eq('id', input.id!);
    if (error) throw mapSaveError(error);
  }

  // Step 2: variant diff.
  try {
    await applyVariantDiff(productId!, input.variants);
  } catch (variantError) {
    // Soft-rollback on create: re-delete the just-inserted product row
    // so the admin does not end up with a ghost product (research R-003b).
    if (createdHere) {
      await supabase
        .from('products')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', productId!);
    }
    throw variantError;
  }

  const saved = await getProductById(productId!);
  if (!saved) {
    throw new ProductsApiError('unknown', 'Produto salvo, mas não foi possível recarregar.');
  }

  // Success → trigger seller cache refresh.
  void triggerSyncAfterAdminWrite();
  return saved;
}

async function applyVariantDiff(productId: string, variants: VariantInput[]): Promise<void> {
  const nowIso = new Date().toISOString();
  const upserts = variants
    .filter((v) => !v._delete)
    .map((v) => {
      const base: Record<string, unknown> = {
        product_id: productId,
        label: v.label.trim(),
        price: v.price,
        updated_at: nowIso,
        deleted_at: null,
      };
      if (v.id !== undefined) base.id = v.id;
      return base;
    });
  const deletes = variants
    .filter((v) => v._delete && v.id)
    .map((v) => v.id!);

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('product_variants')
      .upsert(upserts, { onConflict: 'id' });
    if (error) throw mapSaveError(error);
  }
  if (deletes.length > 0) {
    const { error } = await supabase
      .from('product_variants')
      .update({ deleted_at: nowIso })
      .in('id', deletes);
    if (error) throw mapSaveError(error);
  }
}

export async function softDeleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw mapSaveError(error);
  void triggerSyncAfterAdminWrite();
}

export async function findProductByBarcode(
  code: string,
): Promise<ProductWithVariants | null> {
  const normalized = code.trim();
  if (normalized.length === 0) return null;
  const { data, error } = await supabase
    .from('products')
    .select(
      'id,name,description,category,base_price,barcode,image_url,updated_at,deleted_at, variants:product_variants(id,product_id,label,price,barcode,updated_at,deleted_at)',
    )
    .eq('barcode', normalized)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw mapSaveError(error);
  if (!data) return null;
  const row = data as ProductWithVariants;
  return {
    ...row,
    variants: (row.variants ?? []).filter((v) => v.deleted_at === null),
  };
}
