import { type ReactNode } from 'react';

import { useCatalogCacheWarmer } from '../hooks/useCatalogCacheWarmer';

type CatalogProviderProps = {
  children: ReactNode;
};

export function CatalogProvider({ children }: CatalogProviderProps) {
  useCatalogCacheWarmer();
  return <>{children}</>;
}
