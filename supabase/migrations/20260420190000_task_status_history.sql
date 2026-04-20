-- Replace per-line-item history with per-task history (task_status_history).

DROP TRIGGER IF EXISTS trg_log_task_status ON public.order_tasks;
DROP TRIGGER IF EXISTS trg_log_task_status_change ON public.order_tasks;
DROP TRIGGER IF EXISTS trg_log_order_item_status_change ON public.order_tasks;

DROP FUNCTION IF EXISTS public.fn_log_order_item_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.fn_log_task_status_change() CASCADE;

DROP TABLE IF EXISTS public.order_item_status_history CASCADE;

CREATE TABLE public.task_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.order_tasks (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT task_status_history_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id ON public.task_status_history (task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_company_id ON public.task_status_history (company_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_created_at ON public.task_status_history (created_at DESC);

ALTER TABLE public.task_status_history OWNER TO postgres;

ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access own company task history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can view own company task status history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can insert own company task status history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can update own company task status history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can delete own company task status history" ON public.task_status_history;

CREATE POLICY "Users can view own company task status history"
  ON public.task_status_history
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can insert own company task status history"
  ON public.task_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can update own company task status history"
  ON public.task_status_history
  FOR UPDATE
  TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can delete own company task status history"
  ON public.task_status_history
  FOR DELETE
  TO authenticated
  USING (company_id = public.get_my_company_id());

GRANT ALL ON TABLE public.task_status_history TO anon;
GRANT ALL ON TABLE public.task_status_history TO authenticated;
GRANT ALL ON TABLE public.task_status_history TO service_role;

CREATE OR REPLACE FUNCTION public.fn_log_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.task_status_history (
      task_id,
      company_id,
      previous_status,
      new_status,
      changed_by,
      notes
    )
    VALUES (
      NEW.id,
      NEW.company_id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status,
      auth.uid(),
      'Status changed via workflow'
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_log_task_status_change() OWNER TO postgres;

CREATE TRIGGER trg_log_task_status_change
  AFTER INSERT OR UPDATE OF status ON public.order_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_task_status_change();
