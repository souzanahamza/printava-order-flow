DROP TRIGGER IF EXISTS trg_log_order_item_status_change ON public.order_tasks;
DROP FUNCTION IF EXISTS public.fn_log_order_item_status_change();
DROP TABLE IF EXISTS public.order_item_status_history;

CREATE TABLE public.order_item_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL,
  order_id uuid NOT NULL,
  company_id uuid NOT NULL,
  task_type text NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oish_order_item ON public.order_item_status_history(order_item_id);
CREATE INDEX idx_oish_order ON public.order_item_status_history(order_id);

ALTER TABLE public.order_item_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_company_item_history"
ON public.order_item_status_history FOR SELECT
USING (company_id = public.get_my_company_id());

CREATE POLICY "insert_company_item_history"
ON public.order_item_status_history FOR INSERT
WITH CHECK (company_id = public.get_my_company_id());

CREATE OR REPLACE FUNCTION public.fn_log_order_item_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.order_item_status_history
      (order_item_id, order_id, company_id, task_type, previous_status, new_status, changed_by)
    VALUES
      (NEW.order_item_id, NEW.order_id, NEW.company_id, NEW.task_type, NULL, NEW.status, auth.uid());
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      INSERT INTO public.order_item_status_history
        (order_item_id, order_id, company_id, task_type, previous_status, new_status, changed_by)
      VALUES
        (NEW.order_item_id, NEW.order_id, NEW.company_id, NEW.task_type, OLD.status, NEW.status, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_order_item_status_change
AFTER INSERT OR UPDATE ON public.order_tasks
FOR EACH ROW EXECUTE FUNCTION public.fn_log_order_item_status_change();