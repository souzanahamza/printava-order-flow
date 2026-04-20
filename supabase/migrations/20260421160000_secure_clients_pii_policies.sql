-- Secure 'clients' table PII by explicitly restricted access to authenticated users
-- Even though get_my_company_id() returns NULL for anon users, being explicit prevents accidental data exposure.

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company clients" ON "public"."clients";
DROP POLICY IF EXISTS "Users can insert their company clients" ON "public"."clients";
DROP POLICY IF EXISTS "Users can update their company clients" ON "public"."clients";
DROP POLICY IF EXISTS "Users can delete their company clients" ON "public"."clients";

-- Re-create policies with 'TO authenticated'
CREATE POLICY "Users can view their company clients" ON "public"."clients"
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can insert their company clients" ON "public"."clients"
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can update their company clients" ON "public"."clients"
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "Users can delete their company clients" ON "public"."clients"
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());
