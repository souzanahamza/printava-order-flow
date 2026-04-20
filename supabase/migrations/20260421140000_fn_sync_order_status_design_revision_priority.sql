-- Order-level status derived from order_tasks: prioritize Design Revision for visibility,
-- then Design Approval, Waiting for Print File, active design, pending design, production.

CREATE OR REPLACE FUNCTION public.fn_sync_order_status_from_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_current_order_status text;

  v_total_tasks int;
  v_completed_tasks int;

  v_design_pending int;
  v_design_in_progress int;
  v_design_approval int;
  v_design_revision int;
  v_design_waiting_file int;

  v_prod_in_progress int;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT status INTO v_current_order_status FROM public.orders WHERE id = v_order_id;

  IF v_current_order_status IN ('Delivered', 'Canceled') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'Completed'),
    COUNT(*) FILTER (WHERE task_type = 'design' AND status = 'Pending'),
    COUNT(*) FILTER (WHERE task_type = 'design' AND status = 'In Progress'),
    COUNT(*) FILTER (WHERE task_type = 'design' AND status = 'Design Approval'),
    COUNT(*) FILTER (WHERE task_type = 'design' AND status = 'Design Revision'),
    COUNT(*) FILTER (WHERE task_type = 'design' AND status = 'Waiting for Print File'),
    COUNT(*) FILTER (WHERE task_type = 'production' AND status = 'In Progress')
  INTO
    v_total_tasks,
    v_completed_tasks,
    v_design_pending,
    v_design_in_progress,
    v_design_approval,
    v_design_revision,
    v_design_waiting_file,
    v_prod_in_progress
  FROM public.order_tasks
  WHERE order_id = v_order_id;

  IF v_total_tasks > 0 AND v_total_tasks = v_completed_tasks THEN
    UPDATE public.orders SET status = 'Ready for Pickup' WHERE id = v_order_id;

  ELSIF v_design_revision > 0 THEN
    UPDATE public.orders SET status = 'Design Revision' WHERE id = v_order_id;

  ELSIF v_design_approval > 0 THEN
    UPDATE public.orders SET status = 'Design Approval' WHERE id = v_order_id;

  ELSIF v_design_waiting_file > 0 THEN
    UPDATE public.orders SET status = 'Waiting for Print File' WHERE id = v_order_id;

  ELSIF v_design_in_progress > 0 THEN
    UPDATE public.orders SET status = 'In Design' WHERE id = v_order_id;

  ELSIF v_design_pending > 0 THEN
    UPDATE public.orders SET status = 'Ready for Design' WHERE id = v_order_id;

  ELSIF v_prod_in_progress > 0 THEN
    UPDATE public.orders SET status = 'In Production' WHERE id = v_order_id;

  ELSE
    UPDATE public.orders SET status = 'Ready for Production' WHERE id = v_order_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_sync_order_status_from_tasks() OWNER TO postgres;
