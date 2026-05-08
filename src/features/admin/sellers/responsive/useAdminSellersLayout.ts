import { useWindowDimensions } from 'react-native';

const TABLET_MIN_WIDTH = 768;

export type AdminSellersViewport = 'phone' | 'tablet';

export function useAdminSellersLayout(): AdminSellersViewport {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone';
}
