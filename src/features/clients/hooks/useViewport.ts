import { useWindowDimensions } from 'react-native';

import { TABLET_MIN_WIDTH } from '../responsive/breakpoints';

// TODO: extract to src/app/responsive/ once a third feature needs this hook.
// Duplicated from src/features/catalog/hooks/useViewport.ts per 007 Structure
// Decision / research R-008.
export type Viewport = 'phone' | 'tablet';

export function useViewport(): Viewport {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone';
}
