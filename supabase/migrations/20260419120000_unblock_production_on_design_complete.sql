-- When a design order_task is completed, unblock the sibling production task for the same line item.

CREATE OR REPLACE FUNCTION public.fn_unblock_production_when_design_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.task_type IS DISTINCT FROM 'design' OR NEW.status IS DISTINCT FROM 'Completed' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'Completed' THEN
    RETURN NEW;
  END IF;

  UPDATE public.order_tasks ot
  SET status = 'Pending'
  WHERE ot.order_item_id = NEW.order_item_id
    AND ot.task_type = 'production'
    AND ot.status = 'Blocked';

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_unblock_production_when_design_completed() OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_order_tasks_unblock_production_on_design_complete ON public.order_tasks;

CREATE TRIGGER tr_order_tasks_unblock_production_on_design_complete
  AFTER INSERT OR UPDATE OF status ON public.order_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_unblock_production_when_design_completed();
