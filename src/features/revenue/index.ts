// 017-revenue-dashboard — public surface for the seller scope.
export { SellerRevenueScreen } from './screens/SellerRevenueScreen';
export { useViewport, type Viewport } from './hooks/useViewport';
export {
  AgingCard,
  KpiBand,
  PanelEmptyState,
  SellerRankingCard,
  TopClientsCard,
  TopProductsCard,
  TrendChartCard,
  TwoUp,
} from './components';
export { useSellerRevenue } from './hooks/useSellerRevenue';
export {
  currentMonthKey,
  offsetMonthKey,
  useSellerRevenueFilter,
} from './hooks/useSellerRevenueFilter';
export type {
  AgingBucket,
  KpiBlock,
  KpiLabel,
  RankedSeller,
  RevenueFilter,
  RevenueSnapshot,
  Scope,
  TopClient,
  TopProduct,
  TrendPoint,
} from './shared/types';
export { emptyStates } from './shared/empty-states';
export {
  computeDeltaDirection,
  computeDeltaPct,
  formatDelta,
  type DeltaRendering,
} from './shared/formatDelta';
