-- Replace order status sync: worst-case priority (all completed → pickup;
-- active design work → In Design or Design Approval; printing → In Production; else Ready for Production).

CREATE OR REPLACE FUNCTION public.fn_sync_order_status_from_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_total_tasks int;
  v_completed_tasks int;
  v_design_tasks_active int;
  v_production_tasks_active int;
  v_approval_tasks int;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'Completed'),
    COUNT(*) FILTER (WHERE task_type = 'design' AND status <> 'Completed'),
    COUNT(*) FILTER (WHERE task_type = 'production' AND status = 'In Progress'),
    COUNT(*) FILTER (WHERE status = 'Design Approval')
  INTO
    v_total_tasks,
    v_completed_tasks,
    v_design_tasks_active,
    v_production_tasks_active,
    v_approval_tasks
  FROM public.order_tasks
  WHERE order_id = v_order_id;

  IF v_total_tasks > 0 AND v_total_tasks = v_completed_tasks THEN
    UPDATE public.orders SET status = 'Ready for Pickup' WHERE id = v_order_id;

  ELSIF v_design_tasks_active > 0 THEN
    IF v_approval_tasks > 0 THEN
      UPDATE public.orders SET status = 'Design Approval' WHERE id = v_order_id;
    ELSE
      UPDATE public.orders SET status = 'In Design' WHERE id = v_order_id;
    END IF;

  ELSIF v_production_tasks_active > 0 THEN
    UPDATE public.orders SET status = 'In Production' WHERE id = v_order_id;

  ELSE
    UPDATE public.orders SET status = 'Ready for Production' WHERE id = v_order_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_sync_order_status_from_tasks() OWNER TO postgres;
