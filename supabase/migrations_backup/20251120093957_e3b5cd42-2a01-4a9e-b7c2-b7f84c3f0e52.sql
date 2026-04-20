-- Update RLS policies for order_statuses to use company_id NULL for public statuses

-- Drop existing policies
DROP POLICY IF EXISTS "select statuses" ON public.order_statuses;
DROP POLICY IF EXISTS "insert statuses" ON public.order_statuses;
DROP POLICY IF EXISTS "update only own statuses" ON public.order_statuses;
DROP POLICY IF EXISTS "delete only own statuses" ON public.order_statuses;

-- Create new policies using company_id NULL for public/shared statuses
CREATE POLICY "select statuses"
ON public.order_statuses
FOR SELECT
USING (
  company_id = get_my_company_id() 
  OR company_id IS NULL
);

CREATE POLICY "insert statuses"
ON public.order_statuses
FOR INSERT
WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "update only own statuses"
ON public.order_statuses
FOR UPDATE
USING (company_id = get_my_company_id());

CREATE POLICY "delete only own statuses"
ON public.order_statuses
FOR DELETE
USING (company_id = get_my_company_id());