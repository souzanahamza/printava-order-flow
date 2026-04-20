-- Sync parent orders.status from aggregated order_tasks on each task status change.
-- Note: PostgreSQL runs multiple AFTER UPDATE triggers in alphabetical order by trigger name.
-- tr_order_tasks_unblock_production must run before this (it unblocks production rows when design completes).
-- Prefix zzz_ ensures this trigger runs after tr_order_tasks_unblock_production.

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
  v_in_progress_tasks int;
  v_design_approval_tasks int;
  v_waiting_file_tasks int;
  v_ready_design_tasks int;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'Completed'),
    COUNT(*) FILTER (WHERE status = 'In Progress'),
    COUNT(*) FILTER (WHERE status = 'Design Approval'),
    COUNT(*) FILTER (WHERE status = 'Waiting for Print File'),
    COUNT(*) FILTER (WHERE status = 'Pending' AND task_type = 'design')
  INTO
    v_total_tasks,
    v_completed_tasks,
    v_in_progress_tasks,
    v_design_approval_tasks,
    v_waiting_file_tasks,
    v_ready_design_tasks
  FROM public.order_tasks
  WHERE order_id = v_order_id;

  IF v_total_tasks > 0 AND v_total_tasks = v_completed_tasks THEN
    UPDATE public.orders SET status = 'Ready for Pickup' WHERE id = v_order_id;

  ELSIF v_design_approval_tasks > 0 THEN
    UPDATE public.orders SET status = 'Design Approval' WHERE id = v_order_id;

  ELSIF v_waiting_file_tasks > 0 THEN
    UPDATE public.orders SET status = 'Waiting for Print File' WHERE id = v_order_id;

  ELSIF v_in_progress_tasks > 0 THEN
    UPDATE public.orders SET status = 'In Production' WHERE id = v_order_id;

  ELSIF v_ready_design_tasks > 0 THEN
    UPDATE public.orders SET status = 'Ready for Design' WHERE id = v_order_id;

  ELSE
    UPDATE public.orders SET status = 'In Production' WHERE id = v_order_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_sync_order_status_from_tasks() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_sync_order_status_from_tasks ON public.order_tasks;
DROP TRIGGER IF EXISTS zzz_sync_order_status_from_tasks ON public.order_tasks;

CREATE TRIGGER zzz_sync_order_status_from_tasks
  AFTER UPDATE OF status ON public.order_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_order_status_from_tasks();
