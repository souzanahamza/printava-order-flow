-- Task-level status audit: log design/production task status changes per order line.

CREATE TABLE IF NOT EXISTS public.order_item_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  task_type text NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT order_item_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT order_item_status_history_task_type_check CHECK (
    task_type = ANY (ARRAY['design'::text, 'production'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_order_item_status_history_order_item_id
  ON public.order_item_status_history (order_item_id);

CREATE INDEX IF NOT EXISTS idx_order_item_status_history_company_id
  ON public.order_item_status_history (company_id);

CREATE INDEX IF NOT EXISTS idx_order_item_status_history_created_at
  ON public.order_item_status_history (created_at DESC);

ALTER TABLE public.order_item_status_history OWNER TO postgres;

ALTER TABLE public.order_item_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access own item history" ON public.order_item_status_history;
DROP POLICY IF EXISTS "Users can view own company item task history" ON public.order_item_status_history;
DROP POLICY IF EXISTS "Users can insert own company item task history" ON public.order_item_status_history;
DROP POLICY IF EXISTS "Users can update own company item task history" ON public.order_item_status_history;
DROP POLICY IF EXISTS "Users can delete own company item task history" ON public.order_item_status_history;

CREATE POLICY "Users can view own company item task history"
  ON public.order_item_status_history
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can insert own company item task history"
  ON public.order_item_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can update own company item task history"
  ON public.order_item_status_history
  FOR UPDATE
  TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can delete own company item task history"
  ON public.order_item_status_history
  FOR DELETE
  TO authenticated
  USING (company_id = public.get_my_company_id());

GRANT ALL ON TABLE public.order_item_status_history TO anon;
GRANT ALL ON TABLE public.order_item_status_history TO authenticated;
GRANT ALL ON TABLE public.order_item_status_history TO service_role;

CREATE OR REPLACE FUNCTION public.fn_log_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.order_item_status_history (
      order_item_id,
      company_id,
      task_type,
      previous_status,
      new_status,
      changed_by,
      notes
    )
    VALUES (
      NEW.order_item_id,
      NEW.company_id,
      NEW.task_type,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status,
      auth.uid(),
      'Status updated via task workflow'
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_log_task_status_change() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_log_task_status ON public.order_tasks;

CREATE TRIGGER trg_log_task_status
  AFTER INSERT OR UPDATE OF status ON public.order_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_task_status_change();
