-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'designer', 'production', 'accountant');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user has a role (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create security definer function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Create security definer function to get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Update is_admin function to use the new table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles table
-- Users can view roles of colleagues in their company
CREATE POLICY "Users can view company roles"
ON public.user_roles
FOR SELECT
USING (company_id = get_my_company_id());

-- Only admins can insert roles (for their company only)
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  is_admin() 
  AND company_id = get_my_company_id()
);

-- Only admins can update roles (for their company, but not their own)
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (
  is_admin() 
  AND company_id = get_my_company_id()
  AND user_id != auth.uid()
);

-- Only admins can delete roles (for their company, but not their own)
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (
  is_admin() 
  AND company_id = get_my_company_id()
  AND user_id != auth.uid()
);

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT 
  p.id as user_id,
  p.role::app_role as role,
  p.company_id
FROM public.profiles p
WHERE p.role IS NOT NULL 
  AND p.company_id IS NOT NULL
  AND p.role IN ('admin', 'sales', 'designer', 'production', 'accountant')
ON CONFLICT (user_id, role) DO NOTHING;

-- Update handle_new_user function to also create user_role entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_role text;
  v_company_name text;
BEGIN
  -- 1. Determine role (default to admin for new signups)
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'admin');
  
  -- 2. Check: is user an invited employee (has company_id) or new owner?
  IF (new.raw_user_meta_data->>'company_id') IS NOT NULL THEN
    -- Employee case: use existing company
    v_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
  ELSE
    -- New owner case (Sign Up): use their ID as company ID
    v_company_id := new.id;
    
    -- Get company name from metadata or use default
    v_company_name := COALESCE(new.raw_user_meta_data->>'company_name', 'My Print Shop');

    -- Create company first
    INSERT INTO public.companies (id, owner_id, name)
    VALUES (v_company_id, new.id, v_company_name)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 3. Create profile (without role - role is in user_roles now)
  INSERT INTO public.profiles (id, full_name, company_id, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    v_company_id,
    new.email
  );

  -- 4. Create user role entry
  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (
    new.id,
    v_role::app_role,
    v_company_id
  );

  RETURN new;
END;
$$;