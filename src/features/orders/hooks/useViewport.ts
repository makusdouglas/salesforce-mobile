// 009-order-assembly — local duplicate of the viewport hook pattern
// established in 006/007/008. Fourth consumer; P3 "duplicate before
// abstracting" says this is the earliest point a generalized hook could be
// extracted. Deferred until a fifth consumer actually needs it.

import { useWindowDimensions } from 'react-native';

const TABLET_MIN_WIDTH = 768;

export type Viewport = 'phone' | 'tablet';

export function useViewport(): Viewport {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone';
}
