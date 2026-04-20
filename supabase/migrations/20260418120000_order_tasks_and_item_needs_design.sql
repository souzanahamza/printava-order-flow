-- Step 1: Task foundation — per-line-item design flag and auto-generated order_tasks

-- 1) order_items.needs_design (defaults true for existing rows)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS needs_design boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.order_items.needs_design IS 'When true, insert creates design + blocked production tasks; when false, only a pending production task.';

-- 2) order_tasks
CREATE TABLE IF NOT EXISTS public.order_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  task_type text NOT NULL,
  status text NOT NULL,
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_tasks_task_type_check CHECK (task_type = ANY (ARRAY['design'::text, 'production'::text])),
  CONSTRAINT order_tasks_status_check CHECK (
    status = ANY (
      ARRAY[
        'Pending'::text,
        'In Progress'::text,
        'Completed'::text,
        'Blocked'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_order_tasks_order_id ON public.order_tasks (order_id);
CREATE INDEX IF NOT EXISTS idx_order_tasks_order_item_id ON public.order_tasks (order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_tasks_company_id ON public.order_tasks (company_id);
CREATE INDEX IF NOT EXISTS idx_order_tasks_assigned_to ON public.order_tasks (assigned_to);

ALTER TABLE public.order_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their company order tasks" ON public.order_tasks;
DROP POLICY IF EXISTS "Users can insert their company order tasks" ON public.order_tasks;
DROP POLICY IF EXISTS "Users can update their company order tasks" ON public.order_tasks;
DROP POLICY IF EXISTS "Users can delete their company order tasks" ON public.order_tasks;

CREATE POLICY "Users can view their company order tasks"
  ON public.order_tasks
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can insert their company order tasks"
  ON public.order_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can update their company order tasks"
  ON public.order_tasks
  FOR UPDATE
  TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can delete their company order tasks"
  ON public.order_tasks
  FOR DELETE
  TO authenticated
  USING (company_id = public.get_my_company_id());

GRANT ALL ON TABLE public.order_tasks TO anon;
GRANT ALL ON TABLE public.order_tasks TO authenticated;
GRANT ALL ON TABLE public.order_tasks TO service_role;

-- 3) Trigger: create tasks after each order_items insert
CREATE OR REPLACE FUNCTION public.fn_order_items_create_tasks_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  v_company_id := COALESCE(NEW.company_id, (SELECT o.company_id FROM public.orders o WHERE o.id = NEW.order_id));
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create order_tasks: missing company_id on order_item % and order', NEW.id;
  END IF;

  IF NEW.needs_design THEN
    INSERT INTO public.order_tasks (order_id, order_item_id, company_id, task_type, status)
    VALUES (NEW.order_id, NEW.id, v_company_id, 'design', 'Pending');

    INSERT INTO public.order_tasks (order_id, order_item_id, company_id, task_type, status)
    VALUES (NEW.order_id, NEW.id, v_company_id, 'production', 'Blocked');
  ELSE
    INSERT INTO public.order_tasks (order_id, order_item_id, company_id, task_type, status)
    VALUES (NEW.order_id, NEW.id, v_company_id, 'production', 'Pending');
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_order_items_create_tasks_after_insert() OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_order_items_create_tasks_after_insert ON public.order_items;

CREATE TRIGGER tr_order_items_create_tasks_after_insert
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_order_items_create_tasks_after_insert();
