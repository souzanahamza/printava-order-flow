-- When a design order_task is marked Completed, unblock the sibling production task for the same line item.

CREATE OR REPLACE FUNCTION public.fn_unblock_production_when_design_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.task_type = 'design'
     AND NEW.status = 'Completed'
     AND (OLD.status IS DISTINCT FROM NEW.status)
  THEN
    UPDATE public.order_tasks ot
    SET status = 'Pending'
    WHERE ot.order_item_id = NEW.order_item_id
      AND ot.task_type = 'production'
      AND ot.status = 'Blocked';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_unblock_production_when_design_completed() OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_unblock_production_on_design_complete ON public.order_tasks;

CREATE TRIGGER tr_unblock_production_on_design_complete
  AFTER UPDATE OF status ON public.order_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_unblock_production_when_design_completed();
