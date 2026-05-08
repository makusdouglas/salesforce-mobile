// 017-revenue-dashboard — admin scope public surface.
export { AdminRevenueScreen } from './screens/AdminRevenueScreen';
export { useAdminRevenue, type AdminRevenueState } from './hooks/useAdminRevenue';
export {
  AdminRevenueError,
  fetchAdminAging,
  fetchAdminBySeller,
  fetchAdminKpis,
  fetchAdminMonthly,
  fetchAdminTopClients,
  fetchAdminTopProducts,
} from './service/adminRevenueClient';
