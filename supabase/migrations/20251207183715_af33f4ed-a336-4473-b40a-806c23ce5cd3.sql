-- Remove deprecated role column from profiles table
-- Roles are now properly managed in the user_roles table
-- This prevents privilege escalation via the 'Users can update own profile' RLS policy

ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;