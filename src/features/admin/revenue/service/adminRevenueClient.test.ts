// 017-revenue-dashboard — contract tests for the admin RPC wrapper.
// Mocks @supabase/supabase-js to assert (a) the RPC names, (b) the
// parameter object shape, (c) row→DTO mapping for happy + forbidden.

import {
  AdminRevenueError,
  fetchAdminAging,
  fetchAdminBySeller,
  fetchAdminKpis,
  fetchAdminMonthly,
  fetchAdminTopClients,
  fetchAdminTopProducts,
} from './adminRevenueClient';

const mockRpc = jest.fn();

jest.mock('@/data/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

describe('adminRevenueClient', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  describe('fetchAdminKpis', () => {
    it('calls admin_revenue_kpis with the expected params and maps rows in fixed order', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { label: 'pendente', current_value: 100, previous_value: 50, current_count: 5, previous_count: 4 },
          { label: 'recebido', current_value: '200.5', previous_value: '180', current_count: 5, previous_count: 4 },
          { label: 'faturado', current_value: 500, previous_value: 400, current_count: 5, previous_count: 4 },
          { label: 'ticket_medio', current_value: 100, previous_value: 100, current_count: 5, previous_count: 4 },
          { label: 'pedidos_enviados', current_value: 5, previous_value: 4, current_count: 5, previous_count: 4 },
        ],
        error: null,
      });

      const result = await fetchAdminKpis({ sellerId: null, month: '2026-04' });

      expect(mockRpc).toHaveBeenCalledWith('admin_revenue_kpis', {
        p_seller: null,
        p_month: '2026-04-01',
      });
      // Sorted to fixed FR-005 order: recebido, faturado, pendente, ticket_medio, pedidos_enviados.
      expect(result.map((k) => k.label)).toEqual([
        'recebido',
        'faturado',
        'pendente',
        'ticket_medio',
        'pedidos_enviados',
      ]);
      // String-encoded numerics are coerced to numbers.
      expect(result[0]!.currentValue).toBe(200.5);
      expect(result[0]!.previousValue).toBe(180);
      expect(result[0]!.deltaPct).toBeCloseTo((200.5 - 180) / 180, 5);
      expect(result[0]!.deltaDirection).toBe('up');
    });

    it('throws AdminRevenueError(forbidden) for Postgres 42501', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'insufficient_privilege' },
      });
      await expect(fetchAdminKpis({ sellerId: null, month: '2026-04' })).rejects.toMatchObject({
        kind: 'forbidden',
      });
    });

    it('preserves the AdminRevenueError name', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'no' } });
      try {
        await fetchAdminKpis({ sellerId: null, month: '2026-04' });
        fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(AdminRevenueError);
      }
    });

    it('maps null previous_value to null deltaPct', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { label: 'recebido', current_value: 100, previous_value: null, current_count: 1, previous_count: 0 },
        ],
        error: null,
      });
      const result = await fetchAdminKpis({ sellerId: 'sp1', month: '2026-04-01' });
      expect(result[0]!.previousValue).toBeNull();
      expect(result[0]!.deltaPct).toBeNull();
      expect(result[0]!.deltaDirection).toBeNull();
    });
  });

  describe('fetchAdminMonthly', () => {
    it('calls admin_revenue_monthly with seller + range args and slices month to YYYY-MM', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { month: '2025-12-01', faturado: 100, recebido: 80, pendente: 20 },
          { month: '2026-01-01', faturado: '200', recebido: '150', pendente: '50' },
        ],
        error: null,
      });
      const result = await fetchAdminMonthly({
        sellerId: 'sp1',
        from: '2025-12',
        to: '2026-04',
      });
      expect(mockRpc).toHaveBeenCalledWith('admin_revenue_monthly', {
        p_seller: 'sp1',
        p_from: '2025-12-01',
        p_to: '2026-04-01',
      });
      expect(result).toEqual([
        { month: '2025-12', faturado: 100, recebido: 80, pendente: 20 },
        { month: '2026-01', faturado: 200, recebido: 150, pendente: 50 },
      ]);
    });
  });

  describe('fetchAdminBySeller', () => {
    it('calls admin_revenue_by_seller and shapes RankedSeller rows', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { salesperson_id: 's1', salesperson_name: 'Ana', recebido: 800 },
          { salesperson_id: 's2', salesperson_name: 'Bruno', recebido: 500 },
        ],
        error: null,
      });
      const result = await fetchAdminBySeller({ month: '2026-04' });
      expect(mockRpc).toHaveBeenCalledWith('admin_revenue_by_seller', {
        p_month: '2026-04-01',
      });
      expect(result).toEqual([
        { salespersonId: 's1', salespersonName: 'Ana', recebido: 800 },
        { salespersonId: 's2', salespersonName: 'Bruno', recebido: 500 },
      ]);
    });
  });

  describe('fetchAdminTopClients / fetchAdminTopProducts', () => {
    it('top clients shape', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { client_id: 'c1', client_name: 'Padaria São João', recebido: 500 },
        ],
        error: null,
      });
      const result = await fetchAdminTopClients({
        sellerId: null,
        monthFrom: '2026-04',
        monthTo: '2026-04',
      });
      expect(mockRpc).toHaveBeenCalledWith('admin_top_clients', {
        p_seller: null,
        p_month_from: '2026-04-01',
        p_month_to: '2026-04-01',
      });
      expect(result[0]!).toEqual({
        clientId: 'c1',
        clientName: 'Padaria São João',
        recebido: 500,
      });
    });

    it('top products shape', async () => {
      mockRpc.mockResolvedValue({
        data: [{ product_id: 'p1', product_name: 'Café', units: 148 }],
        error: null,
      });
      const result = await fetchAdminTopProducts({
        sellerId: 'sp1',
        monthFrom: '2026-04',
        monthTo: '2026-04',
      });
      expect(mockRpc).toHaveBeenCalledWith('admin_top_products', {
        p_seller: 'sp1',
        p_month_from: '2026-04-01',
        p_month_to: '2026-04-01',
      });
      expect(result[0]!).toEqual({
        productId: 'p1',
        productName: 'Café',
        units: 148,
      });
    });
  });

  describe('fetchAdminAging', () => {
    it('shapes 4 buckets', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { bucket: '0-30', days_min: 0, days_max: 30, total_pendente: 100 },
          { bucket: '31-60', days_min: 31, days_max: 60, total_pendente: 50 },
          { bucket: '61-90', days_min: 61, days_max: 90, total_pendente: 25 },
          { bucket: '>90', days_min: 91, days_max: null, total_pendente: 10 },
        ],
        error: null,
      });
      const result = await fetchAdminAging({ sellerId: null, asOf: '2026-04-25' });
      expect(mockRpc).toHaveBeenCalledWith('admin_receivables_aging', {
        p_seller: null,
        p_as_of: '2026-04-25',
      });
      expect(result.map((b) => b.label)).toEqual(['0-30', '31-60', '61-90', '>90']);
      expect(result[3]!.daysMax).toBeNull();
    });
  });
});
