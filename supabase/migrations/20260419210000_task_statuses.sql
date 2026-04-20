-- task_statuses: canonical labels for order_tasks.status (text); optional per-company rows later.

CREATE TABLE IF NOT EXISTS public.task_statuses (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  color text DEFAULT '#64748b',
  sort_order integer NOT NULL DEFAULT 0,
  company_id uuid REFERENCES public.companies (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT task_statuses_pkey PRIMARY KEY (id),
  CONSTRAINT task_statuses_name_key UNIQUE (name)
);

COMMENT ON TABLE public.task_statuses IS 'Labels/colors for order_tasks.status string values; company_id null = global defaults.';

-- Standard task states (global: company_id IS NULL)
INSERT INTO public.task_statuses (name, color, sort_order, company_id) VALUES
  ('Pending', '#94a3b8', 1, NULL),
  ('In Progress', '#3b82f6', 2, NULL),
  ('Design Approval', '#8b5cf6', 3, NULL),
  ('Design Revision', '#f59e0b', 4, NULL),
  ('Waiting for Print File', '#06b6d4', 5, NULL),
  ('Completed', '#22c55e', 6, NULL),
  ('Blocked', '#ef4444', 7, NULL)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select task statuses" ON public.task_statuses;
DROP POLICY IF EXISTS "insert task statuses" ON public.task_statuses;
DROP POLICY IF EXISTS "update task statuses" ON public.task_statuses;
DROP POLICY IF EXISTS "delete task statuses" ON public.task_statuses;

CREATE POLICY "select task statuses" ON public.task_statuses
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

CREATE POLICY "insert task statuses" ON public.task_statuses
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "update task statuses" ON public.task_statuses
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "delete task statuses" ON public.task_statuses
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

GRANT ALL ON TABLE public.task_statuses TO anon;
GRANT ALL ON TABLE public.task_statuses TO authenticated;
GRANT ALL ON TABLE public.task_statuses TO service_role;

-- Align order_tasks.status with new vocabulary before replacing CHECK
ALTER TABLE public.order_tasks DROP CONSTRAINT IF EXISTS order_tasks_status_check;

UPDATE public.order_tasks SET status = 'Design Approval' WHERE status = 'Approval';
UPDATE public.order_tasks SET status = 'Design Revision' WHERE status = 'Revision';
UPDATE public.order_tasks SET status = 'Waiting for Print File' WHERE status IN ('Waiting File', 'Waiting for Print File');

ALTER TABLE public.order_tasks
  ADD CONSTRAINT order_tasks_status_check CHECK (
    status IN (
      'Pending',
      'In Progress',
      'Design Approval',
      'Design Revision',
      'Waiting for Print File',
      'Completed',
      'Blocked'
    )
  );

-- Unblock production when a design line completes (names unchanged: still Completed / Pending / Blocked)
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

DROP TRIGGER IF EXISTS tr_order_tasks_unblock_production ON public.order_tasks;

CREATE TRIGGER tr_order_tasks_unblock_production
  AFTER UPDATE OF status ON public.order_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_unblock_production_when_design_completed();
