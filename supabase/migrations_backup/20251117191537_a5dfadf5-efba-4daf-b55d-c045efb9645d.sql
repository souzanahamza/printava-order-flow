-- Enable RLS on companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own company
CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy for users to insert their own company
CREATE POLICY "Users can create their own company"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() AND owner_id = auth.uid());

-- Policy for users to update their own company
CREATE POLICY "Users can update their own company"
ON public.companies
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Function to create company on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.companies (id, owner_id, name)
  VALUES (new.id, new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger to create company on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for products
DROP POLICY IF EXISTS "Allow insert on products" ON public.products;
DROP POLICY IF EXISTS "Allow read access to products" ON public.products;
DROP POLICY IF EXISTS "Allow update on products" ON public.products;

CREATE POLICY "Users can view their company products"
ON public.products
FOR SELECT
TO authenticated
USING (company_id = auth.uid());

CREATE POLICY "Users can insert their company products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their company products"
ON public.products
FOR UPDATE
TO authenticated
USING (company_id = auth.uid())
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can delete their company products"
ON public.products
FOR DELETE
TO authenticated
USING (company_id = auth.uid());

-- Update RLS policies for orders
DROP POLICY IF EXISTS "Allow all operations on orders" ON public.orders;

CREATE POLICY "Users can view their company orders"
ON public.orders
FOR SELECT
TO authenticated
USING (company_id = auth.uid());

CREATE POLICY "Users can insert their company orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their company orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (company_id = auth.uid())
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can delete their company orders"
ON public.orders
FOR DELETE
TO authenticated
USING (company_id = auth.uid());

-- Update RLS policies for order_items
DROP POLICY IF EXISTS "Allow all operations on order_items" ON public.order_items;

CREATE POLICY "Users can view their company order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (company_id = auth.uid());

CREATE POLICY "Users can insert their company order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their company order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (company_id = auth.uid())
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can delete their company order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (company_id = auth.uid());

-- Update RLS policies for pricing_tiers
DROP POLICY IF EXISTS "Allow insert on pricing_tiers" ON public.pricing_tiers;
DROP POLICY IF EXISTS "Allow read access to pricing_tiers" ON public.pricing_tiers;
DROP POLICY IF EXISTS "Allow update on pricing_tiers" ON public.pricing_tiers;

CREATE POLICY "Users can view their company pricing tiers"
ON public.pricing_tiers
FOR SELECT
TO authenticated
USING (company_id = auth.uid());

CREATE POLICY "Users can insert their company pricing tiers"
ON public.pricing_tiers
FOR INSERT
TO authenticated
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their company pricing tiers"
ON public.pricing_tiers
FOR UPDATE
TO authenticated
USING (company_id = auth.uid())
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can delete their company pricing tiers"
ON public.pricing_tiers
FOR DELETE
TO authenticated
USING (company_id = auth.uid());

-- Update RLS policies for order_statuses
DROP POLICY IF EXISTS "Allow insert on order_statuses" ON public.order_statuses;
DROP POLICY IF EXISTS "Allow read access to order_statuses" ON public.order_statuses;
DROP POLICY IF EXISTS "Allow update on order_statuses" ON public.order_statuses;

CREATE POLICY "Users can view their company order statuses"
ON public.order_statuses
FOR SELECT
TO authenticated
USING (company_id = auth.uid());

CREATE POLICY "Users can insert their company order statuses"
ON public.order_statuses
FOR INSERT
TO authenticated
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their company order statuses"
ON public.order_statuses
FOR UPDATE
TO authenticated
USING (company_id = auth.uid())
WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can delete their company order statuses"
ON public.order_statuses
FOR DELETE
TO authenticated
USING (company_id = auth.uid());