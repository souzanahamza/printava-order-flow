-- Re-sync parent order when tasks are inserted (initial task rows) or when task status changes.
-- Drops legacy trigger names from earlier migration iterations.

DROP TRIGGER IF EXISTS zzz_sync_order_status_from_tasks ON public.order_tasks;
DROP TRIGGER IF EXISTS trg_sync_order_status_from_tasks ON public.order_tasks;

CREATE TRIGGER trg_sync_order_status_from_tasks
  AFTER INSERT OR UPDATE OF status ON public.order_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_order_status_from_tasks();
