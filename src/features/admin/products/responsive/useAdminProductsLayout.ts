import { useWindowDimensions } from 'react-native';

// 768dp is the app-wide tablet threshold (see clients/responsive/breakpoints.ts).
// Kept inline here to avoid a cross-feature import until the shared
// responsive module lands (see 007 research R-008).
const TABLET_MIN_WIDTH = 768;

export type AdminViewport = 'phone' | 'tablet';

export function useAdminProductsLayout(): AdminViewport {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone';
}
