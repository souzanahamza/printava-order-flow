DROP TRIGGER IF EXISTS trg_log_task_status ON public.order_tasks;
DROP FUNCTION IF EXISTS public.fn_log_task_status_change();