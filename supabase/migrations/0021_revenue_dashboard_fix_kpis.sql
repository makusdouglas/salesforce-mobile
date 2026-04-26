-- 0021_revenue_dashboard_fix_kpis.sql
-- Hotfix for 017-revenue-dashboard.
--
-- 0020 declared the CTE `receipt_sums` inside the first SELECT (Recebido)
-- and tried to reuse it in the third SELECT (Pendente). Postgres scopes
-- CTEs to the statement they're declared in, so the Pendente block raised
-- "relation receipt_sums does not exist" and the dashboard never finished
-- loading.
--
-- Fix: rebuild admin_revenue_kpis as a single SELECT with all required
-- CTEs in the same WITH clause, then aggregate filtered totals from it.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_revenue_kpis(
  p_seller uuid DEFAULT NULL,
  p_month  date DEFAULT date_trunc('month', now())::date
)
RETURNS TABLE (
  label           text,
  current_value   numeric,
  previous_value  numeric,
  current_count   integer,
  previous_count  integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_start  bigint := public._month_start_ms(p_month);
  cur_end    bigint := public._month_end_ms(p_month);
  prev_start bigint := public._month_start_ms((p_month - interval '1 month')::date);
  prev_end   bigint := public._month_end_ms((p_month - interval '1 month')::date);
  cur_recebido    numeric;
  prev_recebido   numeric;
  cur_faturado    numeric;
  prev_faturado   numeric;
  cur_pendente    numeric;
  prev_pendente   numeric;
  cur_count       integer;
  prev_count      integer;
BEGIN
  IF NOT public._caller_is_admin_grade() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  -- One CTE block, three filtered aggregations.
  WITH order_totals AS (
    SELECT
      o.id              AS order_id,
      o.salesperson_id  AS salesperson_id,
      o.status          AS status,
      o.sent_at_ms      AS sent_at_ms,
      o.created_at_ms   AS created_at_ms,
      GREATEST(
        0,
        COALESCE((
          SELECT SUM(oi.quantity * oi.unit_price - oi.discount_amount)
          FROM public.order_items oi
          WHERE oi.order_id = o.id AND oi.deleted_at IS NULL
        ), 0) - o.discount_amount
      ) AS total
    FROM public.orders o
    WHERE o.deleted_at IS NULL
      AND (p_seller IS NULL OR o.salesperson_id = p_seller)
  ),
  receipt_sums AS (
    SELECT pr.order_id,
           COALESCE(SUM(pr.amount), 0) AS total_received
    FROM public.payment_receipts pr
    WHERE pr.deleted_at IS NULL
    GROUP BY pr.order_id
  ),
  receipts_in_month AS (
    SELECT
      ot.salesperson_id,
      ot.sent_at_ms,
      pr.amount
    FROM order_totals ot
    JOIN public.payment_receipts pr ON pr.order_id = ot.order_id
    WHERE pr.deleted_at IS NULL
      AND ot.status = 'sent'
      AND ot.sent_at_ms IS NOT NULL
  ),
  pendente_per_order AS (
    SELECT ot.order_id,
           ot.sent_at_ms,
           GREATEST(0, ot.total - COALESCE(rs.total_received, 0)) AS pendente
    FROM order_totals ot
    LEFT JOIN receipt_sums rs ON rs.order_id = ot.order_id
    WHERE ot.status = 'sent'
      AND ot.sent_at_ms IS NOT NULL
  )
  SELECT
    -- Recebido
    COALESCE(SUM(amount) FILTER (
      WHERE sent_at_ms >= cur_start  AND sent_at_ms < cur_end
    ), 0),
    COALESCE(SUM(amount) FILTER (
      WHERE sent_at_ms >= prev_start AND sent_at_ms < prev_end
    ), 0)
    INTO cur_recebido, prev_recebido
  FROM receipts_in_month;

  -- Faturado: created-in-month totals.
  SELECT
    COALESCE(SUM(total) FILTER (
      WHERE created_at_ms >= cur_start  AND created_at_ms < cur_end
    ), 0),
    COALESCE(SUM(total) FILTER (
      WHERE created_at_ms >= prev_start AND created_at_ms < prev_end
    ), 0)
    INTO cur_faturado, prev_faturado
  FROM (
    SELECT o.id, o.created_at_ms,
           GREATEST(
             0,
             COALESCE((
               SELECT SUM(oi.quantity * oi.unit_price - oi.discount_amount)
               FROM public.order_items oi
               WHERE oi.order_id = o.id AND oi.deleted_at IS NULL
             ), 0) - o.discount_amount
           ) AS total
    FROM public.orders o
    WHERE o.deleted_at IS NULL
      AND (p_seller IS NULL OR o.salesperson_id = p_seller)
  ) ord_all;

  -- Pendente: greatest(0, total - received) per sent order in month.
  WITH order_totals AS (
    SELECT o.id AS order_id, o.sent_at_ms,
           GREATEST(
             0,
             COALESCE((
               SELECT SUM(oi.quantity * oi.unit_price - oi.discount_amount)
               FROM public.order_items oi
               WHERE oi.order_id = o.id AND oi.deleted_at IS NULL
             ), 0) - o.discount_amount
           ) AS total
    FROM public.orders o
    WHERE o.deleted_at IS NULL
      AND o.status = 'sent'
      AND o.sent_at_ms IS NOT NULL
      AND (p_seller IS NULL OR o.salesperson_id = p_seller)
  ),
  receipt_sums AS (
    SELECT pr.order_id, COALESCE(SUM(pr.amount), 0) AS total_received
    FROM public.payment_receipts pr
    WHERE pr.deleted_at IS NULL
    GROUP BY pr.order_id
  )
  SELECT
    COALESCE(SUM(GREATEST(0, ot.total - COALESCE(rs.total_received, 0))) FILTER (
      WHERE ot.sent_at_ms >= cur_start AND ot.sent_at_ms < cur_end
    ), 0),
    COALESCE(SUM(GREATEST(0, ot.total - COALESCE(rs.total_received, 0))) FILTER (
      WHERE ot.sent_at_ms >= prev_start AND ot.sent_at_ms < prev_end
    ), 0)
    INTO cur_pendente, prev_pendente
  FROM order_totals ot
  LEFT JOIN receipt_sums rs ON rs.order_id = ot.order_id;

  -- Sent orders count.
  SELECT
    COUNT(*) FILTER (WHERE sent_at_ms >= cur_start  AND sent_at_ms < cur_end),
    COUNT(*) FILTER (WHERE sent_at_ms >= prev_start AND sent_at_ms < prev_end)
    INTO cur_count, prev_count
  FROM public.orders
  WHERE deleted_at IS NULL
    AND status = 'sent'
    AND sent_at_ms IS NOT NULL
    AND (p_seller IS NULL OR salesperson_id = p_seller);

  RETURN QUERY VALUES
    ('recebido'::text,         cur_recebido,
       CASE WHEN prev_recebido = 0 AND prev_count = 0 THEN NULL::numeric ELSE prev_recebido END,
       cur_count, prev_count),
    ('faturado'::text,         cur_faturado,
       CASE WHEN prev_faturado = 0 AND prev_count = 0 THEN NULL::numeric ELSE prev_faturado END,
       cur_count, prev_count),
    ('pendente'::text,         cur_pendente,
       CASE WHEN prev_pendente = 0 AND prev_count = 0 THEN NULL::numeric ELSE prev_pendente END,
       cur_count, prev_count),
    ('ticket_medio'::text,
       CASE WHEN cur_count  > 0 THEN cur_faturado  / cur_count  ELSE 0 END,
       CASE WHEN prev_count > 0 THEN prev_faturado / prev_count ELSE NULL END,
       cur_count, prev_count),
    ('pedidos_enviados'::text, cur_count::numeric,
       CASE WHEN prev_count = 0 THEN NULL::numeric ELSE prev_count::numeric END,
       cur_count, prev_count);
END;
$$;

COMMIT;
