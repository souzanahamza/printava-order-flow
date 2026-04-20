-- 1) Expand order_tasks.status allowed values (drop old CHECK, add new)
ALTER TABLE public.order_tasks DROP CONSTRAINT IF EXISTS order_tasks_status_check;

ALTER TABLE public.order_tasks
  ADD CONSTRAINT order_tasks_status_check CHECK (
    status IN (
      'Pending',       -- في الانتظار
      'In Progress',   -- قيد العمل
      'Approval',      -- بانتظار موافقة المبيعات
      'Revision',      -- مطلوب تعديلات
      'Waiting File',  -- بانتظار ملف الطباعة النهائي
      'Completed',     -- انتهت المهمة
      'Blocked'        -- مقفولة (بانتظار مرحلة سابقة)
    )
  );

-- 2) Unblock production when design task completes (UPDATE of status only)
CREATE OR REPLACE FUNCTION public.fn_unblock_production_when_design_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.task_type = 'design'
     AND NEW.status = 'Completed'
     AND (OLD.status IS DISTINCT FROM NEW.status)
  THEN
    UPDATE public.order_tasks
    SET status = 'Pending'
    WHERE order_item_id = NEW.order_item_id
      AND task_type = 'production'
      AND status = 'Blocked';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_unblock_production_when_design_completed() OWNER TO postgres;

-- Remove legacy trigger names from earlier iterations
DROP TRIGGER IF EXISTS tr_order_tasks_unblock_production_on_design_complete ON public.order_tasks;
DROP TRIGGER IF EXISTS tr_unblock_production_on_design_complete ON public.order_tasks;
DROP TRIGGER IF EXISTS tr_order_tasks_unblock_production ON public.order_tasks;

CREATE TRIGGER tr_order_tasks_unblock_production
  AFTER UPDATE OF status ON public.order_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_unblock_production_when_design_completed();
