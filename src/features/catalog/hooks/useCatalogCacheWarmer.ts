import { useEffect, useRef } from 'react';

import { productsRepository } from '@/data/repositories/productsRepository';
import { type SyncStatus, useSyncStatus } from '@/features/sync';

import { imageCache } from '../image-cache/imageCache';

import { shouldTriggerPrefetch } from './cacheWarmerLogic';

export { shouldTriggerPrefetch };

async function runWarmerPass(): Promise<void> {
  const products = await productsRepository.query().fetch();
  const urls = products
    .map((p) => p.imageUrl)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  await imageCache.prefetch(urls);
  await imageCache.evictOrphans(urls);
}

export function useCatalogCacheWarmer(): void {
  const { status } = useSyncStatus();
  const prevRef = useRef<SyncStatus | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = status;
    if (shouldTriggerPrefetch(prev, status)) {
      void runWarmerPass();
    }
  }, [status]);
}
