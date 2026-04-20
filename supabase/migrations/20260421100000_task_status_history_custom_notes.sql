-- Optional custom notes on task_status_history rows via transaction-local GUC (read by trigger).
-- Used when sales/admin requests a design revision with feedback text.

CREATE OR REPLACE FUNCTION public.fn_log_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notes text;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    v_notes := COALESCE(
      NULLIF(BTRIM(current_setting('app.task_status_change_notes', true)), ''),
      'Status changed via workflow'
    );

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
      v_notes
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Updates a task status and supplies the history row notes (same transaction as trigger).
CREATE OR REPLACE FUNCTION public.set_order_task_status_with_notes(
  p_task_id uuid,
  p_new_status text,
  p_notes text,
  p_only_if_task_type text DEFAULT NULL,
  p_only_if_status text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
  v_note text := COALESCE(NULLIF(BTRIM(p_notes), ''), 'Status changed via workflow');
BEGIN
  PERFORM set_config('app.task_status_change_notes', v_note, true);

  UPDATE public.order_tasks ot
  SET status = p_new_status
  WHERE ot.id = p_task_id
    AND ot.company_id = public.get_my_company_id()
    AND (p_only_if_task_type IS NULL OR ot.task_type = p_only_if_task_type)
    AND (p_only_if_status IS NULL OR ot.status = p_only_if_status);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM set_config('app.task_status_change_notes', '', true);

  RETURN v_updated > 0;
END;
$$;

ALTER FUNCTION public.set_order_task_status_with_notes(uuid, text, text, text, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.set_order_task_status_with_notes(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_task_status_with_notes(uuid, text, text, text, text) TO authenticated;
