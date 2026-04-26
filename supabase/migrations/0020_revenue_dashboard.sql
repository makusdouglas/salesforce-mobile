-- 0020_revenue_dashboard.sql
-- Feature: 017-revenue-dashboard
--
-- Six SECURITY DEFINER functions returning pre-aggregated rows for the
-- admin Revenue dashboard. All functions:
--   * gate on the caller having any admin-grade role (any non-seller
--     entry in user_roles), raising 42501 for non-admin callers
--   * read across all sellers without exposing raw tables (the body
--     does the role check; SELECT RLS is bypassed by SECURITY DEFINER)
--   * accept a NULL p_seller to mean "all sellers" (the "Todos" filter)
--
-- Per-order pendente formula (matches client-side computeOrdersOverviewSummary):
--   pendente_per_order = greatest(0, order_total - sum(receipts.amount))
-- where order_total comes from order_items + order discount.
--
-- Server-side time arithmetic uses the existing bigint epoch-ms columns
-- (orders.sent_at_ms, orders.created_at_ms, payment_receipts.received_at_ms).
-- Client passes p_month / p_from / p_as_of as date values; we convert to
-- epoch ms before comparing.
--
-- Top-N caps live in the function bodies (top 10 sellers, top 3 clients,
-- top 3 products) per FR-019 / FR-020 / FR-021.

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Helper: month-boundary epoch milliseconds
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._month_start_ms(p_month date)
RETURNS bigint
LANGUAGE sql IMMUTABLE
AS $$
  SELECT (extract(epoch from date_trunc('month', p_month)) * 1000)::bigint;
$$;

CREATE OR REPLACE FUNCTION public._month_end_ms(p_month date)
RETURNS bigint
LANGUAGE sql IMMUTABLE
AS $$
  SELECT (extract(epoch from (date_trunc('month', p_month) + interval '1 month')) * 1000)::bigint;
$$;

-- ---------------------------------------------------------------------
-- 1. admin_revenue_kpis
-- ---------------------------------------------------------------------

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

  -- Per-order totals as a CTE-like inline view.
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
  /* Recebido = receipts whose parent order's sent_at falls in the month */
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
  )
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE sent_at_ms >= cur_start  AND sent_at_ms < cur_end),  0),
    COALESCE(SUM(amount) FILTER (WHERE sent_at_ms >= prev_start AND sent_at_ms < prev_end), 0)
    INTO cur_recebido, prev_recebido
  FROM receipts_in_month;

  /* Faturado = sum of order totals for orders created in the month */
  SELECT
    COALESCE(SUM(total) FILTER (WHERE created_at_ms >= cur_start  AND created_at_ms < cur_end),  0),
    COALESCE(SUM(total) FILTER (WHERE created_at_ms >= prev_start AND created_at_ms < prev_end), 0)
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

  /* Pendente = sum over sent orders in month of greatest(0, total - received).
     CTEs are scoped per-statement, so we re-declare order_totals + receipt_sums
     here. See 0021 hotfix migration for the original bug. */
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
    COALESCE(SUM(GREATEST(0, ot.total - COALESCE(rs.total_received, 0)))
      FILTER (WHERE ot.sent_at_ms >= cur_start  AND ot.sent_at_ms < cur_end),  0),
    COALESCE(SUM(GREATEST(0, ot.total - COALESCE(rs.total_received, 0)))
      FILTER (WHERE ot.sent_at_ms >= prev_start AND ot.sent_at_ms < prev_end), 0)
    INTO cur_pendente, prev_pendente
  FROM order_totals ot
  LEFT JOIN receipt_sums rs ON rs.order_id = ot.order_id;

  /* Sent orders count for the month, used for Ticket médio + Nº pedidos */
  SELECT
    COUNT(*) FILTER (WHERE sent_at_ms >= cur_start  AND sent_at_ms < cur_end),
    COUNT(*) FILTER (WHERE sent_at_ms >= prev_start AND sent_at_ms < prev_end)
    INTO cur_count, prev_count
  FROM public.orders
  WHERE deleted_at IS NULL
    AND status = 'sent'
    AND sent_at_ms IS NOT NULL
    AND (p_seller IS NULL OR salesperson_id = p_seller);

  -- Emit the 5 KPI rows. Caller derives delta % client-side.
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

-- ---------------------------------------------------------------------
-- Helper: caller has any admin-grade role
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._caller_is_admin_grade()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid()
       AND role IN ('superuser', 'manage-products', 'manage-salespersons', 'manage-clients')
  );
$$;

