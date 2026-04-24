import { useCallback, useEffect, useState } from 'react';

import { listProducts, type ProductWithVariants } from '../service/productsApi';

type State =
  | { status: 'loading' }
  | { status: 'ready'; products: ProductWithVariants[] }
  | { status: 'error'; message: string };

export function useProducts() {
  const [state, setState] = useState<State>({ status: 'loading' });

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const products = await listProducts();
      setState({ status: 'ready', products });
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Erro ao carregar';
      setState({ status: 'error', message });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload } as const;
}
