-- Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Update profiles policies to allow admins to manage team members
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admins can update team members in their company
CREATE POLICY "Admins can update team members"
ON profiles
FOR UPDATE
USING (
  is_admin() AND 
  company_id = get_my_company_id()
);

-- Admins can delete team members in their company
CREATE POLICY "Admins can delete team members"
ON profiles
FOR DELETE
USING (
  is_admin() AND 
  company_id = get_my_company_id() AND
  id != auth.uid()  -- Prevent self-deletion
);