-- ---------------------------------------------------------------------
-- 2. admin_revenue_monthly
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_revenue_monthly(
  p_seller uuid DEFAULT NULL,
  p_from   date DEFAULT (date_trunc('month', now()) - interval '11 months')::date,
  p_to     date DEFAULT date_trunc('month', now())::date
)
RETURNS TABLE (
  month     date,
  faturado  numeric,
  recebido  numeric,
  pendente  numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_start bigint := public._month_start_ms(p_from);
  to_end     bigint := public._month_end_ms(p_to);
BEGIN
  IF NOT public._caller_is_admin_grade() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH order_totals AS (
    SELECT o.id, o.salesperson_id, o.status, o.sent_at_ms, o.created_at_ms,
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
    SELECT pr.order_id, COALESCE(SUM(pr.amount), 0) AS total_received
    FROM public.payment_receipts pr
    WHERE pr.deleted_at IS NULL
    GROUP BY pr.order_id
  ),
  faturado_per_month AS (
    SELECT date_trunc('month', to_timestamp(ot.created_at_ms / 1000.0))::date AS m,
           SUM(ot.total) AS faturado
    FROM order_totals ot
    WHERE ot.created_at_ms >= from_start AND ot.created_at_ms < to_end
    GROUP BY 1
  ),
  recebido_per_month AS (
    SELECT date_trunc('month', to_timestamp(ot.sent_at_ms / 1000.0))::date AS m,
           SUM(pr.amount) AS recebido
    FROM order_totals ot
    JOIN public.payment_receipts pr ON pr.order_id = ot.id
    WHERE pr.deleted_at IS NULL
      AND ot.status = 'sent'
      AND ot.sent_at_ms IS NOT NULL
      AND ot.sent_at_ms >= from_start AND ot.sent_at_ms < to_end
    GROUP BY 1
  ),
  pendente_per_month AS (
    SELECT date_trunc('month', to_timestamp(ot.sent_at_ms / 1000.0))::date AS m,
           SUM(GREATEST(0, ot.total - COALESCE(rs.total_received, 0))) AS pendente
    FROM order_totals ot
    LEFT JOIN receipt_sums rs ON rs.order_id = ot.id
    WHERE ot.status = 'sent'
      AND ot.sent_at_ms IS NOT NULL
      AND ot.sent_at_ms >= from_start AND ot.sent_at_ms < to_end
    GROUP BY 1
  ),
  combined AS (
    SELECT m FROM faturado_per_month
    UNION
    SELECT m FROM recebido_per_month
    UNION
    SELECT m FROM pendente_per_month
  )
  SELECT
    c.m,
    COALESCE(fpm.faturado, 0)::numeric,
    COALESCE(rpm.recebido, 0)::numeric,
    COALESCE(ppm.pendente, 0)::numeric
  FROM combined c
  LEFT JOIN faturado_per_month fpm ON fpm.m = c.m
  LEFT JOIN recebido_per_month rpm ON rpm.m = c.m
  LEFT JOIN pendente_per_month ppm ON ppm.m = c.m
  ORDER BY c.m ASC;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. admin_revenue_by_seller
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_revenue_by_seller(
  p_month date DEFAULT date_trunc('month', now())::date
)
RETURNS TABLE (
  salesperson_id   uuid,
  salesperson_name text,
  recebido         numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_start bigint := public._month_start_ms(p_month);
  m_end   bigint := public._month_end_ms(p_month);
BEGIN
  IF NOT public._caller_is_admin_grade() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id, s.name, COALESCE(SUM(pr.amount), 0)::numeric AS recebido
  FROM public.salespeople s
  JOIN public.orders o ON o.salesperson_id = s.id
                       AND o.deleted_at IS NULL
                       AND o.status = 'sent'
                       AND o.sent_at_ms IS NOT NULL
                       AND o.sent_at_ms >= m_start AND o.sent_at_ms < m_end
  JOIN public.payment_receipts pr ON pr.order_id = o.id
                                   AND pr.deleted_at IS NULL
  WHERE s.deleted_at IS NULL
  GROUP BY s.id, s.name
  HAVING COALESCE(SUM(pr.amount), 0) > 0
  ORDER BY recebido DESC, s.name ASC
  LIMIT 10;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. admin_top_clients
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_top_clients(
  p_seller     uuid DEFAULT NULL,
  p_month_from date DEFAULT date_trunc('month', now())::date,
  p_month_to   date DEFAULT date_trunc('month', now())::date
)
RETURNS TABLE (
  client_id   uuid,
  client_name text,
  recebido    numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_start bigint := public._month_start_ms(p_month_from);
  to_end     bigint := public._month_end_ms(p_month_to);
BEGIN
  IF NOT public._caller_is_admin_grade() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, COALESCE(SUM(pr.amount), 0)::numeric AS recebido
  FROM public.clients c
  JOIN public.orders o ON o.client_id = c.id
                       AND o.deleted_at IS NULL
                       AND o.status = 'sent'
                       AND o.sent_at_ms IS NOT NULL
                       AND o.sent_at_ms >= from_start AND o.sent_at_ms < to_end
                       AND (p_seller IS NULL OR o.salesperson_id = p_seller)
  JOIN public.payment_receipts pr ON pr.order_id = o.id
                                   AND pr.deleted_at IS NULL
  WHERE c.deleted_at IS NULL
  GROUP BY c.id, c.name
  HAVING COALESCE(SUM(pr.amount), 0) > 0
  ORDER BY recebido DESC, c.name ASC
  LIMIT 3;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. admin_top_products
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_top_products(
  p_seller     uuid DEFAULT NULL,
  p_month_from date DEFAULT date_trunc('month', now())::date,
  p_month_to   date DEFAULT date_trunc('month', now())::date
)
RETURNS TABLE (
  product_id   uuid,
  product_name text,
  units        integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_start bigint := public._month_start_ms(p_month_from);
  to_end     bigint := public._month_end_ms(p_month_to);
BEGIN
  IF NOT public._caller_is_admin_grade() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0)::integer AS units
  FROM public.products p
  JOIN public.product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
  JOIN public.order_items oi ON oi.product_variant_id = pv.id AND oi.deleted_at IS NULL
  JOIN public.orders o ON o.id = oi.order_id
                       AND o.deleted_at IS NULL
                       AND o.status = 'sent'
                       AND o.sent_at_ms IS NOT NULL
                       AND o.sent_at_ms >= from_start AND o.sent_at_ms < to_end
                       AND (p_seller IS NULL OR o.salesperson_id = p_seller)
  WHERE p.deleted_at IS NULL
  GROUP BY p.id, p.name
  HAVING COALESCE(SUM(oi.quantity), 0) > 0
  ORDER BY units DESC, p.name ASC
  LIMIT 3;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. admin_receivables_aging
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_receivables_aging(
  p_seller uuid DEFAULT NULL,
  p_as_of  date DEFAULT now()::date
)
RETURNS TABLE (
  bucket          text,
  days_min        integer,
  days_max        integer,
  total_pendente  numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  asof_ms bigint := (extract(epoch from p_as_of) * 1000)::bigint;
BEGIN
  IF NOT public._caller_is_admin_grade() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH order_totals AS (
    SELECT o.id, o.sent_at_ms,
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
      AND o.sent_at_ms <= asof_ms
      AND (p_seller IS NULL OR o.salesperson_id = p_seller)
  ),
  receipt_sums AS (
    SELECT pr.order_id, COALESCE(SUM(pr.amount), 0) AS total_received
    FROM public.payment_receipts pr
    WHERE pr.deleted_at IS NULL
    GROUP BY pr.order_id
  ),
  per_order AS (
    SELECT
      ot.id,
      FLOOR((asof_ms - ot.sent_at_ms) / (86400.0 * 1000))::integer AS age_days,
      GREATEST(0, ot.total - COALESCE(rs.total_received, 0)) AS pendente
    FROM order_totals ot
    LEFT JOIN receipt_sums rs ON rs.order_id = ot.id
  ),
  buckets(bucket, days_min, days_max) AS (
    VALUES
      ('0-30',  0,   30),
      ('31-60', 31,  60),
      ('61-90', 61,  90),
      ('>90',   91,  NULL::int)
  )
  SELECT b.bucket, b.days_min, b.days_max,
         COALESCE(SUM(po.pendente) FILTER (
           WHERE po.age_days >= b.days_min
             AND (b.days_max IS NULL OR po.age_days <= b.days_max)
         ), 0)::numeric AS total_pendente
  FROM buckets b
  LEFT JOIN per_order po ON true
  GROUP BY b.bucket, b.days_min, b.days_max
  ORDER BY b.days_min ASC;
END;
$$;

-- ---------------------------------------------------------------------
-- Grants — execution allowed for any authenticated user; the function
-- bodies enforce the admin-grade check.
-- ---------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public._caller_is_admin_grade()                       TO authenticated;
GRANT EXECUTE ON FUNCTION public._month_start_ms(date)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public._month_end_ms(date)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revenue_kpis(uuid, date)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revenue_monthly(uuid, date, date)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revenue_by_seller(date)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_clients(uuid, date, date)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_products(uuid, date, date)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_receivables_aging(uuid, date)            TO authenticated;

COMMIT;
