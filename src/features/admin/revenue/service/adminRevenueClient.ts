// 017-revenue-dashboard — thin wrappers around the Supabase RPCs that
// power the admin dashboard. Maps Postgres errors into a tagged
// AdminRevenueError so the screen state machine can branch on intent
// rather than reading error messages.
//
// Contract: specs/017-revenue-dashboard/contracts/admin-rpcs.md

import { supabase } from '@/data/supabase';

import {
  computeDeltaDirection,
  computeDeltaPct,
} from '@/features/revenue/shared/formatDelta';
import type {
  AgingBucket,
  KpiBlock,
  KpiLabel,
  RankedSeller,
  TopClient,
  TopProduct,
  TrendPoint,
} from '@/features/revenue/shared/types';

export type AdminRevenueErrorKind = 'forbidden' | 'network' | 'unknown';

export class AdminRevenueError extends Error {
  readonly kind: AdminRevenueErrorKind;
  constructor(kind: AdminRevenueErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'AdminRevenueError';
  }
}

interface PostgresErrorShape {
  code?: string;
  message?: string;
}

function normalizeError(err: unknown): AdminRevenueError {
  const e = err as PostgresErrorShape | null | undefined;
  const code = e?.code ?? '';
  const message = e?.message ?? 'Erro desconhecido.';
  // Log the raw shape so devs can see what Supabase returned without
  // having to attach a debugger; the user-facing message stays friendly.

  console.warn('[admin-revenue] RPC error', { code, message, raw: err });
  if (code === '42501') return new AdminRevenueError('forbidden', message);
  // Postgres "function does not exist" — almost always means the
  // 0020_revenue_dashboard.sql migration hasn't been applied.
  if (code === '42883' || /does not exist/i.test(message)) {
    return new AdminRevenueError('unknown', message);
  }
  if (typeof message === 'string' && /network|fetch|timeout|failed/i.test(message)) {
    return new AdminRevenueError('network', message);
  }
  return new AdminRevenueError('unknown', message);
}

function toIsoDate(monthKey: string): string {
  // Accepts YYYY-MM or YYYY-MM-DD. RPCs need YYYY-MM-01.
  if (monthKey.length === 7) return `${monthKey}-01`;
  return monthKey;
}

interface KpiRow {
  label: string;
  current_value: number | string;
  previous_value: number | string | null;
  current_count: number;
  previous_count: number;
}

const KPI_ORDER: readonly KpiLabel[] = [
  'recebido',
  'faturado',
  'pendente',
  'ticket_medio',
  'pedidos_enviados',
];

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? Number.parseFloat(v) : v;
}

function nullableNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === 'string' ? Number.parseFloat(v) : v;
}

function rowToKpiBlock(row: KpiRow): KpiBlock {
  const current = num(row.current_value);
  const previous = nullableNum(row.previous_value);
  return {
    label: row.label as KpiLabel,
    currentValue: current,
    previousValue: previous,
    deltaPct: computeDeltaPct(current, previous),
    deltaDirection: computeDeltaDirection(current, previous),
    currentCount: row.current_count,
    previousCount: row.previous_count,
  };
}

export async function fetchAdminKpis(args: {
  sellerId: string | null;
  month: string;
}): Promise<KpiBlock[]> {
  const { data, error } = await supabase.rpc('admin_revenue_kpis', {
    p_seller: args.sellerId,
    p_month: toIsoDate(args.month),
  });
  if (error) throw normalizeError(error);
  const rows = (data ?? []) as KpiRow[];
  // Sort to KPI_ORDER so consumers can index by position.
  const byLabel = new Map(rows.map((r) => [r.label, r]));
  return KPI_ORDER.map((label) => {
    const row = byLabel.get(label);
    return row
      ? rowToKpiBlock(row)
      : {
          label,
          currentValue: 0,
          previousValue: null,
          deltaPct: null,
          deltaDirection: null,
        };
  });
}

interface MonthlyRow {
  month: string; // YYYY-MM-DD
  faturado: number | string;
  recebido: number | string;
  pendente: number | string;
}

function monthlyToTrendPoint(row: MonthlyRow): TrendPoint {
  return {
    month: row.month.slice(0, 7),
    faturado: num(row.faturado),
    recebido: num(row.recebido),
    pendente: num(row.pendente),
  };
}

export async function fetchAdminMonthly(args: {
  sellerId: string | null;
  from: string;
  to: string;
}): Promise<TrendPoint[]> {
  const { data, error } = await supabase.rpc('admin_revenue_monthly', {
    p_seller: args.sellerId,
    p_from: toIsoDate(args.from),
    p_to: toIsoDate(args.to),
  });
  if (error) throw normalizeError(error);
  return ((data ?? []) as MonthlyRow[]).map(monthlyToTrendPoint);
}

interface SellerRankRow {
  salesperson_id: string;
  salesperson_name: string;
  recebido: number | string;
}

export async function fetchAdminBySeller(args: {
  month: string;
}): Promise<RankedSeller[]> {
  const { data, error } = await supabase.rpc('admin_revenue_by_seller', {
    p_month: toIsoDate(args.month),
  });
  if (error) throw normalizeError(error);
  return ((data ?? []) as SellerRankRow[]).map((r) => ({
    salespersonId: r.salesperson_id,
    salespersonName: r.salesperson_name,
    recebido: num(r.recebido),
  }));
}

interface TopClientRow {
  client_id: string;
  client_name: string;
  recebido: number | string;
}

export async function fetchAdminTopClients(args: {
  sellerId: string | null;
  monthFrom: string;
  monthTo: string;
}): Promise<TopClient[]> {
  const { data, error } = await supabase.rpc('admin_top_clients', {
    p_seller: args.sellerId,
    p_month_from: toIsoDate(args.monthFrom),
    p_month_to: toIsoDate(args.monthTo),
  });
  if (error) throw normalizeError(error);
  return ((data ?? []) as TopClientRow[]).map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    recebido: num(r.recebido),
  }));
}

interface TopProductRow {
  product_id: string;
  product_name: string;
  units: number;
}

export async function fetchAdminTopProducts(args: {
  sellerId: string | null;
  monthFrom: string;
  monthTo: string;
}): Promise<TopProduct[]> {
  const { data, error } = await supabase.rpc('admin_top_products', {
    p_seller: args.sellerId,
    p_month_from: toIsoDate(args.monthFrom),
    p_month_to: toIsoDate(args.monthTo),
  });
  if (error) throw normalizeError(error);
  return ((data ?? []) as TopProductRow[]).map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    units: r.units,
  }));
}

interface AgingRow {
  bucket: string;
  days_min: number;
  days_max: number | null;
  total_pendente: number | string;
}

export async function fetchAdminAging(args: {
  sellerId: string | null;
  asOf: string;
}): Promise<AgingBucket[]> {
  const { data, error } = await supabase.rpc('admin_receivables_aging', {
    p_seller: args.sellerId,
    p_as_of: toIsoDate(args.asOf),
  });
  if (error) throw normalizeError(error);
  return ((data ?? []) as AgingRow[]).map((r) => ({
    label: r.bucket as AgingBucket['label'],
    daysMin: r.days_min,
    daysMax: r.days_max,
    totalPendente: num(r.total_pendente),
  }));
}
