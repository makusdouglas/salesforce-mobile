import { useCallback, useState } from 'react';

import {
  lookupBarcode,
  type BarcodeLookupResult,
} from '../service/barcodeLookup';

export function useBarcodeLookup() {
  const [pending, setPending] = useState(false);
  const [lastResult, setLastResult] = useState<BarcodeLookupResult | null>(null);

  const run = useCallback(async (code: string): Promise<BarcodeLookupResult> => {
    setPending(true);
    const result = await lookupBarcode(code);
    setLastResult(result);
    setPending(false);
    return result;
  }, []);

  return { run, pending, lastResult } as const;
}
