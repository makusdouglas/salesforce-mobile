import { useWindowDimensions } from 'react-native';

import { TABLET_MIN_WIDTH } from '../responsive/breakpoints';

export type Viewport = 'phone' | 'tablet';

export function useViewport(): Viewport {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone';
}
