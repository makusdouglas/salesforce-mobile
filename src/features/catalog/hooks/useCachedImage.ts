import { useEffect, useRef, useState } from 'react';

import { imageCache } from '../image-cache/imageCache';

export type CachedImageStatus = 'loading' | 'ready' | 'missing';

export type UseCachedImageResult = {
  readonly uri: string | null;
  readonly status: CachedImageStatus;
};

export function useCachedImage(url: string | null): UseCachedImageResult {
  const [state, setState] = useState<UseCachedImageResult>(() =>
    url === null ? { uri: null, status: 'missing' } : { uri: null, status: 'loading' },
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (url === null) {
      setState({ uri: null, status: 'missing' });
      return () => {
        mounted.current = false;
      };
    }
    setState({ uri: null, status: 'loading' });
    imageCache
      .getCachedUri(url)
      .then((uri) => {
        if (mounted.current) setState({ uri, status: 'ready' });
      })
      .catch(() => {
        if (mounted.current) setState({ uri: null, status: 'missing' });
      });
    return () => {
      mounted.current = false;
    };
  }, [url]);

  return state;
}
