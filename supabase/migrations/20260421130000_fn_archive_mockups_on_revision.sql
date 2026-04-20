-- When a design task moves to "Design Revision", archive current design_mockup files
-- for that line item so new proofs replace them in the gallery without deleting storage.

CREATE OR REPLACE FUNCTION public.fn_archive_mockups_on_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.task_type = 'design'
     AND NEW.status = 'Design Revision'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.order_item_id IS NOT NULL
  THEN
    UPDATE public.order_attachments
    SET file_type = 'archived_mockup'
    WHERE order_item_id = NEW.order_item_id
      AND file_type = 'design_mockup';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_archive_mockups_on_revision() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_archive_mockups ON public.order_tasks;

CREATE TRIGGER trg_archive_mockups
  AFTER UPDATE OF status ON public.order_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_archive_mockups_on_revision();
