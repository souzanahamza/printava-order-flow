-- Enable RLS on company_sequences
ALTER TABLE "public"."company_sequences" ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if any
DROP POLICY IF EXISTS "Users can manage their own company sequence" ON "public"."company_sequences";

-- Add policy to restrict access to own company_id
CREATE POLICY "Users can manage their own company sequence" ON "public"."company_sequences"
FOR ALL
TO authenticated
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

-- Grant access to specific roles
GRANT ALL ON TABLE "public"."company_sequences" TO "anon";
GRANT ALL ON TABLE "public"."company_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."company_sequences" TO "service_role";
