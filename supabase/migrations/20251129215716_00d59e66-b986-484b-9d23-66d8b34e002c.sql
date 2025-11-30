-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN email text;

-- Update the handle_new_user trigger to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_role text;
  v_company_name text;
BEGIN
  -- 1. تحديد الدور (إذا لم يحدد، فهو أدمن)
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'admin');
  
  -- 2. التحقق: هل المستخدم موظف مدعو (لديه company_id) أم مالك جديد؟
  IF (new.raw_user_meta_data->>'company_id') IS NOT NULL THEN
    -- حالة الموظف: نستخدم الشركة الموجودة
    v_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
  ELSE
    -- حالة المالك الجديد (Sign Up): نستخدم الـ ID تبعه كـ ID للشركة
    v_company_id := new.id;
    
    -- محاولة جلب اسم الشركة من الميتا داتا أو وضع اسم افتراضي
    v_company_name := COALESCE(new.raw_user_meta_data->>'company_name', 'My Print Shop');

    -- 🔥 الخطوة الحاسمة: إنشاء الشركة أولاً لتجنب الإيرور
    INSERT INTO public.companies (id, owner_id, name)
    VALUES (v_company_id, new.id, v_company_name)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 3. الآن الشركة موجودة 100%، يمكننا إنشاء البروفايل بأمان مع البريد الإلكتروني
  INSERT INTO public.profiles (id, full_name, role, company_id, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    v_role,
    v_company_id,
    new.email
  );

  RETURN new;
END;
$function$;

-- Update existing profiles with their email from auth.users
-- This is a one-time data migration for existing users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;