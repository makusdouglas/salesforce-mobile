export type VariantDisplayDTO = {
  readonly id: string;
  readonly label: string;
  readonly price: number | null;
  readonly barcode: string | null;
  readonly attributes: string | null;
};

export type ProductDisplayDTO = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly unit: string | null;
  readonly category: string | null;
  readonly basePrice: number | null;
  readonly variantCount: number;
  readonly variants: readonly VariantDisplayDTO[];
};

type ProductShape = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  unit: string | null;
  category: string | null;
};

export function deriveProductDTO(
  p: ProductShape,
  variants: readonly VariantDisplayDTO[],
): ProductDisplayDTO {
  const priced = variants.filter(
    (v): v is VariantDisplayDTO & { price: number } => v.price !== null,
  );
  const basePrice = priced.length > 0 ? Math.min(...priced.map((v) => v.price)) : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    unit: p.unit,
    category: p.category,
    basePrice,
    variantCount: variants.length,
    variants,
  };
}

export function sortProducts(
  products: readonly ProductDisplayDTO[],
): ProductDisplayDTO[] {
  return [...products].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
